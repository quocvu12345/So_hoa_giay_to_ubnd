# Bộ test hồ sơ công dân: đất đai, thừa kế, xe

Mở **http://127.0.0.1:8765/scan-inbox.html?samples=citizen** → chọn PDF → **Lấy dữ liệu** → đối chiếu ảnh gốc, sửa trường → chọn loại và nơi lưu.

Đã nhập vào PostgreSQL local `hoso_dev`, schema `hoso`, bằng seed `database/007_seed_citizen_samples_optional.sql`. Có 3 hồ sơ **demo**: `TEST-CITIZEN-LAND`, `TEST-CITIZEN-INHERITANCE`, `TEST-CITIZEN-VEHICLE`. Các PDF vẫn ở danh sách chờ để thử luồng trích xuất; không giả lập thành hồ sơ đã được cơ quan tiếp nhận.

**12 PDF / 38 trang**:

| Nhóm | File có sẵn | Loại mẫu |
|---|---|---|
| Đất đai | Hợp đồng chuyển nhượng; đơn biến động điền sẵn Phước Tân; hợp đồng mô phỏng điền tay | 1 form trống, 1 ví dụ công khai đã thay thông tin, 1 giả lập |
| Thừa kế | Đề nghị nhận thừa kế; tường trình quan hệ nhân thân; di chúc; tường trình mô phỏng điền tay | 3 form trống, 1 giả lập |
| Xe | ĐKX10/79 theo TT13/2025; ĐKX11 theo TT79/2024; hợp đồng mua bán xe Carmudi; ĐKX11 mô phỏng điền tay | 3 form trống, 1 giả lập |
| Nhiều loại | Ghép 3 bản mô phỏng trên thành 7 trang | Cần phát hiện nhiều giấy tờ độc lập, kiểm tra/tách trước khi lưu |

Nguồn đã tải:

