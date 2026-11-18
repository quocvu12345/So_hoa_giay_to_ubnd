#!/usr/bin/env bash
# Chạy worker AI từ tệp cấu hình môi trường. launchd và systemd cùng gọi script này (hoặc systemd dùng EnvironmentFile), nên cách nạp cấu hình chỉ có một.
#   deploy/run-worker.sh            → hoso_ai run (vòng lấy việc)
#   deploy/run-worker.sh status     → kiểm tra cấu hình và mô hình rồi thoát
# Biến: HOSO_AI_ENV_FILE (mặc định ai-worker/.env), HOSO_AI_PYTHON (mặc định $DOCUMENT_AI_HOME/venv/bin/python).
# Mã thoát 78 (EX_CONFIG) khi thiếu cấu hình: systemd không khởi động lại vô ích (RestartPreventExitStatus=78); launchd vẫn thử lại mỗi 30 giây. Xem README mục "Chạy như dịch vụ".
set -euo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
env_file="${HOSO_AI_ENV_FILE:-$here/.env}"
if [[ ! -r "$env_file" ]]; then
  echo "hoso-ai: không đọc được tệp cấu hình $env_file (sao .env.example thành .env rồi chỉnh)." >&2
  exit 78
fi

set -a
# shellcheck disable=SC1090
. "$env_file"
set +a

python="${HOSO_AI_PYTHON:-${DOCUMENT_AI_HOME:-}/venv/bin/python}"
# AI giả không cần mô hình: máy dev không có venv mô hình thì dùng venv nhẹ ai-worker/.venv
# (tạo một lần: python3 -m venv ai-worker/.venv && ai-worker/.venv/bin/pip install -e ai-worker).
if [[ ! -x "$python" && -z "${HOSO_AI_PYTHON:-}" && "${HOSO_AI_PROFILE:-}" == fake && -x "$here/.venv/bin/python" ]]; then
  python="$here/.venv/bin/python"
fi
if [[ ! -x "$python" ]]; then
  echo "hoso-ai: không thấy Python của worker ở $python (đặt HOSO_AI_PYTHON hoặc DOCUMENT_AI_HOME)." >&2
  [[ "${HOSO_AI_PROFILE:-}" == fake ]] && echo "hoso-ai: AI giả chỉ cần venv nhẹ: python3 -m venv ai-worker/.venv && ai-worker/.venv/bin/pip install -e ai-worker" >&2
  exit 78
fi

export PYTHONPATH="$here/src:$here/..${PYTHONPATH:+:$PYTHONPATH}"
export PYTHONUNBUFFERED=1
cd "$here"
exec "$python" -m hoso_ai "${@:-run}"
