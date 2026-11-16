# Kết quả thử local trên bộ mẫu công dân

Đây là smoke test trên mẫu công khai và font mô phỏng, không đo độ chính xác chữ viết tay thật.

| PDF | Trang | Thời gian xử lý ban đầu | Loại gợi ý | Khớp loại mẫu | Trường đối chiếu chính xác |
|---|---:|---:|---|---|---|
| citizen-vehicle-hand-sim | 2 | 69.9 s | U27-D13 | Có | 7/9 |
| citizen-inheritance-hand-sim | 2 | 63.45 s | U09-D12 | Có | 5/6 |
| citizen-land-hand-sim | 3 | 97.27 s | U15-D14 | Có | 6/7 |
| citizen-land-filled-public | 3 | 58.89 s | U15-D02 | Có | Chưa có đáp án từng trường |
| citizen-vehicle-recall | 2 | 36.41 s | U27-D13 | Có | Chưa có đáp án từng trường |

Các trường còn sai hoặc thiếu trong phần đã đối chiếu:

- `citizen-vehicle-hand-sim` · **Địa chỉ chủ xe**: mong đợi `30 đường Mẫu, phường Minh Họa`, kết quả `(trống)`.
- `citizen-vehicle-hand-sim` · **Địa chỉ chủ xe mới**: mong đợi `42 đường Thử Nghiệm, phường Minh Họa`, kết quả `42 đường Thứ Nghiệm, phường Minh Họa`.
- `citizen-inheritance-hand-sim` · **Các con của người để lại di sản**: mong đợi `Nguyễn Thị Mai; Nguyễn Văn Minh`, kết quả `(trống)`.
- `citizen-land-hand-sim` · **Diện tích đất**: mong đợi `120,5 m²`, kết quả `(trống)`.

Mẫu nhân thân để trống mục vợ/chồng; không suy ra quan hệ hôn nhân từ việc hai người có chung con. Danh sách con là nhiều giá trị, cần đối chiếu thủ công.

Các trường chưa nằm trong đáp án vẫn có thể sai. “Đã đọc mọi trang” chỉ có nghĩa pipeline đã xử lý từng trang, không bảo đảm đọc đủ từng chữ. Một số địa chỉ, đơn vị diện tích và trường nhiều người còn cần sửa.

Dòng ngày/tháng/năm để trống trong hợp đồng đã bị bộ lọc loại bỏ; bản trước khi lọc được giữ trong thư mục job. Thời gian bảng là lần xử lý ban đầu, không giả định chạy lại model.

Kết quả chi tiết: `benchmark.json`; đáp án giả lập: `ground-truth.json`. Không nhập các đáp án này làm dữ liệu OCR hoặc dữ liệu đã xác minh.
