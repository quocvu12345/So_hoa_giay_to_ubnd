#!/bin/zsh
# Xuất tài liệu OpenAPI của API vào frontend/src/api/openapi.json (BE-11). Không cần CSDL: chỉ dựng bảng định tuyến.
# Dùng: backend/scripts/export-openapi.sh   (chạy từ bất kỳ đâu)
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
OUT="$ROOT/frontend/src/api/openapi.json"
PORT="${PORT:-5099}"
mkdir -p "$(dirname "$OUT")"
export ASPNETCORE_ENVIRONMENT=Development ASPNETCORE_URLS="http://127.0.0.1:$PORT" Background__Enabled=false \
       ConnectionStrings__HoSo="Host=127.0.0.1;Port=1;Database=none" DOTNET_ROLL_FORWARD="${DOTNET_ROLL_FORWARD:-Major}"
cd "$ROOT/backend"
dotnet build src/HoSoSo.Api -v q --nologo >/dev/null
dotnet run --no-build --no-launch-profile --project src/HoSoSo.Api >/dev/null 2>&1 &
PID=$!
trap 'kill $PID 2>/dev/null || true' EXIT
for _ in $(seq 1 40); do curl -sf "http://127.0.0.1:$PORT/health/live" >/dev/null && break; sleep 0.5; done
curl -sf "http://127.0.0.1:$PORT/openapi/v1.json" -o "$OUT"
python3 -c "import json,sys; d=json.load(open('$OUT')); print('đã ghi', '$OUT', '·', len(d['paths']), 'đường dẫn')"
