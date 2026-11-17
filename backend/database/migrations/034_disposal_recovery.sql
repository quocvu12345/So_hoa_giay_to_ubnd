-- BE-101/104: chặn nội dung và lưu công việc xóa trước; kho tệp được xử lý sau COMMIT.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE disposal_requests DROP CONSTRAINT disposal_requests_status_check;
ALTER TABLE disposal_requests DROP CONSTRAINT disposal_requests_check;
ALTER TABLE disposal_requests DROP CONSTRAINT disposal_requests_check1;
ALTER TABLE disposal_requests ADD CONSTRAINT disposal_requests_status_check
  CHECK (status IN ('requested','approved','rejected','executing','executed'));
ALTER TABLE disposal_requests ADD CONSTRAINT disposal_requests_decision_check
  CHECK (status NOT IN ('approved','executing','executed') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_document_id IS NOT NULL));
ALTER TABLE disposal_requests ADD CONSTRAINT disposal_requests_execution_check
  CHECK ((status = 'executed') = (executed_at IS NOT NULL) AND (status NOT IN ('executing','executed') OR executed_by IS NOT NULL));
ALTER TABLE disposal_requests ADD COLUMN files_disposed integer NOT NULL DEFAULT 0,
  ADD COLUMN documents_kept integer NOT NULL DEFAULT 0;
DROP INDEX disposal_requests_one_open_per_dossier;
CREATE UNIQUE INDEX disposal_requests_one_open_per_dossier ON disposal_requests(dossier_id)
  WHERE status IN ('requested','approved','executing');

CREATE TABLE disposal_blob_deletions (
  request_id uuid NOT NULL REFERENCES disposal_requests(id),
  storage_key text NOT NULL,
  completed_at timestamptz,
  deleted boolean NOT NULL DEFAULT false,
  attempts integer NOT NULL DEFAULT 0,
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  last_error text,
  PRIMARY KEY(request_id, storage_key)
);
CREATE INDEX disposal_blob_deletions_pending ON disposal_blob_deletions(next_attempt_at) WHERE completed_at IS NULL;
GRANT SELECT, INSERT, UPDATE ON disposal_blob_deletions TO hoso_api;

-- Khóa xmin bảo vệ các quyết định trên cùng một dòng; ứng dụng ánh xạ cột hệ thống, không thêm cột.
COMMENT ON TABLE disposal_blob_deletions IS 'Công việc xóa bền vững sau khi metadata đã chặn truy cập; xóa gọi lại an toàn, không mất danh sách khi kho lỗi.';
