#!/usr/bin/env bash
# Chạy migration cho CSDL dev `hoso_dev` mà KHÔNG nạp dữ liệu mẫu 004 (người dùng và hồ sơ GIẢ LẬP).
#
# Vì sao có script này: ở môi trường Development, `migrate` mặc định chạy cả các tệp *_optional.sql chưa có trong nhật ký.
# `hoso_dev` cố ý không có 004 (xem docs/tasks/backend.md), nên chạy `migrate` trần sẽ nạp lại 004. Script này đặt
# Database:OptionalSeeds trỏ vào tiền tố không tồn tại để bỏ qua mọi tệp *_optional.sql mới.
#
# Mặc định chỉ LIỆT KÊ việc sẽ làm. Thêm --apply để chạy thật (nhớ sao lưu: pg_dump -Fc -n hoso -n public hoso_dev).
# Muốn nạp một tệp tùy chọn có chủ đích: OPTIONAL_SEEDS="021" scripts/migrate-hoso-dev.sh --apply
set -euo pipefail

cd "$(dirname "$0")/.."
export PATH="/usr/local/share/dotnet:$PATH" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_ROLL_FORWARD=Major
export ConnectionStrings__HoSoMigrator="${HOSO_DEV_MIGRATOR:-Host=127.0.0.1;Port=5432;Database=hoso_dev;Username=quoc}"
export Database__OptionalSeeds__0="${OPTIONAL_SEEDS:-KHONG-CHAY}"

echo "== Việc sẽ chạy trên: ${ConnectionStrings__HoSoMigrator%%;Username*} =="
dotnet run --project src/HoSoSo.Api -- migrate --dry-run 2>&1 | grep -v '^{"@t"' | grep -v '^Using launch settings' || true

if [[ "${1:-}" != "--apply" ]]; then
  echo "Chưa chạy gì. Xem danh sách trên; đúng ý thì chạy lại với --apply."
  exit 0
fi

echo "== Áp dụng =="
dotnet run --project src/HoSoSo.Api -- migrate 2>&1 | grep -v '^{"@t"' | grep -v '^Using launch settings'
