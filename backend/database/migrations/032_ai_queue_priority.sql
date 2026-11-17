-- 032 · Khay nền và ưu tiên cho hàng đợi AI (BE-97, AI-15).
-- Mức ưu tiên (ocr_jobs.priority, số nhỏ chạy trước): 1 = làm ngay (người dùng bấm "Trích xuất ngay"), 3 = tương tác (đọc lại trang, tách văn bản),
-- 7 = khay nền (PDF mới tải lên). Giấy tờ được nâng mức xếp theo LÚC NÂNG (prioritized_at), không chen lên trước nhờ đã tải từ lâu.
-- preempted_count: số lần job nền tự nhường chỗ cho việc ưu tiên. `attempt` vẫn tăng đều mỗi lần được lấy (là mã chống nhầm chủ sở hữu, không bao giờ lặp lại),
-- nhưng giới hạn thử lại chỉ tính số lần thử THẬT = attempt - preempted_count (xem requeue_stale_jobs bên dưới và worker should_retry).
SET search_path = hoso, public, pg_catalog;

ALTER TABLE ocr_jobs
  ADD COLUMN prioritized_at timestamptz,
  ADD COLUMN prioritized_by uuid REFERENCES users(id),
  ADD COLUMN preempted_count integer NOT NULL DEFAULT 0 CHECK (preempted_count >= 0);

-- Cùng thứ tự với câu lấy việc của worker: priority, rồi thời điểm nâng mức (nếu có) hoặc thời điểm tạo.
DROP INDEX ocr_jobs_queue_idx;
CREATE INDEX ocr_jobs_queue_idx ON ocr_jobs(priority, (coalesce(prioritized_at, created_at))) WHERE status = 'queued';

-- Worker đang chờ cần được đánh thức cả khi một job đang chờ được nâng mức (ví dụ ngoài khung giờ khay nền chỉ nhận việc mức thấp).
DROP TRIGGER ocr_jobs_notify ON ocr_jobs;
CREATE TRIGGER ocr_jobs_notify AFTER INSERT OR UPDATE OF status, priority ON ocr_jobs
FOR EACH ROW EXECUTE FUNCTION notify_job_queued();

-- Thu hồi job treo: nhường chỗ không phải thất bại nên không tính vào giới hạn 3 lần thử.
CREATE OR REPLACE FUNCTION requeue_stale_jobs(p_stale interval DEFAULT interval '5 minutes', p_max_attempts integer DEFAULT 3)
RETURNS TABLE(job_id uuid, new_status text) LANGUAGE sql AS $$
  WITH stale AS (
    SELECT id, attempt - preempted_count AS attempt FROM hoso.ocr_jobs
    WHERE status = 'running' AND heartbeat_at < now() - p_stale
    FOR UPDATE SKIP LOCKED
  )
  UPDATE hoso.ocr_jobs j
  SET status = CASE WHEN s.attempt >= p_max_attempts THEN 'failed' ELSE 'queued' END,
      locked_by = NULL, stage = NULL,
      finished_at = CASE WHEN s.attempt >= p_max_attempts THEN now() END,
      error_message = CASE WHEN s.attempt >= p_max_attempts THEN 'Worker ngừng phản hồi nhiều lần; cần kiểm tra tệp hoặc máy xử lý.' ELSE j.error_message END
  FROM stale s WHERE j.id = s.id
  RETURNING j.id, j.status
$$;
