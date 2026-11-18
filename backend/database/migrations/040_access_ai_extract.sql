-- 040 · BE-128. "Trích xuất ngay" vào nhật ký truy cập.
-- Người bấm nâng một giấy tờ lên đầu hàng đợi AI là người khiến AI đọc nội dung giấy tờ đó sớm hơn: cần truy được "ai, giấy tờ nào, lúc nào"
-- (trước đây chỉ có log có cấu trúc và ocr_jobs.prioritized_by, mất khi việc được tạo mới hoặc nâng lại). Thêm hành động ai_extract.
-- Ràng buộc nằm ở bảng cha nên các phân vùng theo tháng (kể cả phân vùng tạo sau này) kế thừa.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE access_events DROP CONSTRAINT access_events_action_check;
ALTER TABLE access_events ADD CONSTRAINT access_events_action_check
  CHECK (action IN ('view', 'download', 'print', 'export', 'search', 'login', 'logout', 'ai_extract'));
