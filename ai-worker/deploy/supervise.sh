#!/usr/bin/env bash
# Chạy worker và chạy lại khi nó thoát ngoài ý muốn: kẹt (mã 75 của watchdog), bị giết, lỗi hệ thống. Dùng cho máy dev, nơi không có launchd/systemd
# (bản dịch vụ ở deploy/launchd và deploy/systemd đã tự chạy lại). Dừng hẳn khi: nhận TERM/INT (scripts/dev-up.sh stop), worker thoát êm (mã 0)
# hoặc cấu hình sai (mã 78: chạy lại vô ích). Thoát liên tục thì giãn dần khoảng chờ (5, 10, 20, 40, tối đa 60 giây).
#   deploy/supervise.sh            → chạy `run-worker.sh run` và giám sát
set -uo pipefail

here="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
stopping=0
child=""
trap 'stopping=1; [[ -n "$child" ]] && kill -TERM "$child" 2>/dev/null' TERM INT

delay=5
while (( ! stopping )); do
  started=$SECONDS
  "$here/run-worker.sh" "${@:-run}" &
  child=$!
  wait "$child"
  code=$?
  if (( stopping )); then
    wait "$child" 2>/dev/null     # tín hiệu làm `wait` trả sớm: chờ worker thoát hẳn rồi mới thoát theo
    break
  fi
  case "$code" in
    0|78) exit "$code" ;;
  esac
  if (( SECONDS - started > 60 )); then delay=5; else delay=$(( delay >= 60 ? 60 : delay * 2 )); fi
  echo "$(date -u +%Y-%m-%dT%H:%M:%SZ) supervise: worker thoát mã $code sau $(( SECONDS - started )) giây, chạy lại sau $delay giây" >&2
  sleep "$delay" &
  wait $!
done
exit 0
