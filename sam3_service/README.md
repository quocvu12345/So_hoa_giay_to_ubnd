# SAM 3 local cho dự án Hồ sơ số

> Luồng tiếp nhận PDF, OCR và phân loại mới: xem [document_ai/README.md](../document_ai/README.md). Trang mặc định hiện là `/scan-inbox.html`; phòng thử SAM 3 vẫn ở `/sam3-lab.html`.

Engine nhận diện ảnh là `transformers.Sam3Model`, sử dụng trọng số chính thức
`facebook/sam3`. Môi trường và model nằm trên quocDisk. Trên máy Mac M4,
dịch vụ chọn GPU Apple qua MPS; có thể chuyển sang CPU bằng biến `SAM3_DEVICE`.
Repo Meta được lưu để tham khảo; dịch vụ không gọi entrypoint CUDA của repo đó.

## Mở giao diện

Từ thư mục dự án:

```bash
./scripts/sam3.sh serve
```

Mở <http://127.0.0.1:8765>. Chọn giấy tờ, chọn trang, nhập prompt tiếng Anh
như `document`, `table`, `stamp`, `signature`, rồi bấm **Chạy SAM 3**.
Nút **Thử SAM 3** cũng có trong trang đề xuất và trang quản lý hồ sơ.
Giao diện phải được mở qua dịch vụ này để gọi API, không mở trực tiếp bằng `file://`.

SAM trả về vùng bao, điểm khớp prompt và mặt nạ. Nhãn công văn/nghị quyết trong
kho mẫu lấy từ metadata nguồn, không phải dự đoán của SAM. Dịch vụ chưa chạy
OCR hoặc bộ phân loại nghiệp vụ và không tự ghi kết quả vào các bảng OCR.

## Môi trường và model

```text
/Volumes/quocDisk/AI/sam3/
  venv/                  Python và thư viện chạy SAM 3
  python/                Python 3.12 riêng
  models/facebook-sam3/  Trọng số, tokenizer, cấu hình và biên nhận SHA-256
  source/                Mã nguồn Meta để tham khảo
  cache/                 Hugging Face, PyTorch, uv và trình duyệt kiểm thử
  tmp/                   Tệp tạm
```

Kiểm tra/cài lại môi trường:

```bash
./scripts/sam3.sh status
./scripts/setup-sam3.sh
```

Tải trọng số lần đầu cần tài khoản đã được duyệt tại
<https://huggingface.co/facebook/sam3>:

```bash
./scripts/sam3.sh login
./scripts/sam3.sh access
./scripts/sam3.sh download
```

`login` có thể hiển thị địa chỉ `https://hf.co/oauth/device` và mã xác nhận:
mở trang đó, đăng nhập và cho phép thiết bị, rồi quay lại Terminal.
Đăng nhập thành công không đồng nghĩa với được duyệt model. `access` kiểm tra
quyền tải thực tế mà không in token. Không đưa token vào mã nguồn hoặc chat.

Checkpoint được ghim ở revision `3c879f39826c281e95690f02c7821c4de09afae7`.
Tệp `model.safetensors` có kích thước 3.439.938.512 byte. Lệnh download chỉ tải
bộ Transformers cần dùng, không tải thêm bản `sam3.pt` trùng chức năng.
Biên nhận `download-receipt.json` lưu revision, kích thước và SHA-256 từng tệp.

Sau khi tải xong, server dùng `local_files_only=True`; ảnh và PDF được xử lý tại
máy, không gửi tới Hugging Face. `access`, `download` và `samples` là những lệnh
truy cập mạng được gọi riêng. Server mặc định chỉ lắng nghe `127.0.0.1`.

Nếu cần kiểm tra bằng CPU:

```bash
SAM3_DEVICE=cpu ./scripts/sam3.sh serve
```

Chỉ chạy một server/một tác vụ nhận diện cùng lúc trên máy 16 GB. Lần đầu cần
nạp model. Một lỗi MPS cụ thể sẽ hiện trên giao diện và trong log; kiểm tra phép
tính MPS đơn giản không thay thế cho kiểm thử nhận diện với trọng số thật.

## Giấy tờ thật để thử

`data/sam3/manifest.json` liệt kê 32 PDF, 422 trang, từ 8 đơn vị xuất bản:
Từ Liêm, Chính phủ, Phú Quốc, Ba Dinh, Bình Lục, Nghĩa Hành, Cục Thống kê
và Sở Tài chính Lạng Sơn. Có 11 nhóm hình thức: công văn, quyết định, nghị quyết,
kế hoạch, báo cáo, công điện, nghị định, giấy mời, thông báo, tờ trình và phụ lục bảng.

- 19 PDF Từ Liêm nằm ở `database/downloads/` hoặc `database/samples/`.
- 13 PDF bổ sung nằm ở `data/sam3/documents/`.
- Mỗi bản ghi lưu trang nguồn, URL tệp gốc, SHA-256, dung lượng, số trang và nguồn nhãn.
- Nhãn đang ở trạng thái `needs_review`; đây chưa phải bộ chuẩn đo chất lượng phân loại.
- `data/sam3/download_report.json` ghi các nguồn không lấy được. Một nguồn Bộ Xây dựng
  có lỗi chuỗi chứng chỉ TLS đã được bỏ qua, không tắt kiểm tra chứng chỉ.
