#!/usr/bin/env bash
# Nạp TÀI KHOẢN THỬ (GIẢ LẬP) cho CSDL dev `hoso_dev`: mỗi phòng một chuyên viên và một trưởng phòng/ban, văn thư UBND và HĐND, Chủ tịch UBND,
# lãnh đạo HĐND, quản trị kỹ thuật, thêm một chuyên viên Hạ tầng thứ hai. Để thử các luồng nhiều người (chuyên viên trình → trưởng phòng
# kiểm tra → chủ tịch cho ý kiến → văn thư lưu) bằng đúng người của từng bước, chọn ở trang "Đăng nhập dev".
#
# Chỉ lấy hai khối `users` và `user_roles` của migration 004_seed_demo_optional.sql (26 người, đều is_demo, ON CONFLICT DO NOTHING nên chạy
# lại không sao). KHÔNG nạp giấy tờ, hồ sơ giả lập của 004 (hoso_dev cố ý không có chúng); muốn có cả hồ sơ giả lập:
# OPTIONAL_SEEDS="004" backend/scripts/migrate-hoso-dev.sh --apply (sau khi sao lưu).
#
#   backend/scripts/seed-dev-accounts.sh            liệt kê sẽ thêm ai, chưa ghi gì
#   backend/scripts/seed-dev-accounts.sh --apply    ghi vào hoso_dev
# Chỉ dùng cho máy dev; đăng nhập bằng tài khoản giả lập chỉ mở ở môi trường Development (/api/v1/auth/dev-login).
set -euo pipefail

here="$(cd "$(dirname "$0")/.." && pwd)"
seed="$here/database/migrations/004_seed_demo_optional.sql"
PG_HOST="${HOSO_DEV_PG_HOST:-127.0.0.1}" PG_PORT="${HOSO_DEV_PG_PORT:-5432}" PG_DB="${HOSO_DEV_DB:-hoso_dev}" PG_ADMIN="${HOSO_DEV_PG_ADMIN:-$(whoami)}"
psql_dev() { psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN" -d "$PG_DB" -v ON_ERROR_STOP=1 "$@"; }

# Hai khối INSERT, mỗi khối kết thúc bằng "ON CONFLICT DO NOTHING;".
sql="$(sed -n '/^INSERT INTO users /,/^ON CONFLICT DO NOTHING;/p; /^INSERT INTO user_roles /,/^ON CONFLICT DO NOTHING;/p' "$seed")"
[[ "$(grep -c '^INSERT INTO' <<<"$sql")" == 2 ]] || { echo "Không tách được hai khối users/user_roles từ $seed" >&2; exit 1; }
usernames="$(grep -oE "^\('[0-9a-f-]{36}','[a-z0-9_.]+'" <<<"$sql" | sed -E "s/.*,'//; s/'$//" | sort)"

existing="$(psql_dev -Atc "SELECT username FROM hoso.users WHERE is_demo" | sort)"
missing="$(comm -23 <(echo "$usernames") <(echo "$existing"))"
echo "== $PG_DB: $(wc -l <<<"$usernames" | tr -d ' ') tài khoản thử trong 004, đã có $(comm -12 <(echo "$usernames") <(echo "$existing") | grep -c . || true)"
[[ -n "$missing" ]] && echo "Sẽ thêm: $(tr '\n' ' ' <<<"$missing")"

if [[ "${1:-}" != "--apply" ]]; then
  echo "Chưa ghi gì. Đúng ý thì chạy lại với --apply."
  exit 0
fi

{ echo "BEGIN;"; echo "SET search_path = hoso, pg_catalog;"; echo "$sql"; echo "COMMIT;"; } | psql_dev -q
echo "== Đã nạp. Tài khoản thử và phân công:"
psql_dev -c "
  SELECT u.username AS \"tài khoản\", r.name AS \"vai trò\", coalesce(d.name || ' · ' || o.name, o.name, '(toàn hệ thống)') AS \"phạm vi\"
  FROM hoso.users u JOIN hoso.user_roles ur ON ur.user_id = u.id JOIN hoso.roles r ON r.code = ur.role_code
  LEFT JOIN hoso.organizations o ON o.code = ur.organization_code
  LEFT JOIN hoso.departments d ON d.code = ur.department_code
  WHERE u.is_demo AND u.username LIKE 'demo\_%' AND (ur.valid_until IS NULL OR ur.valid_until > now())
  ORDER BY array_position(ARRAY['employee','manager','clerk','chair','council','technical_admin'], ur.role_code), 3, 1"
