#!/usr/bin/env bash
# Sao lưu Hồ sơ số (OPS-03): cơ sở dữ liệu (pg_dump), kho tệp (rsync, không xóa), cấu hình (tùy chọn).
# Mỗi loại ghi một lần chạy về API (/api/v1/ops/backups, BE-89): bắt đầu → kết thúc (thành công/lỗi, dung lượng, nơi lưu).
# Quên chạy hay chạy lỗi thì API tự báo quản trị sau 26 giờ. Mã thoát: 0 đạt · 1 có loại sao lưu lỗi · 2 sao lưu xong nhưng báo API lỗi · 78 thiếu cấu hình.
# Dùng: hoso-backup.sh            (đọc HOSO_BACKUP_ENV, mặc định /etc/hoso/backup.env)
set -uo pipefail

env_file="${HOSO_BACKUP_ENV:-/etc/hoso/backup.env}"
[[ -r "$env_file" ]] || { echo "hoso-backup: không đọc được $env_file" >&2; exit 78; }
set -a; . "$env_file"; set +a
for var in HOSO_BACKUP_DIR HOSO_BLOBS_DIR HOSO_API_URL HOSO_BACKUP_TOKEN PGDATABASE; do
  [[ -n "${!var:-}" ]] || { echo "hoso-backup: thiếu $var trong $env_file" >&2; exit 78; }
done

retention_days="${HOSO_RETENTION_DAYS:-30}"
stamp="$(date +%Y%m%d-%H%M%S)"
report_failed=0
backup_failed=0

now_iso() { date -u +%Y-%m-%dT%H:%M:%SZ; }
sha256_of() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }
# Ghi chú gửi API: một dòng, bỏ dấu ngoặc kép, gạch chéo ngược và ký tự điều khiển để ghép JSON an toàn; cắt 300 ký tự. Không bao giờ chứa mật khẩu (xem run_kind).
clean() { printf '%s' "$1" | tr '\n\r\t' '   ' | tr -d '"\\' | tr -cd '[:print:]' | cut -c1-300; }

api() {  # api METHOD PATH JSON → in thân phản hồi; trả mã khác 0 nếu API lỗi
  curl -fsS --max-time 30 -X "$1" -H "X-Backup-Token: $HOSO_BACKUP_TOKEN" -H 'Content-Type: application/json' \
    "$HOSO_API_URL/api/v1/ops/backups$2" -d "$3"
}

report_start() {  # đặt RUN_ID = id lần chạy, hoặc rỗng nếu API không trả lời. Không dùng $(...) để report_failed không bị mất trong shell con.
  local body
  RUN_ID=""
  if ! body="$(api POST "" "{\"kind\":\"$1\",\"status\":\"running\",\"startedAt\":\"$(now_iso)\"}" 2>&1)"; then
    echo "hoso-backup: không báo được bắt đầu ($1) về API: $(clean "$body")" >&2; report_failed=1; return 0
  fi
  RUN_ID="$(printf '%s' "$body" | sed -n 's/.*"id":"\([0-9a-fA-F-]\{36\}\)".*/\1/p')"
  [[ -n "$RUN_ID" ]] || { echo "hoso-backup: API trả lời không có id ($1)" >&2; report_failed=1; }
  return 0
}

report_finish() {  # report_finish ID STATUS BYTES LOCATION NOTE
  [[ -n "$1" ]] || return 0
  local json="{\"status\":\"$2\",\"finishedAt\":\"$(now_iso)\",\"note\":\"$(clean "$5")\""
  [[ -n "$3" ]] && json+=",\"byteSize\":$3"
  [[ -n "$4" ]] && json+=",\"location\":\"$(clean "$4")\""
  json+="}"
  api PATCH "/$1" "$json" >/dev/null 2>&1 || { echo "hoso-backup: không báo được kết quả ($2) về API" >&2; report_failed=1; }
}

# ---- Từng loại. Mỗi hàm đặt BYTES và LOCATION, in lý do ra stderr khi lỗi, trả mã khác 0 khi lỗi.
backup_database() {
  mkdir -p "$HOSO_BACKUP_DIR/db"
  local file="$HOSO_BACKUP_DIR/db/hoso-$stamp.dump"
  # -Fc: định dạng tùy chỉnh (nén, khôi phục chọn lọc). Hai schema của hệ thống: hoso và public (nhật ký migration DbUp nằm ở public). Không dump role: role do quản trị tạo.
  # LƯU Ý: pg_dump bỏ qua đối tượng của extension (unaccent, pg_trgm) nên bản dump KHÔNG tự dựng lại chúng; khi khôi phục phải tạo extension trước
  # và bỏ mục "CREATE SCHEMA public" khỏi danh sách (hoso-restore-test.sh làm đúng như vậy; cùng cách cho khôi phục thật, xem README).
  pg_dump -Fc -n hoso -n public -f "$file.part" "$PGDATABASE" || { rm -f "$file.part"; return 1; }
  pg_restore --list "$file.part" >/dev/null || { echo "bản dump không đọc lại được"; rm -f "$file.part"; return 1; }
  # Danh sách extension của CSDL nguồn (tên|schema): pg_dump không dump chúng, nên ghi lại để khôi phục dựng đúng bộ (unaccent, pg_trgm, btree_gist...).
  psql -Atq -c "select e.extname || '|' || n.nspname from pg_extension e join pg_namespace n on n.oid = e.extnamespace where e.extname <> 'plpgsql' order by 1" "$PGDATABASE" > "$file.extensions" \
    || { rm -f "$file.part" "$file.extensions"; return 1; }
  mv "$file.part" "$file"
  printf '%s  %s\n' "$(sha256_of "$file")" "$(basename "$file")" > "$file.sha256"
  BYTES="$(wc -c < "$file" | tr -d ' ')"; LOCATION="$file"
}

