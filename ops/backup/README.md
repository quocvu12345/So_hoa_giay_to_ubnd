# Sao lưu và khôi phục (OPS-03, OPS-04)

Hai script bash, chạy cả trên Linux (systemd/cron) và macOS. Báo kết quả về API qua `POST/PATCH /api/v1/ops/backups` (BE-89, xác thực bằng khóa máy `Backup__IngestToken`);
API tự cảnh báo quản trị kỹ thuật khi quá 26 giờ không có bản thành công, khi lần chạy lỗi hoặc treo, và khi quá 100 ngày chưa diễn tập khôi phục.

| Script | Việc |
|---|---|
| `hoso-backup.sh` | `pg_dump` (schema `hoso` và `public`), kho tệp (`rsync`, không xóa), cấu hình (tùy chọn); ghi mã băm, danh sách extension, mã lần chạy; dọn bản cũ; chép ra ngoài địa điểm nếu có `HOSO_OFFSITE_CMD` |
| `hoso-restore-test.sh` | Khôi phục bản mới nhất vào CSDL tạm, kiểm mã băm, phiên bản migration, số dòng, và **mọi tệp được CSDL tham chiếu có trong bản sao kho tệp**; lập biên bản; đạt thì ghi `restoreTestedAt` về API; xóa CSDL tạm |

## Cài đặt (Linux)

```sh
install -d /opt/hoso/ops && cp -r ops/backup /opt/hoso/ops/
install -m 600 -o hoso-backup ops/backup/backup.env.example /etc/hoso/backup.env     # rồi sửa: đường dẫn, PG*, HOSO_BACKUP_TOKEN
cp ops/backup/systemd/*.service ops/backup/systemd/*.timer /etc/systemd/system/
systemctl daemon-reload && systemctl enable --now hoso-backup.timer
```

- Role CSDL `hoso_backup` (chỉ đọc đủ cho `pg_dump`): `CREATE ROLE hoso_backup LOGIN PASSWORD '...'; GRANT hoso_readonly, ...` hoặc đơn giản là quyền SELECT trên mọi bảng của schema `hoso` và `public.hoso_schema_versions`; mật khẩu để trong `~/.pgpass` của người dùng `hoso-backup`.
- Ở máy diễn tập, bật `hoso-restore-test.timer` (hằng quý) hoặc chạy tay; cần `HOSO_RESTORE_PGUSER` có quyền CREATEDB và gói `postgresql-contrib` (extension `unaccent`, `pg_trgm`, `btree_gist`).
- Mã thoát `hoso-backup.sh`: 0 đạt · 1 có loại sao lưu lỗi (đã báo API) · 2 sao lưu xong nhưng báo API lỗi · 78 thiếu cấu hình.

## Khôi phục thật (sau sự cố)

Bản dump **không tự dựng lại extension** (pg_dump bỏ qua đối tượng của extension) và có mục `CREATE SCHEMA public` mà CSDL mới đã có; `pg_restore -d` thẳng vào CSDL mới sẽ báo lỗi. Làm đúng thứ tự:

```sh
createdb hoso
for ext in $(cut -d'|' -f1 hoso-XXXX.dump.extensions); do psql -d hoso -c "CREATE EXTENSION $ext WITH SCHEMA public"; done
pg_restore --list hoso-XXXX.dump | grep -v -E '(^|[ ;])SCHEMA - public( |$)|COMMENT - SCHEMA public' > /tmp/hoso.list
pg_restore -L /tmp/hoso.list --no-owner --no-privileges --exit-on-error -d hoso hoso-XXXX.dump
# tạo lại role (migration 020 tạo role NOLOGIN; đặt mật khẩu/LOGIN ngoài repo), rồi cấp quyền: chạy lại phần GRANT của 020 hoặc `dotnet … migrate` KHÔNG cần (nhật ký migration đã được khôi phục).
rsync -a files/blobs/ /var/lib/hoso/blobs/       # kho tệp
```

Bản sao lưu của CSDL dev `hoso_dev` (thư mục `data/db-backups/`) cùng dạng và đã được kiểm khôi phục theo đúng cách trên (số dòng các bảng chính khớp).

## Đã kiểm và chưa kiểm

- **Đã chạy thật** trên PostgreSQL 16 và API thật với CSDL tạm: sao lưu ba loại ghi đúng về API, diễn tập khôi phục đạt và ghi nhận `restoreTestedAt`, các đường lỗi (dump hỏng, thiếu tệp trong bản sao, API tắt, sai khóa, `pg_dump` lỗi, thiếu cấu hình) cho đúng mã thoát và biên bản. Lần chạy đầu của chính diễn tập khôi phục đã lộ 3 lỗi của quy trình (thiếu extension, trùng schema `public`, thiếu `btree_gist`) và đã sửa.
- **Chưa kiểm:** chạy dưới systemd/cron thật; sao lưu WAL (liên tục, khôi phục về một thời điểm) — hiện chỉ có `pg_dump` hằng ngày nên có thể mất tối đa một ngày dữ liệu; bản ngoài địa điểm không sửa/xóa được (cần dịch vụ lưu trữ hỗ trợ khóa đối tượng; script chỉ gọi lệnh bạn đặt ở `HOSO_OFFSITE_CMD`); mã hóa bản sao lưu (nên bật mã hóa đĩa hoặc mã hóa trước khi chép ra ngoài, xem docs/05-bao-mat.md); kho tệp rất lớn (rsync lần đầu chép toàn bộ).
