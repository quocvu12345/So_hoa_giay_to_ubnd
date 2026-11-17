-- BE-103: xác nhận metadata riêng, không tự nâng trạng thái dữ liệu đã nhập.
SET search_path = hoso, public, pg_catalog;
ALTER TABLE documents ADD COLUMN metadata_reviewed_by uuid REFERENCES users(id),
  ADD COLUMN metadata_reviewed_at timestamptz,
  ADD COLUMN metadata_review_note text NOT NULL DEFAULT '';
ALTER TABLE documents ADD CONSTRAINT documents_metadata_reviewer_check
  CHECK ((metadata_reviewed_by IS NULL) = (metadata_reviewed_at IS NULL));
