#!/usr/bin/env bash
# Diễn tập khôi phục (OPS-04): khôi phục bản CSDL mới nhất vào một CSDL tạm, kiểm tra, lập biên bản, rồi xóa CSDL tạm.
# Đạt thì ghi nhận về API (restoreTestedAt của lần sao lưu đó, BE-89) để cảnh báo "chưa diễn tập khôi phục" tắt.
# Kiểm tra: (1) mã băm bản dump khớp; (2) pg_restore chạy hết không lỗi; (3) phiên bản migration và số dòng các bảng chính; (4) MỌI tệp mà bảng files tham chiếu
# (trừ tệp đã hủy hợp lệ) đều có trong bản sao kho tệp. Mã thoát: 0 đạt · 1 không đạt · 78 thiếu cấu hình.
# Dùng: hoso-restore-test.sh [đường-dẫn-bản-dump]   (mặc định: bản mới nhất trong $HOSO_BACKUP_DIR/db)
set -uo pipefail

env_file="${HOSO_BACKUP_ENV:-/etc/hoso/backup.env}"
[[ -r "$env_file" ]] || { echo "hoso-restore-test: không đọc được $env_file" >&2; exit 78; }
set -a; . "$env_file"; set +a
for var in HOSO_BACKUP_DIR HOSO_API_URL HOSO_BACKUP_TOKEN; do
  [[ -n "${!var:-}" ]] || { echo "hoso-restore-test: thiếu $var" >&2; exit 78; }
done

dump="${1:-$(ls -1t "$HOSO_BACKUP_DIR"/db/hoso-*.dump 2>/dev/null | head -n 1)}"
[[ -n "$dump" && -f "$dump" ]] || { echo "hoso-restore-test: không thấy bản dump để thử" >&2; exit 78; }

# Người dùng có quyền tạo/xóa CSDL tạm (có thể khác role sao lưu).
admin_user="${HOSO_RESTORE_PGUSER:-${PGUSER:-}}"
scratch="hoso_restore_$(date +%Y%m%d%H%M%S)_$$"
report="$HOSO_BACKUP_DIR/restore-tests/bien-ban-$(date +%Y%m%d-%H%M).txt"
mkdir -p "$(dirname "$report")"
started=$(date +%s)
problems=()
lines=()
log() { lines+=("$1"); echo "$1"; }
pg() { psql ${PGHOST:+-h "$PGHOST"} ${PGPORT:+-p "$PGPORT"} ${admin_user:+-U "$admin_user"} "$@"; }
cleanup() { pg -d postgres -Atqc "DROP DATABASE IF EXISTS \"$scratch\"" >/dev/null 2>&1; }
trap cleanup EXIT

sha256_of() { if command -v sha256sum >/dev/null; then sha256sum "$1" | cut -d' ' -f1; else shasum -a 256 "$1" | cut -d' ' -f1; fi; }

log "BIÊN BẢN DIỄN TẬP KHÔI PHỤC · $(date '+%d/%m/%Y %H:%M')"
log "Bản dump: $(basename "$dump") ($(wc -c < "$dump" | tr -d ' ') byte)"

# 1. Mã băm
if [[ -f "$dump.sha256" ]]; then
  expected="$(cut -d' ' -f1 "$dump.sha256")"
  if [[ "$(sha256_of "$dump")" == "$expected" ]]; then log "Mã băm SHA-256: khớp"; else problems+=("mã băm bản dump KHÔNG khớp (tệp bị hỏng hoặc bị sửa)"); fi
else
  problems+=("không có $(basename "$dump").sha256 để đối chiếu")
fi

# 2. Khôi phục vào CSDL tạm (không đụng CSDL thật). Vẫn khôi phục dù mã băm lệch để biên bản nêu đủ vấn đề.
if ! pg -d postgres -Atqc "CREATE DATABASE \"$scratch\"" >/dev/null 2>&1; then
  problems+=("không tạo được CSDL tạm $scratch (cần quyền CREATEDB: đặt HOSO_RESTORE_PGUSER)")
