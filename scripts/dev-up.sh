#!/usr/bin/env bash
# OPS-07. Chạy đủ luồng AI trên máy dev: API .NET (5080), worker AI, web Next (3000), tất cả nối vào CSDL hoso_dev.
#
#   scripts/dev-up.sh init     chuẩn bị một lần: cho phép hai role CSDL đăng nhập (mật khẩu dev) và tạo ai-worker/.env nếu chưa có
#   scripts/dev-up.sh start    chạy API, worker, web (tách khỏi phiên terminal; chạy lại thì bỏ qua phần đang chạy)
#   scripts/dev-up.sh status   cho biết từng phần có chạy và trả lời không
#   scripts/dev-up.sh stop     dừng cả ba (chờ tối đa 30 giây cho mỗi phần thoát êm, quá hạn thì buộc dừng)
#   scripts/dev-up.sh restart  dừng rồi chạy lại (dùng khi sửa mã worker hoặc đổi ai-worker/.env)
#   scripts/dev-up.sh logs     đường dẫn nhật ký
#   scripts/dev-up.sh ai fake  worker dùng AI GIẢ (không cần mô hình, máy AI ở nơi khác): chọn loại theo tiêu đề, trích trường có
#                              trích dẫn, vùng nguồn, độ tin cậy; chỉ chạy lại worker. Chỉnh độ chậm/lỗi/gói nhiều giấy tờ trong ai-worker/.env
#   scripts/dev-up.sh ai real  worker dùng mô hình thật trên máy này (mac-mlx)
#   scripts/dev-up.sh ai       cho biết worker đang dùng AI nào
#
# Không áp migration: dùng backend/scripts/migrate-hoso-dev.sh (xem trước, rồi --apply) sau khi sao lưu hoso_dev.
# Chỉ dùng cho MÁY DEV: mật khẩu role ở đây là mật khẩu dev (khớp appsettings.Development.json), không dùng ở nơi khác.
set -euo pipefail

root="$(cd "$(dirname "$0")/.." && pwd)"
run_dir="$root/data/dev-run"
mkdir -p "$run_dir"
export PATH="/usr/local/share/dotnet:$PATH" DOTNET_CLI_TELEMETRY_OPTOUT=1 DOTNET_NOLOGO=1 DOTNET_ROLL_FORWARD=Major

PG_HOST="${HOSO_DEV_PG_HOST:-127.0.0.1}"
PG_PORT="${HOSO_DEV_PG_PORT:-5432}"
PG_DB="${HOSO_DEV_DB:-hoso_dev}"
PG_ADMIN="${HOSO_DEV_PG_ADMIN:-quoc}"          # siêu người dùng cục bộ của Homebrew PostgreSQL, chỉ dùng cho `init`
DEV_PASSWORD="${HOSO_DEV_ROLE_PASSWORD:-hoso_dev_only}"
API_PORT=5080
WEB_PORT=3000
WORKER_PORT=9108

is_up() { local pidfile="$run_dir/$1.pid"; [[ -f "$pidfile" ]] && kill -0 "$(cat "$pidfile")" 2>/dev/null; }

# Chạy lệnh tách khỏi phiên (macOS không có setsid): tiến trình sống tiếp khi đóng terminal, log ra tệp.
detach() {
  local name="$1"; shift
  python3 - "$run_dir/$name.pid" "$run_dir/$name.log" "$@" <<'PY'
import subprocess, sys
pidfile, logfile, *cmd = sys.argv[1:]
log = open(logfile, "ab")
p = subprocess.Popen(cmd, stdout=log, stderr=subprocess.STDOUT, stdin=subprocess.DEVNULL, start_new_session=True)
open(pidfile, "w").write(str(p.pid))
PY
}

http_ok() { curl -fsS -o /dev/null --max-time 3 "$1" 2>/dev/null; }

ai_profile() { sed -n 's/^HOSO_AI_PROFILE=//p' "$root/ai-worker/.env" 2>/dev/null | tail -1; }

start_worker() {
  if is_up worker; then echo "Worker đang chạy (pid $(cat "$run_dir/worker.pid"), AI: $(ai_profile))"; return; fi
  echo "Chạy worker AI ($(ai_profile))…"
  if lsof -nP -iTCP:"$WORKER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
    echo "Cổng $WORKER_PORT đang có tiến trình khác giữ (worker cũ chưa thoát?). Không chạy worker mới: dừng nó trước (scripts/dev-up.sh stop)." >&2
    exit 75
  fi
  detach worker "$root/ai-worker/deploy/run-worker.sh" run
}