backup_files() {
  [[ -d "$HOSO_BLOBS_DIR" ]] || { echo "không thấy thư mục kho tệp $HOSO_BLOBS_DIR"; return 1; }
  command -v rsync >/dev/null || { echo "máy chưa cài rsync"; return 1; }
  local mirror="$HOSO_BACKUP_DIR/files/blobs"
  mkdir -p "$mirror"
  # Tệp địa chỉ theo nội dung nên không bao giờ đổi, chỉ thêm: chép phần mới, KHÔNG --delete (hủy hồ sơ hợp lệ xóa tệp ở nguồn nhưng bản sao lưu vẫn giữ theo thời hạn lưu).
  rsync -a --exclude 'tmp/' "$HOSO_BLOBS_DIR/" "$mirror/" || return 1
  local source_count mirror_count
  source_count="$(find "$HOSO_BLOBS_DIR/blobs" -type f 2>/dev/null | wc -l | tr -d ' ')"
  mirror_count="$(find "$mirror/blobs" -type f 2>/dev/null | wc -l | tr -d ' ')"
  (( mirror_count >= source_count )) || { echo "bản sao thiếu tệp: nguồn $source_count, bản sao $mirror_count"; return 1; }
  BYTES="$(( $(du -sk "$mirror" | cut -f1) * 1024 ))"; LOCATION="$mirror"
}

backup_config() {
  [[ -n "${HOSO_CONFIG_PATHS:-}" ]] || return 99      # 99 = bỏ qua loại này
  mkdir -p "$HOSO_BACKUP_DIR/config"
  local file="$HOSO_BACKUP_DIR/config/hoso-config-$stamp.tar.gz"
  # shellcheck disable=SC2086
  tar -czf "$file" $HOSO_CONFIG_PATHS 2>/dev/null || { rm -f "$file"; echo "không đóng gói được cấu hình"; return 1; }
  BYTES="$(wc -c < "$file" | tr -d ' ')"; LOCATION="$file"
}

run_kind() {  # run_kind KIND FUNCTION
  local kind="$1" fn="$2" id out code errors
  BYTES=""; LOCATION=""
  report_start "$kind"; id="$RUN_ID"
  # Chạy hàm trong shell hiện tại (để giữ BYTES/LOCATION), lấy stderr làm ghi chú lỗi: pg_dump không in mật khẩu; stdout bỏ đi.
  errors="$(mktemp)"
  "$fn" 2>"$errors" >/dev/null; code=$?
  out="$(cat "$errors")"; rm -f "$errors"
  if (( code == 99 )); then report_finish "$id" succeeded "" "" "bỏ qua: chưa cấu hình"; return 0; fi
  if (( code == 0 )); then
    report_finish "$id" succeeded "$BYTES" "$LOCATION" "$kind xong lúc $(now_iso)"
    [[ "$kind" == database && -n "$id" ]] && printf '%s\n' "$id" > "$LOCATION.run-id"      # để diễn tập khôi phục biết ghi vào lần nào
    echo "hoso-backup: $kind OK ($BYTES byte) → $LOCATION"
  else
    report_finish "$id" failed "" "" "${out:-lỗi không rõ}"
    echo "hoso-backup: $kind LỖI: ${out:-không rõ}" >&2
    backup_failed=1
  fi
}

run_kind database backup_database
run_kind files backup_files
run_kind config backup_config

# Chép ra ngoài địa điểm (tùy chọn). Lỗi ở đây không làm mất bản đã có tại chỗ nhưng phải báo.
if [[ -n "${HOSO_OFFSITE_CMD:-}" ]]; then
  if ! bash -c "$HOSO_OFFSITE_CMD"; then echo "hoso-backup: chép ra ngoài địa điểm LỖI" >&2; backup_failed=1; fi
fi

# Dọn bản CSDL cũ: quá hạn lưu và không nằm trong 3 bản mới nhất.
if [[ -d "$HOSO_BACKUP_DIR/db" ]]; then
  ls -1t "$HOSO_BACKUP_DIR"/db/hoso-*.dump 2>/dev/null | tail -n +4 | while read -r old; do
    if [[ -n "$(find "$old" -mtime +"$retention_days" 2>/dev/null)" ]]; then rm -f "$old" "$old.sha256" "$old.run-id" "$old.extensions"; fi
  done
fi

(( backup_failed )) && exit 1
(( report_failed )) && exit 2
exit 0
