#!/usr/bin/env bash
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export SAM3_HOME="${SAM3_HOME:-/Volumes/quocDisk/AI/sam3}"
export HF_HOME="$SAM3_HOME/cache/huggingface"
export TORCH_HOME="$SAM3_HOME/cache/torch"
export TMPDIR="$SAM3_HOME/tmp"
export PYTORCH_ENABLE_MPS_FALLBACK=1
export HF_HUB_DISABLE_TELEMETRY=1
export TOKENIZERS_PARALLELISM=false
SAM_PYTHON="$SAM3_HOME/venv/bin/python"
cd "$PROJECT_ROOT"
if [[ ! -x "$SAM_PYTHON" ]]; then
  echo "Chưa có môi trường. Chạy ./scripts/setup-sam3.sh trước." >&2
  exit 1
fi
case "${1:-serve}" in
  login) exec "$SAM3_HOME/venv/bin/hf" auth login ;;
  download) exec "$SAM_PYTHON" -m sam3_service.download_model ;;
  access) exec "$SAM_PYTHON" -m sam3_service.check_access ;;
  status) exec "$SAM_PYTHON" -c 'import json; from sam3_service.inference import engine; print(json.dumps(engine.status(),ensure_ascii=False,indent=2))' ;;
  samples) exec "$SAM_PYTHON" -m sam3_service.collect_samples ;;
  serve) exec "$SAM_PYTHON" -m uvicorn sam3_service.app:app --host 127.0.0.1 --port "${SAM3_PORT:-8765}" ;;
  test) exec "$SAM_PYTHON" -m pytest tests/test_sam3_service.py tests/test_document_ai.py -q ;;
  *) echo "Dùng: $0 {serve|status|access|login|download|samples|test}" >&2; exit 2 ;;
esac