- Một URL Từ Liêm cũ trả 404; bản `database/samples/public-002.pdf` đã có sẵn
  khớp SHA-256 được dùng thay thế.

Lấy lại bộ tài liệu công khai đã chọn:

```bash
python3 database/scripts/fetch_sources.py
./scripts/sam3.sh samples
```

Script đầu có thể báo lỗi URL cũ nêu trên. Script samples vẫn dùng bản đã lưu
khớp mã kiểm tra. Tài liệu có sẵn không bị ghi đè nếu mã kiểm tra thay đổi.
Các mẫu là văn bản công khai, không phải hồ sơ cá nhân thu thập từ nguồn riêng tư.
PDF chưa được xác thực chữ ký số hoặc hiệu lực pháp lý bởi ứng dụng.

## Đấu nối với project

`sam3_service/app.py` là backend FastAPI, phục vụ cả trang HTML hiện tại lẫn API.
`assets/sam3-lab.js` gọi API cùng địa chỉ; không cần proxy hoặc khóa API cloud.
Swagger nằm tại <http://127.0.0.1:8765/docs>.

| API | Chức năng |
| --- | --- |
| `GET /api/sam3/status` | Trọng số, device, phiên bản, trạng thái model và tác vụ |
| `GET /api/sam3/documents` | Tài liệu mẫu và tệp người dùng đã nạp |
| `POST /api/sam3/documents` | Nạp raw bytes PDF/ảnh; header `X-Filename` mã hóa URL |
| `GET /api/sam3/documents/{id}/preview?page=1` | Render trang thành PNG |
| `GET /api/sam3/documents/{id}/file` | Tải bản gốc |
| `POST /api/sam3/jobs` | Tạo tác vụ nhận diện, trả `job_id` |
| `GET /api/sam3/jobs/{job_id}` | Theo dõi queued/running/completed/failed |
| `GET /api/sam3/jobs/{job_id}/artifacts/result.json` | JSON kết quả thật |

Ví dụ gọi từ giao diện hoặc backend khác trên cùng máy:

```bash
curl http://127.0.0.1:8765/api/sam3/jobs \
  -H 'Content-Type: application/json' \
  -d '{"document_id":"public-002","page":1,"prompt":"stamp","threshold":0.5}'
```

Sau đó lấy trạng thái bằng `job_id` nhận được. HTTP 503 nghĩa là chưa có trọng số,
409 nghĩa là đang có một tác vụ; lỗi model được ghi thành `failed`, không trả kết quả giả.

Kết quả được lưu tại `data/sam3/runtime/jobs/<job_id>/`:

- `status.json`: trạng thái và lỗi nếu có;
- `result.json`: model/revision, device, prompt, thời gian, SHA-256 nguồn, trang,
  kích thước ảnh và các vùng nhận diện;
- `overlay.jpg`: trang tô màu vùng;
- `mask-N.png`: mặt nạ từng đối tượng.

`box_xyxy` là tọa độ trên ảnh trang đã render, không phải đơn vị point của PDF.
`normalized_box_xyxy` nằm trong [0,1]. Với 19 tài liệu seed, `database_file_id`
trong kết quả trỏ về UUID của bảng `hoso.files` để nối vào luồng xử lý sau này.
Server hiện lưu JSON trên đĩa, chưa kết nối PostgreSQL. Không ghi mask của SAM
vào `ocr_jobs` như thể đã đọc chữ; bước OCR/phân loại và xác nhận cán bộ cần tích hợp riêng.

## Kiểm tra

```bash
./scripts/sam3.sh test
```

Các kiểm tra dùng PDF thật cho render và đối chiếu hash, thử upload, giới hạn
dung lượng, số trang, đường dẫn, từ chối khi thiếu trọng số, và trạng thái lỗi/concurrency.
Chúng không chấm điểm độ chính xác của SAM. Kiểm thử nhận diện thực tế phải có
checkpoint đã tải và kết quả lưu trong `runtime/jobs/`.

## Kết quả kiểm tra trên máy này — 12/11/2026

- Đã tải đủ trọng số chính thức; SHA-256 của `model.safetensors`:
  `6d06f0a5f84e435071fe6603e61d0b4cc7b40e0d39d487cfd4d67d8cc11cc14a`.
- Apple M4, RAM 16 GB, `device=mps`, PyTorch 2.15.0, Transformers 5.22.2.
- 8/8 kiểm tra API và dữ liệu đạt.
- Trình duyệt Chromium: chọn tài liệu, chuyển trang, lọc danh sách, gửi tác vụ,
  chờ và hiển thị kết quả thật; không có lỗi JavaScript. Giao diện ở chiều rộng
  390 px không tràn ngang.
- `public-002`, trang 1, prompt `stamp`, threshold 0.5: 2 vùng con dấu,
  11,721 giây gồm nạp model sau khởi động lại. Job:
  `10b3d124bab448a4aeb24e5602449f57`.
- `phuquoc-004`, trang 1, prompt `table`, threshold 0.5: 1 vùng bảng,
  2,680 giây khi model đã nạp. Job: `35371b202d0b4fccad8c4e408fa60b19`.

Đây là hai phép thử chức năng trên tài liệu thật, không phải benchmark độ chính xác
cho toàn bộ 419 loại giấy tờ. Điểm khớp prompt không phải xác suất văn bản được phân loại đúng.
