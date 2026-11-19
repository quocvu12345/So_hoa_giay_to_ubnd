-- 044 · Trạng thái từng worker AI và máy chạy mô hình của nó (AI-24, BE-133).
-- Trước đây chỉ biết worker còn sống khi nó đang giữ một job (ocr_jobs.heartbeat_at): worker rảnh, worker đã chết và máy AI ở nơi khác
-- (Ollama trên máy Windows qua Tailscale) không trả lời trông y hệt nhau, người dùng chỉ thấy "đang chờ" mãi.
-- Worker ghi dòng của mình khi khởi động, khoảng 30 giây một lần (cả lúc rảnh lẫn lúc đang đọc), và ngay khi máy chạy mô hình đổi trạng thái
-- (kèm NOTIFY ai_worker_status để API báo giao diện); tắt êm thì xóa dòng. API đọc để báo ở trang vận hành, hộp tiếp nhận và /health/ready.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE ai_workers (
  worker_id         text PRIMARY KEY CHECK (length(worker_id) BETWEEN 1 AND 200),
  profile           text NOT NULL,
  -- Máy chạy mô hình khi nó ở nơi khác (ví dụ "Ollama http://100.78.102.53:11434"); NULL khi mô hình chạy ngay trong worker.
  engine            text CHECK (length(engine) <= 300),
  engine_ok         boolean NOT NULL DEFAULT true,
  engine_error      text CHECK (length(engine_error) <= 1000),
  engine_down_since timestamptz,
  current_job_id    uuid,
  started_at        timestamptz NOT NULL DEFAULT now(),
  last_seen_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT ai_workers_down_has_since CHECK (engine_ok OR engine_down_since IS NOT NULL)
);
COMMENT ON TABLE ai_workers IS 'Mỗi worker AI một dòng, do chính worker ghi (AI-24). Sống = last_seen_at trong 2 phút. Không chứa dữ liệu hồ sơ.';

-- Chỉ worker ghi; API và báo cáo chỉ đọc.
GRANT SELECT, INSERT, UPDATE, DELETE ON ai_workers TO hoso_ai_worker;
GRANT SELECT ON ai_workers TO hoso_api, hoso_readonly;
REVOKE INSERT, UPDATE, DELETE ON ai_workers FROM hoso_api;
