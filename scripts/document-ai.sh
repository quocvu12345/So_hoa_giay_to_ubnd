#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DOCUMENT_AI_HOME="${DOCUMENT_AI_HOME:-/Volumes/quocDisk/AI/paddleocr}"
cd "$PROJECT_ROOT"
AI_PYTHON="$DOCUMENT_AI_HOME/venv/bin/python"
case "${1:-status}" in
  status) exec "$AI_PYTHON" -c 'import json; from document_ai.config import readiness; print(json.dumps(readiness(),ensure_ascii=False,indent=2))' ;;
  download) shift; exec "$AI_PYTHON" -m document_ai.download "$@" ;;
  convert) shift; exec "$AI_PYTHON" -m document_ai.convert "$@" ;;
  extract) shift; exec "$AI_PYTHON" -m document_ai.worker "$@" ;;
  serve) [[ -x "$PROJECT_ROOT/scripts/sam3.sh" ]] || { echo "serve (trang thí điểm scan-inbox) chỉ có trong dự án đầy đủ." >&2; exit 2; }
         exec "$PROJECT_ROOT/scripts/sam3.sh" serve ;;
  *) echo "Dùng: $0 {status|download [--model NAME]|convert|extract PDF --output DIRECTORY|serve}" >&2; exit 2 ;;
esac
