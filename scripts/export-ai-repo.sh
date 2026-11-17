#!/usr/bin/env bash
# Xuất riêng phần AI (document_ai, ai-worker, danh mục, script cài) sang thư mục repo riêng để triển khai trên máy AI.
# Không chép mô hình, .env, công cụ huấn luyện/đo. Mã nguồn gốc vẫn ở dự án này; sửa ở đây rồi xuất lại.
#   scripts/export-ai-repo.sh [THU_MUC_DICH]      (mặc định ../hoso-ai)
#   cd <THU_MUC_DICH> && git add -A && git commit -m "..." && git push
set -euo pipefail
src="$(cd "$(dirname "$0")/.." && pwd)"
dest="${1:-$src/../hoso-ai}"
mkdir -p "$dest"
dest="$(cd "$dest" && pwd)"
[[ "$dest" != "$src" ]] || { echo "Thư mục đích trùng dự án." >&2; exit 2; }

skip=(--exclude '__pycache__/' --exclude '*.py[cod]' --exclude '.pytest_cache/' --exclude '*.egg-info/'
      --exclude '.DS_Store' --exclude '.env' --exclude '.env.local' --exclude '.venv/' --exclude 'venv/')
rsync -a --delete "${skip[@]}" "$src/document_ai/" "$dest/document_ai/"
# training/ là công cụ đo và huấn luyện trên máy dev; chỉ mang theo báo cáo chọn mô hình.
rsync -a --delete "${skip[@]}" --exclude '/training/' --exclude '/tests/test_benchmark.py' "$src/ai-worker/" "$dest/ai-worker/"
mkdir -p "$dest/ai-worker/training" "$dest/assets" "$dest/scripts" "$dest/database/samples"
cp "$src/ai-worker/training/SO-SANH-IFSTRUCT-QWEN4B.md" "$dest/ai-worker/training/"
cp "$src/assets/danh-muc-ho-so.js" "$dest/assets/"                      # danh mục cho lệnh `once` khi chưa nối CSDL
cp "$src/scripts/setup-document-ai.sh" "$src/scripts/document-ai.sh" "$dest/scripts/"
cp "$src/database/samples/public-016.pdf" "$src/database/samples/public-019.pdf" "$dest/database/samples/"   # PDF công khai để thử
cp "$src/ops/ai-repo/README.md" "$dest/README.md"
cp "$src/ops/ai-repo/gitignore" "$dest/.gitignore"
echo "Đã xuất phần AI vào $dest"