# Đổi AI của worker trên máy dev rồi chỉ chạy lại worker (API, web giữ nguyên).
cmd_ai() {
  local env_file="$root/ai-worker/.env" want
  [[ -r "$env_file" ]] || { echo "Chưa có ai-worker/.env: chạy scripts/dev-up.sh init trước." >&2; exit 78; }
  case "${1:-}" in
    "") echo "Worker đang cấu hình AI: $(ai_profile) (ai-worker/.env)"; return ;;
    fake) want=fake ;;
    real|mac-mlx) want=mac-mlx ;;
    *) echo "Dùng: scripts/dev-up.sh ai fake|real" >&2; exit 64 ;;
  esac
  if grep -q '^HOSO_AI_PROFILE=' "$env_file"; then
    sed -i '' "s/^HOSO_AI_PROFILE=.*/HOSO_AI_PROFILE=$want/" "$env_file"
  else
    echo "HOSO_AI_PROFILE=$want" >>"$env_file"
  fi
  if [[ "$want" == fake ]] && ! grep -q '^HOSO_AI_FAKE_PAGE_SECONDS=' "$env_file"; then
    cat >>"$env_file" <<'EOF'

# AI giả (scripts/dev-up.sh ai fake). Chỉ có tác dụng khi HOSO_AI_PROFILE=fake; sửa xong chạy lại: scripts/dev-up.sh ai fake
# Chờ mỗi trang OCR giả và ở bước phân loại (giây), để thấy tiến độ, hàng đợi, nâng mức qua SSE
HOSO_AI_FAKE_PAGE_SECONDS=1
HOSO_AI_FAKE_CLASSIFY_SECONDS=2
# 0..1: tỉ lệ trang OCR lỗi, để thử cảnh báo và "đọc lại trang"
HOSO_AI_FAKE_FAIL_RATE=0
# >0: PDF từ chừng này trang luôn báo gói nhiều giấy tờ (thử tách văn bản với bản quét); PDF có lớp chữ thì tự nhận theo tiêu đề từng trang
HOSO_AI_FAKE_MIXED_FROM_PAGES=0
EOF
  fi
  # Máy AI riêng nối cùng CSDL thì hai worker chia nhau việc: kết quả thật và giả lẫn vào nhau.
  local remote
  remote="$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN" -d "$PG_DB" -Atc \
    "SELECT count(*) FROM pg_stat_activity WHERE usename = 'hoso_ai_worker' AND client_addr IS NOT NULL AND host(client_addr) NOT IN ('127.0.0.1','::1')" 2>/dev/null || echo 0)"
  if [[ "${remote:-0}" != 0 ]]; then
    echo "Chú ý: có $remote kết nối worker AI từ máy khác vào $PG_DB. Hai worker sẽ chia nhau việc; tắt một bên nếu cần kết quả đồng nhất." >&2
  fi
  stop_one worker
  start_worker
  echo "Worker dùng AI: $want. Kiểm tra: curl -s http://127.0.0.1:$WORKER_PORT/health"
}

cmd_init() {
  echo "== Cho phép role CSDL đăng nhập (mật khẩu dev) =="
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_ADMIN" -d "$PG_DB" -v ON_ERROR_STOP=1 -q <<SQL
ALTER ROLE hoso_api LOGIN PASSWORD '$DEV_PASSWORD';
ALTER ROLE hoso_ai_worker LOGIN PASSWORD '$DEV_PASSWORD';
SQL
  local env_file="$root/ai-worker/.env"
  if [[ -e "$env_file" ]]; then
    echo "== ai-worker/.env đã có, giữ nguyên =="
  else
    echo "== Tạo ai-worker/.env =="
    cat >"$env_file" <<EOF
# Tạo bởi scripts/dev-up.sh init (máy dev). Không đưa vào repo.
HOSO_AI_PROFILE=mac-mlx
HOSO_AI_DATABASE_URL=postgresql://hoso_ai_worker:$DEV_PASSWORD@$PG_HOST:$PG_PORT/$PG_DB
HOSO_AI_STORAGE_ROOT=$root/data/blobs
HOSO_AI_WORK_ROOT=$root/data/ai-work
DOCUMENT_AI_HOME=${DOCUMENT_AI_HOME:-/Volumes/quocDisk/AI/paddleocr}
HOSO_AI_CLASSIFIER_MODEL=Qwen3-4B-Instruct-2507-ifstruct-4bit
HOSO_AI_MODEL_BUDGET_GB=7
EOF
  fi
  echo "Xong. Chạy: scripts/dev-up.sh start"
}

