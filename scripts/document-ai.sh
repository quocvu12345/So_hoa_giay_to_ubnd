#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DOCUMENT_AI_HOME="${DOCUMENT_AI_HOME:-/Volumes/quocDisk/AI/paddleocr}"
cd "$PROJECT_ROOT"
AI_PYTHON="$DOCUMENT_AI_HOME/venv/bin/python"
case "${1:-status}" in
  status) exec "$AI_PYTHON" -c 'import json; from document_ai.config import readiness; print(json.dumps(readiness(),ensure_ascii=False,indent=2))' ;;
  download) shift; exec "$AI_PYTHON" -m document_ai.download "$@" ;;
  convert-nuextract) shift; exec "$AI_PYTHON" -m document_ai.convert_nuextract "$@" ;;
  convert-ifstruct) shift; exec "$AI_PYTHON" -m document_ai.convert_ifstruct "$@" ;;
  convert-bkee) shift; exec "$AI_PYTHON" -m document_ai.convert_qwen --model bkee "$@" ;;
  extract-fields) shift; exec "$AI_PYTHON" -m document_ai.field_extract "$@" ;;
  check-qwen-vl) shift; exec "$AI_PYTHON" -m document_ai.check_qwen_vl "$@" ;;
  extract) shift; exec "$AI_PYTHON" -m document_ai.worker "$@" ;;
  serve) exec "$PROJECT_ROOT/scripts/sam3.sh" serve ;;
  *) echo "Dùng: $0 {status|download [--model NAME]|convert-nuextract|convert-ifstruct|convert-bkee|extract-fields --help|check-qwen-vl IMAGE [--output FILE]|extract PDF --output DIRECTORY|serve}" >&2; exit 2 ;;
esac
