-- 028 · Gán kiểu `date` cho các trường ngày của danh mục (DB-09).
-- Danh mục nạp từ baseline gán MỌI trường là `text` (2.624/2.624), nên chuẩn hóa ngày phải đoán theo nhãn. Từ nay kiểu nằm trong dữ liệu.
-- Mọi trường có nhãn bắt đầu bằng "Ngày" (kể cả "Ngày, giờ lập": giá trị gốc có thể kèm giờ, chuỗi gốc vẫn được giữ nguyên ở value_text
-- và bộ chuẩn hóa chỉ lấy phần ngày vào value_normalized).
-- Không đụng tới `number`: các trường "Số ..." trong danh mục là số hiệu hay số thứ tự dạng chữ ("12/2025", "Số 5") nên chưa thể ép kiểu số.
SET search_path = hoso, public, pg_catalog;

UPDATE field_definitions
SET value_type = 'date'
WHERE value_type = 'text' AND label LIKE 'Ngày%';