else
  restore_started=$(date +%s)
  # Extension nằm ngoài bản dump (pg_dump không dump đối tượng của extension): tạo đúng bộ đã ghi lúc sao lưu (tên|schema), như khi dựng máy chủ mới.
  if [[ -f "$dump.extensions" ]]; then
    while IFS='|' read -r ext schema; do
      [[ -n "$ext" ]] || continue
      pg -d "$scratch" -Atqc "CREATE EXTENSION IF NOT EXISTS \"$ext\" WITH SCHEMA \"$schema\"" >/dev/null 2>&1 \
        || problems+=("không tạo được extension $ext (cần gói postgresql-contrib trên máy diễn tập)")
    done < "$dump.extensions"
  else
    problems+=("không có $(basename "$dump").extensions: không biết cần dựng extension nào trước khi khôi phục")
  fi
  # Bản dump có mục CREATE SCHEMA public mà CSDL mới đã có sẵn: bỏ mục đó khỏi danh sách khôi phục (-L), giữ mọi thứ khác.
  list="$(mktemp)"
  pg_restore --list "$dump" | grep -v -E '(^|[ ;])SCHEMA - public( |$)|COMMENT - SCHEMA public' > "$list"
  # --no-owner/--no-privileges: máy diễn tập không nhất thiết có đủ role của máy chủ thật.
  if pg_restore -L "$list" --no-owner --no-privileges --exit-on-error ${PGHOST:+-h "$PGHOST"} ${PGPORT:+-p "$PGPORT"} ${admin_user:+-U "$admin_user"} -d "$scratch" "$dump" 2>"$report.err"; then
    log "Khôi phục: xong trong $(( $(date +%s) - restore_started )) giây"
  else
    problems+=("pg_restore lỗi: $(head -c 300 "$report.err" | tr '\n' ' ')")
  fi
  rm -f "$report.err" "$list"
fi

# 3. Kiểm tra nội dung
if (( ${#problems[@]} == 0 )); then
  last="$(pg -d "$scratch" -Atqc "select max(scriptname) from public.hoso_schema_versions" 2>/dev/null)"
  [[ -n "$last" ]] && log "Migration mới nhất trong bản khôi phục: $last" || problems+=("không đọc được lịch sử migration")
  for table in users dossiers documents files audit_events; do
    count="$(pg -d "$scratch" -Atqc "select count(*) from hoso.$table" 2>/dev/null)"
    [[ -n "$count" ]] && log "Số dòng $table: $count" || problems+=("không đếm được bảng $table")
  done
fi

# 4. Mọi tệp được tham chiếu phải có trong bản sao kho tệp
if (( ${#problems[@]} == 0 )); then
  [[ -d "$HOSO_BACKUP_DIR/files/blobs" ]] || problems+=("không có bản sao kho tệp ($HOSO_BACKUP_DIR/files/blobs): chưa thể kiểm tệp")
fi
if (( ${#problems[@]} == 0 )); then
  total=0; missing=0
  while IFS= read -r key; do
    [[ -n "$key" ]] || continue
    total=$((total + 1))
    [[ -f "$HOSO_BACKUP_DIR/files/blobs/$key" ]] || { missing=$((missing + 1)); (( missing <= 5 )) && log "  thiếu tệp: $key"; }
  done < <(pg -d "$scratch" -Atqc "select distinct storage_key from hoso.files where storage_key is not null and disposed_at is null" 2>/dev/null)
  log "Tệp được tham chiếu: $total · thiếu trong bản sao kho tệp: $missing"
  (( missing == 0 )) || problems+=("$missing tệp được CSDL tham chiếu nhưng không có trong bản sao kho tệp")
fi

elapsed=$(( $(date +%s) - started ))
if (( ${#problems[@]} == 0 )); then verdict="ĐẠT"; else verdict="KHÔNG ĐẠT"; fi
log "Tổng thời gian: $elapsed giây"
for p in ${problems[@]+"${problems[@]}"}; do log "Vấn đề: $p"; done   # cú pháp ${a[@]+...} để bash 3.2 (macOS) không báo lỗi với mảng rỗng
log "Kết luận: $verdict"
printf '%s\n' "${lines[@]}" > "$report"
echo "Biên bản: $report"

if [[ "$verdict" == "ĐẠT" ]]; then
  run_id="$(cat "$dump.run-id" 2>/dev/null || true)"
  if [[ -n "$run_id" ]]; then
    curl -fsS --max-time 30 -X PATCH -H "X-Backup-Token: $HOSO_BACKUP_TOKEN" -H 'Content-Type: application/json' \
      "$HOSO_API_URL/api/v1/ops/backups/$run_id" \
      -d "{\"restoreTestedAt\":\"$(date -u +%Y-%m-%dT%H:%M:%SZ)\",\"note\":\"Diễn tập khôi phục đạt trong ${elapsed} giây\"}" >/dev/null \
      || { echo "hoso-restore-test: đạt nhưng không ghi nhận được về API" >&2; }
  else
    echo "hoso-restore-test: không có $(basename "$dump").run-id nên chưa ghi nhận về API" >&2
  fi
  exit 0
fi
exit 1
