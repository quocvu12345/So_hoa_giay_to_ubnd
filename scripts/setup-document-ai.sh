#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DOCUMENT_AI_HOME="${DOCUMENT_AI_HOME:-/Volumes/quocDisk/AI/paddleocr}"
export UV_CACHE_DIR="$DOCUMENT_AI_HOME/cache/uv"
export TMPDIR="$DOCUMENT_AI_HOME/tmp"
UV="/Volumes/quocDisk/AI/tools/uv-env/bin/uv"
BASE_PYTHON="/Volumes/quocDisk/AI/sam3/venv/bin/python"
mkdir -p "$TMPDIR" "$DOCUMENT_AI_HOME/models"
if [[ ! -x "$DOCUMENT_AI_HOME/venv/bin/python" ]]; then
  "$UV" venv --python "$BASE_PYTHON" "$DOCUMENT_AI_HOME/venv"
fi
"$UV" pip install --python "$DOCUMENT_AI_HOME/venv/bin/python" -r "$PROJECT_ROOT/document_ai/requirements.lock.txt"
cd "$PROJECT_ROOT"
exec "$DOCUMENT_AI_HOME/venv/bin/python" -m document_ai.download
