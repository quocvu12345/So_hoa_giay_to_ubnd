#!/usr/bin/env bash
# Cài môi trường AI trên một Mac Apple Silicon: venv Python 3.12, thư viện đã ghim, tải mô hình, chuyển IFStruct sang MLX 4-bit.
# Chạy lại được: bước nào đã xong thì bỏ qua (tải tiếp phần dở, không chuyển lại mô hình đã có).
#
#   DOCUMENT_AI_HOME=/duong/dan/ai ./scripts/setup-document-ai.sh
#
# Biến (tùy chọn): DOCUMENT_AI_HOME (nơi đặt venv, mô hình, cache; cần khoảng 15 GB trống khi cài, còn khoảng 6 GB sau khi xóa nguồn BF16),
#                  PYTHON (Python 3.12 dùng tạo venv khi không có uv), UV (đường dẫn uv).
set -euo pipefail
PROJECT_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
export DOCUMENT_AI_HOME="${DOCUMENT_AI_HOME:-/Volumes/quocDisk/AI/paddleocr}"
export UV_CACHE_DIR="$DOCUMENT_AI_HOME/cache/uv"
export TMPDIR="$DOCUMENT_AI_HOME/tmp"
# Tải qua HTTP thường thay cho Xet (cách đã dùng khi tải IFStruct ngày 17/11/2026); đặt 0 để dùng Xet.
export HF_HUB_DISABLE_XET="${HF_HUB_DISABLE_XET:-1}"
VENV_PYTHON="$DOCUMENT_AI_HOME/venv/bin/python"

if [[ "$(uname -s)-$(uname -m)" != "Darwin-arm64" ]]; then
  echo "Cần Mac Apple Silicon (MLX). Máy này: $(uname -s)-$(uname -m)." >&2
  exit 1
fi
echo "== Thư mục AI: $DOCUMENT_AI_HOME"
mkdir -p "$TMPDIR" "$DOCUMENT_AI_HOME/models"

UV="${UV:-$(command -v uv || true)}"
if [[ ! -x "$VENV_PYTHON" ]]; then
  echo "== Tạo venv Python 3.12"
  if [[ -n "$UV" ]]; then
    "$UV" venv --python 3.12 "$DOCUMENT_AI_HOME/venv"
  else
    PYTHON="${PYTHON:-$(command -v python3.12 || true)}"
    [[ -n "$PYTHON" ]] || { echo "Không thấy uv hoặc python3.12. Cài một trong hai (brew install uv) rồi chạy lại." >&2; exit 1; }
    "$PYTHON" -m venv "$DOCUMENT_AI_HOME/venv"
  fi
fi

echo "== Cài thư viện đã ghim"
if [[ -n "$UV" ]]; then
  "$UV" pip install --python "$VENV_PYTHON" -r "$PROJECT_ROOT/document_ai/requirements.lock.txt" "psycopg[binary]>=3.2,<4"
else
  "$VENV_PYTHON" -m pip install -r "$PROJECT_ROOT/document_ai/requirements.lock.txt" "psycopg[binary]>=3.2,<4"
fi

cd "$PROJECT_ROOT"
CLASSIFIER="$("$VENV_PYTHON" -c 'from document_ai.config import DEFAULT_CLASSIFIER; print(DEFAULT_CLASSIFIER)')"
if [[ -f "$DOCUMENT_AI_HOME/models/$CLASSIFIER/conversion-receipt.json" ]]; then
  echo "== Đã có $CLASSIFIER, chỉ tải và kiểm tra OCR"
  "$VENV_PYTHON" -m document_ai.download --model ocr --model layout --model orientation
else
  echo "== Tải mô hình (cần mạng; nguồn BF16 của IFStruct khoảng 7,5 GB)"
  "$VENV_PYTHON" -m document_ai.download
  echo "== Chuyển IFStruct sang MLX 4-bit"
  "$VENV_PYTHON" -m document_ai.convert
  echo "Chuyển xong. Có thể xóa nguồn BF16 để lấy lại chỗ: rm -rf \"$DOCUMENT_AI_HOME/models/Qwen3-4B-Instruct-2507-ifstruct-bf16\""
fi

echo "== Kiểm tra"
exec "$VENV_PYTHON" -c 'import json; from document_ai.config import readiness; print(json.dumps(readiness(), ensure_ascii=False, indent=2))'
