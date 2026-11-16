#!/usr/bin/env bash
# Cài worker AI thành LaunchAgent (tự chạy khi đăng nhập, tự chạy lại khi lỗi). Chạy bằng chính tài khoản chạy máy, KHÔNG dùng sudo.
#   install.sh            → cài và nạp
#   install.sh --dry-run  → chỉ in plist sẽ cài
#   install.sh --remove   → gỡ
set -euo pipefail
here="$(cd "$(dirname "$0")" && pwd)"
repo="$(cd "$here/../../.." && pwd)"
label="vn.hoso.ai-worker"
target="$HOME/Library/LaunchAgents/$label.plist"
log_dir="${HOSO_AI_LOG_DIR:-$repo/data/logs}"
domain="gui/$(id -u)"

render() { sed -e "s|__REPO__|$repo|g" -e "s|__LOG_DIR__|$log_dir|g" "$here/$label.plist"; }

case "${1:-}" in
  --dry-run) render; exit 0 ;;
  --remove)
    launchctl bootout "$domain/$label" 2>/dev/null || true
    rm -f "$target"; echo "Đã gỡ $label."; exit 0 ;;
esac

[[ -r "$repo/ai-worker/.env" ]] || { echo "Chưa có $repo/ai-worker/.env (sao từ .env.example rồi chỉnh)." >&2; exit 78; }
mkdir -p "$log_dir" "$(dirname "$target")"
render > "$target"
plutil -lint "$target" >/dev/null
launchctl bootout "$domain/$label" 2>/dev/null || true
launchctl bootstrap "$domain" "$target"
echo "Đã cài và chạy $label. Nhật ký: $log_dir/ai-worker.log · trạng thái: launchctl print $domain/$label"
