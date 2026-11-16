#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SAM3_HOME="${SAM3_HOME:-/Volumes/quocDisk/AI/sam3}"
export UV_CACHE_DIR="$SAM3_HOME/cache/uv"
export UV_PYTHON_INSTALL_DIR="$SAM3_HOME/python"
export PIP_CACHE_DIR="$SAM3_HOME/cache/pip"
export TMPDIR="$SAM3_HOME/tmp"
TOOLS_ROOT="$(dirname "$SAM3_HOME")/tools"
UV="$TOOLS_ROOT/uv-env/bin/uv"
mkdir -p "$TMPDIR" "$SAM3_HOME/models" "$TOOLS_ROOT"
if [[ ! -x "$UV" ]]; then
  python3 -m venv "$TOOLS_ROOT/uv-env"
  "$TOOLS_ROOT/uv-env/bin/python" -m pip install uv==0.13.7
fi
"$UV" python install 3.12
if [[ ! -x "$SAM3_HOME/venv/bin/python" ]]; then
  "$UV" venv --python 3.12 "$SAM3_HOME/venv"
fi
"$UV" pip install --python "$SAM3_HOME/venv/bin/python" -r "$PROJECT_ROOT/sam3_service/requirements.txt"
if [[ ! -d "$SAM3_HOME/source" ]]; then
  git clone https://github.com/facebookresearch/sam3.git "$SAM3_HOME/source"
  git -C "$SAM3_HOME/source" checkout f92a5efc4001ebfe9d050d43e61f6fb10e02d73c
fi
echo "Đã cài engine SAM 3 trong Transformers; mã Meta lưu tại $SAM3_HOME/source."
echo "Tiếp theo: ./scripts/sam3.sh login và ./scripts/sam3.sh download"
"$PROJECT_ROOT/scripts/sam3.sh" status
