-- 013 · Xử lý AI: hàng đợi job, từng trang OCR, gợi ý phân loại và trường.
-- Giao kèo với worker Python (ai-worker/): docs/08-dich-vu-ai.md, ai-worker/src/hoso_ai/queue/postgres.py.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE ai_models (
  key text PRIMARY KEY CHECK (key IN ('ocr','layout','orientation','classifier','qwen_vl','fake')),
  repo text NOT NULL,
  revision text NOT NULL CHECK (revision ~ '^[0-9a-f]{40}$'),
  purpose text NOT NULL,
  receipt jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true
);
-- Phiên bản cố định, lấy từ document_ai/config.py. Đổi mô hình = thêm bản ghi mới sau khi chạy bộ đánh giá.
INSERT INTO ai_models(key, repo, revision, purpose) VALUES
  ('ocr','PaddlePaddle/PaddleOCR-VL-1.6','132c45f52c0a26ed5a6b2f6bd8e3985794cc27dd','Đọc chữ trang quét (VLM)'),
  ('layout','PaddlePaddle/PP-DocLayoutV3','241f8bdfc77a7c7bee915a5057aaee58c235a8d3','Phát hiện bố cục trang'),
  ('orientation','PaddlePaddle/PP-LCNet_x1_0_doc_ori','d3b95a6dff5fe8a94f2748e12b61cb26818a0df8','Phát hiện hướng trang'),
  ('classifier','mlx-community/Qwen3-4B-Instruct-2507-4bit','50d427756c6b1b2fe0c0a10f67fbda1fc8e82c1b','Gợi ý nhóm, loại giấy tờ và trích trường'),
  ('qwen_vl','mlx-community/Qwen3-VL-8B-Instruct-4bit','defcdea7cc7a4b0858fea563cbbce171d328e457','Đối chiếu ảnh + chữ (tùy chọn)');
-- Mô hình GIẢ cho HOSO_AI_PROFILE=fake (chạy thử luồng khi không có máy AI). Luôn active=false: không bao giờ là kết quả thật.
INSERT INTO ai_models(key, repo, revision, purpose, active) VALUES
  ('fake','local/fake','0000000000000000000000000000000000000000','Giả lập để thử luồng tiếp nhận, KHÔNG phải kết quả AI', false);

ALTER TABLE ocr_jobs
  ALTER COLUMN provider SET DEFAULT 'hoso-ai-worker',
  ALTER COLUMN model_version SET DEFAULT 'unspecified',
  ADD COLUMN job_type text NOT NULL DEFAULT 'read_classify' CHECK (job_type IN ('read_classify','reread_page','segment','reclassify')),
  ADD COLUMN options jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(options) = 'object'),
  ADD COLUMN stage text,
  ADD COLUMN page_count integer CHECK (page_count > 0),
  ADD COLUMN processed_pages integer NOT NULL DEFAULT 0 CHECK (processed_pages >= 0),
  ADD COLUMN priority smallint NOT NULL DEFAULT 5 CHECK (priority BETWEEN 1 AND 9),
  ADD COLUMN attempt smallint NOT NULL DEFAULT 0 CHECK (attempt >= 0),
  ADD COLUMN requested_by uuid REFERENCES users(id),
  ADD COLUMN locked_by text,
  ADD COLUMN heartbeat_at timestamptz,
  ADD COLUMN warnings jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(warnings) = 'array');
CREATE INDEX ocr_jobs_queue_idx ON ocr_jobs(priority, created_at) WHERE status = 'queued';
CREATE INDEX ocr_jobs_running_idx ON ocr_jobs(heartbeat_at) WHERE status = 'running';
CREATE INDEX ocr_jobs_file_idx ON ocr_jobs(file_id, created_at DESC);

-- Báo cho worker đang chờ: có việc mới.
CREATE FUNCTION notify_job_queued() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'queued' THEN PERFORM pg_notify('job_queued', NEW.id::text); END IF;
  RETURN NULL;
END $$;
CREATE TRIGGER ocr_jobs_notify AFTER INSERT OR UPDATE OF status ON ocr_jobs
FOR EACH ROW EXECUTE FUNCTION notify_job_queued();

CREATE TABLE ocr_pages (
  job_id uuid NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  page_no integer NOT NULL CHECK (page_no > 0),
  method text NOT NULL CHECK (method IN ('pdf_text','ocr','failed')),
  text text NOT NULL DEFAULT '',
  native_text text NOT NULL DEFAULT '',
  blocks jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(blocks) = 'array'),
  status text NOT NULL CHECK (status IN ('completed','empty','failed')),
  elapsed_seconds numeric(9,2) NOT NULL DEFAULT 0,
  search_vector tsvector GENERATED ALWAYS AS (to_tsvector('simple', hoso.f_unaccent(text))) STORED,
  PRIMARY KEY (job_id, page_no)
);
CREATE INDEX ocr_pages_search_idx ON ocr_pages USING gin (search_vector);

CREATE TABLE ai_suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  job_id uuid NOT NULL REFERENCES ocr_jobs(id) ON DELETE CASCADE,
  document_id uuid NOT NULL REFERENCES documents(id),
  work_group_code text REFERENCES work_groups(code),
  document_type_code text,
  document_form text NOT NULL DEFAULT '',
  title text NOT NULL DEFAULT '',
  reason text NOT NULL DEFAULT '',
  quote text NOT NULL DEFAULT '',
  evidence_verified boolean NOT NULL DEFAULT false,
  mixed_documents boolean NOT NULL DEFAULT false,
  model_key text NOT NULL REFERENCES ai_models(key),
  decision text CHECK (decision IN ('accepted','changed','rejected')),
  decided_by uuid REFERENCES users(id),
  decided_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_type_code, work_group_code) REFERENCES document_types(code, work_group_code),
  CHECK (document_type_code IS NULL OR work_group_code IS NOT NULL),
  CHECK ((decision IS NULL) = (decided_at IS NULL))
);
CREATE INDEX ai_suggestions_document_idx ON ai_suggestions(document_id, created_at DESC);

CREATE TABLE ai_field_suggestions (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  suggestion_id bigint NOT NULL REFERENCES ai_suggestions(id) ON DELETE CASCADE,
  field_definition_code text NOT NULL REFERENCES field_definitions(code),
  value text NOT NULL DEFAULT '',
  quote text NOT NULL DEFAULT '',
  source_pages integer[] NOT NULL DEFAULT '{}',
  source_region jsonb CHECK (source_region IS NULL OR jsonb_typeof(source_region) = 'object'),
  quote_verified boolean NOT NULL DEFAULT false,
  confidence numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
  UNIQUE (suggestion_id, field_definition_code)
);

-- Thu hồi job treo: worker chết giữa chừng thì sau 5 phút job quay lại hàng đợi (tối đa 3 lần rồi failed).
-- Trang đã đọc giữ nguyên trong ocr_pages nên lần sau chỉ đọc phần còn thiếu.
CREATE FUNCTION requeue_stale_jobs(p_stale interval DEFAULT interval '5 minutes', p_max_attempts integer DEFAULT 3)
RETURNS TABLE(job_id uuid, new_status text) LANGUAGE sql AS $$
  WITH stale AS (
    SELECT id, attempt FROM hoso.ocr_jobs
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