- [Phòng công chứng số 6 TP.HCM: biểu mẫu](https://www.congchung6.gov.vn/vi/document/bieu-mau-216.aspx): 4 file Word trống về đất, thừa kế, nhân thân và di chúc. Mẫu tham khảo có thuật ngữ/đơn vị hành chính cũ; không khẳng định còn áp dụng để nộp hồ sơ hiện nay.
- [Công an tỉnh Lạng Sơn: biểu mẫu đăng ký xe](https://congan.langson.gov.vn/dang-ky-quan-ly-phuong-tien-giao-thong-co-gioi-duong-bo/39/thong-ke-thu-tuc-va-bieu-mau-kem-theo-thu-tuc-hanh-chinh-trong-linh-vuc-dang-ky-quan-ly-phuong-tien-giao-thong/11392.aspx): 2 file Word. Phiên bản ghi ngay trong mẫu được giữ nguyên, không tự gọi là bản mới nhất.
- [UBND phường Phước Tân: mẫu biến động đất đai đã điền](https://phuoctan.dongnai.gov.vn/uploads/phuoctan/news/2025_11/mau-so-18don-dang-ky-bien-dong-dat-dai-tai-san-gan-lien-voi-dat.pdf): nguồn ghi rõ đã thay thông tin cá nhân, thửa đất để bảo mật. Đây là mẫu chữ in, trường hợp đính chính thông tin, không phải ví dụ chuyển nhượng đã hoàn tất.
- [Carmudi: hợp đồng mua bán xe](https://static.carmudi.vn/wp-content/uploads/2014/06/Hop-dong-mua-ban-xe_Carmudi-Vietnam.pdf): PDF mẫu năm 2014, dùng kiểm thử bố cục/hợp đồng cũ.

`originals/` giữ 8 tệp tải nguyên bản. `pdf/` có 12 PDF để chạy thử. Các Word được chuyển qua macOS `textutil` và Chromium; PDF dẫn xuất có thể khác cách phân trang và bố cục Word. `manifest.json` lưu URL, SHA-256, kích thước, số trang, phép chuyển đổi và loại mẫu; `acquisition.json` ghi nguồn tải. `acquisition-issues.json` ghi nguồn không dùng/tải lỗi. Chưa tìm thấy bộ hồ sơ viết tay thật phù hợp trong các nguồn đã khảo sát; không khẳng định đã tìm trên mọi nền tảng.

## Phân biệt mẫu thật và giả lập

- **Biểu mẫu công khai** là file thật từ nguồn nêu trên; các bản trống không có thông tin người nộp để trích xuất.
- **Mẫu điền sẵn công khai** có dữ liệu minh họa do nguồn công bố đã chỉnh sửa.
- **Mô phỏng điền tay** do script điền font Patrick Hand vào bản chuyển đổi của form, raster hóa 170 DPI, không có lớp chữ ẩn. Tên, địa chỉ và mã `TEST-*` đều là dữ liệu giả lập; không có chữ ký, con dấu giả. Chỉ kiểm tra đường đi OCR + phân loại, không đại diện nét viết tay tự nhiên, chữ xấu, tẩy xóa hay scan mờ.
- `ground-truth.json` chỉ là đáp án của phần giả lập, không được đưa vào đầu vào model. Không có giá trị OCR hoặc phiếu xác nhận giả được seed vào `document_field_values`/`ocr_jobs`.
- [Báo cáo 5 lần chạy thử](benchmark.md) và `benchmark.json` lưu kết quả chạy AI local thật và đối chiếu một số trường giả lập; kết quả chi tiết nằm ở `data/sam3/runtime/extractions/<job_id>/`. Không suy rộng tỷ lệ chính xác từ bộ test nhỏ này.

## Các trường cần kiểm tra

- Đất: bên chuyển/bên nhận, định danh từng bên, số thửa/tờ bản đồ, diện tích, địa chỉ, số giấy chứng nhận, giá chuyển nhượng.
- Thừa kế: người chết, ngày mất, người đề nghị, quan hệ, cha mẹ/vợ chồng/các con, di sản. Một tên xuất hiện trong trang không đủ chứng minh đã gán đúng vai trò.
- Xe: chủ cũ/chủ mới, biển số, nhãn hiệu, số khung/số máy, lý do thu hồi, giấy tờ kèm theo. Xếp vào U27 là nhóm thử tiếp nhận, không khẳng định UBND có thẩm quyền đăng ký xe.

Đã bổ sung 8 loại giấy tờ trong danh mục và các trường riêng; giữ nguyên ID và vị trí trường cũ. Gợi ý AI luôn cần đối chiếu. SAM 3 chỉ hỗ trợ tách vùng; OCR và phân loại vẫn do PaddleOCR-VL và Qwen local.

## Kiểm tra database / cài trên máy khác

```sh
psql -X -d hoso_dev -c "SELECT external_key, sample_kind, document_type_code, page_count FROM hoso.v_citizen_samples ORDER BY external_key;"

# Chỉ tạo database nếu chưa có. Seed có thể nạp lại, không ghi đè bản đã sửa.
createdb hoso_dev
psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/install.sql
psql -X -v ON_ERROR_STOP=1 -d hoso_dev -f database/007_seed_citizen_samples_optional.sql
python3 database/scripts/build_citizen_seed.py --check
```

`files.local_path` trong PostgreSQL tương đối với `database/`; đường dẫn trong manifest tương đối với gốc project. File PDF nằm trên quocDisk, database lưu metadata và liên kết file. PostgreSQL hiện chạy bằng dịch vụ Homebrew trên máy; data directory của PostgreSQL không được di chuyển sang quocDisk.

Giao diện scan dùng manifest và trạng thái trên đĩa; thao tác “Đưa vào hồ sơ” hiện dùng JSON/localStorage của bản thí điểm, **chưa ghi trực tiếp PostgreSQL**. Bộ mẫu đã có trong cả DB và danh sách PDF, nhưng sửa trên giao diện chưa đồng bộ vào các dòng SQL này.

## Tạo lại các PDF dẫn xuất

Môi trường công cụ riêng: `/Volumes/quocDisk/AI/document-samples/venv`; không thay môi trường OCR/SAM. Cần macOS `textutil` và Chromium trong cache Playwright đã có.

```sh
/Volumes/quocDisk/AI/document-samples/venv/bin/python scripts/prepare-citizen-samples.py
python3 database/scripts/build_citizen_seed.py
```

Chạy lại có thể thay hash PDF dẫn xuất do metadata thời gian; phải kiểm tra và chủ động cập nhật các bản đã nhập, seed không ghi đè chúng. Font và giấy phép OFL nằm trong `fonts/`; font từ [Google Fonts / Patrick Hand](https://github.com/google/fonts/tree/main/ofl/patrickhand). Không cần gọi API cloud để đọc hoặc tạo bản mô phỏng.