cmd_start() {
  [[ -r "$root/ai-worker/.env" ]] || { echo "Chưa có ai-worker/.env: chạy scripts/dev-up.sh init trước." >&2; exit 78; }

  if is_up api; then echo "API đang chạy (pid $(cat "$run_dir/api.pid"))"; else
    echo "Chạy API ở cổng ${API_PORT} …"
    # hoso_api: role tối thiểu quyền (migration 020). Storage:Root trùng HOSO_AI_STORAGE_ROOT của worker.
    # Giới hạn mặc định 300 yêu cầu/phút mỗi người; E2E dùng chung MỘT tài khoản (dev_admin) và mỗi trang gọi nhiều API nên chạm giới hạn (429).
    # Chỉ nới ở máy dev; sản xuất giữ cấu hình thật (Limits:RequestsPerMinute).
    ASPNETCORE_ENVIRONMENT=Development \
    ConnectionStrings__HoSo="Host=$PG_HOST;Port=$PG_PORT;Database=$PG_DB;Username=hoso_api;Password=$DEV_PASSWORD" \
    Storage__Root="$root/data/blobs" \
    Limits__RequestsPerMinute="${HOSO_DEV_REQUESTS_PER_MINUTE:-3000}" \
    detach api dotnet run --project "$root/backend/src/HoSoSo.Api" --launch-profile http
  fi

  start_worker

  if is_up web; then echo "Web đang chạy (pid $(cat "$run_dir/web.pid"))"; else
    echo "Chạy web ở cổng ${WEB_PORT} …"
    # Next chuyển tiếp /api/* sang API nên cookie phiên và luồng SSE cùng origin với trang.
    (cd "$root/frontend" && HOSO_API_INTERNAL_URL="http://localhost:$API_PORT" HOSO_SESSION_COOKIE=hoso_session_dev \
      detach web npx next dev --port "$WEB_PORT")
  fi
  echo "Khởi động xong. Xem trạng thái: scripts/dev-up.sh status (API cần vài chục giây để biên dịch lần đầu)."
}

row() {  # tên, đã chạy?, trả lời?
  printf '%-8s %-12s %s\n' "$1" "$2" "$3"
}

cmd_status() {
  local ok=0
  echo "AI của worker: $(ai_profile) (đổi: scripts/dev-up.sh ai fake|real)"
  for name in api worker web; do
    local state="không chạy" reply="-"
    if is_up "$name"; then state="đang chạy ($(cat "$run_dir/$name.pid"))"; fi
    case "$name" in
      api) url="http://localhost:$API_PORT/health/ready" ;;
      worker) url="http://127.0.0.1:$WORKER_PORT/health" ;;
      web) url="http://localhost:$WEB_PORT/dang-nhap" ;;
    esac
    if http_ok "$url"; then reply="trả lời $url"; else ok=1; reply="chưa trả lời $url"; fi
    row "$name" "$state" "$reply"
  done
  return $ok
}

stop_one() {
  local name="$1"
  if is_up "$name"; then
    local pid pgid waited=0
    pid="$(cat "$run_dir/$name.pid")"
    pgid="$(ps -o pgid= -p "$pid" | tr -d ' ')"
    # Dừng cả nhóm tiến trình (dotnet run, next dev sinh tiến trình con). Worker xong trang đang đọc rồi mới thoát.
    kill -TERM "-$pgid" 2>/dev/null || kill -TERM "$pid" 2>/dev/null || true
    while kill -0 "$pid" 2>/dev/null && (( waited < 30 )); do sleep 1; waited=$((waited + 1)); done
    if kill -0 "$pid" 2>/dev/null; then
      echo "$name chưa thoát sau 30 giây: buộc dừng (kill -9). Nếu là worker, xem ngăn xếp bằng kill -USR1 trước khi dừng lần sau."
      kill -KILL "-$pgid" 2>/dev/null || kill -KILL "$pid" 2>/dev/null || true
    fi
    echo "Đã dừng $name"
  fi
  rm -f "$run_dir/$name.pid"
}

cmd_stop() {
  for name in web worker api; do stop_one "$name"; done
}

case "${1:-}" in
  init) cmd_init ;;
  start) cmd_start ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  ai) cmd_ai "${2:-}" ;;
  logs) ls -1 "$run_dir"/*.log 2>/dev/null || echo "Chưa có nhật ký ở $run_dir" ;;
  *) sed -n '2,17p' "$0"; exit 64 ;;
esac
