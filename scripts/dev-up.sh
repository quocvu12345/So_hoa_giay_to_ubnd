#!/usr/bin/env bash
# OPS-07. Chạy đủ luồng AI trên máy dev: API .NET (5080), worker AI, web Next (3000), tất cả nối vào CSDL hoso_dev.
#
#   scripts/dev-up.sh init     chuẩn bị một lần: cho phép hai role CSDL đăng nhập (mật khẩu dev) và tạo ai-worker/.env nếu chưa có
#   scripts/dev-up.sh start    chạy API, worker, web (tách khỏi phiên terminal; chạy lại thì bỏ qua phần đang chạy)
#   scripts/dev-up.sh status   cho biết từng phần có chạy và trả lời không
#   scripts/dev-up.sh stop     dừng cả ba (chờ tối đa 30 giây cho mỗi phần thoát êm, quá hạn thì buộc dừng)
#   scripts/dev-up.sh restart  dừng rồi chạy lại (dùng khi sửa mã worker hoặc đổi ai-worker/.env)
#   scripts/dev-up.sh logs     đường dẫn nhật ký
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
    ASPNETCORE_ENVIRONMENT=Development \
    ConnectionStrings__HoSo="Host=$PG_HOST;Port=$PG_PORT;Database=$PG_DB;Username=hoso_api;Password=$DEV_PASSWORD" \
    Storage__Root="$root/data/blobs" \
    detach api dotnet run --project "$root/backend/src/HoSoSo.Api" --launch-profile http
  fi

  if is_up worker; then echo "Worker đang chạy (pid $(cat "$run_dir/worker.pid"))"; else
    echo "Chạy worker AI…"
    if lsof -nP -iTCP:"$WORKER_PORT" -sTCP:LISTEN >/dev/null 2>&1; then
      echo "Cổng $WORKER_PORT đang có tiến trình khác giữ (worker cũ chưa thoát?). Không chạy worker mới: dừng nó trước (scripts/dev-up.sh stop)." >&2
      exit 75
    fi
    detach worker "$root/ai-worker/deploy/run-worker.sh" run
  fi

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

cmd_stop() {
  for name in web worker api; do
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
  done
}

case "${1:-}" in
  init) cmd_init ;;
  start) cmd_start ;;
  status) cmd_status ;;
  stop) cmd_stop ;;
  restart) cmd_stop; cmd_start ;;
  logs) ls -1 "$run_dir"/*.log 2>/dev/null || echo "Chưa có nhật ký ở $run_dir" ;;
  *) sed -n '2,13p' "$0"; exit 64 ;;
esac
