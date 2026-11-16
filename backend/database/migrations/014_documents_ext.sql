-- 014 · Văn bản mở rộng: tách văn bản từ PDF nhiều văn bản, liên kết văn bản, kết quả kiểm tra chữ ký.
SET search_path = hoso, public, pg_catalog;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA public;

CREATE TABLE document_segments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  source_document_id uuid NOT NULL REFERENCES documents(id),
  source_file_id uuid NOT NULL REFERENCES files(id),
  page_from integer NOT NULL CHECK (page_from > 0),
  page_to integer NOT NULL,
  target_document_id uuid REFERENCES documents(id),
  proposed_by text NOT NULL CHECK (proposed_by IN ('ai','user','separator_sheet')),
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed','rejected')),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (page_to >= page_from),
  CHECK ((status = 'confirmed') = (confirmed_at IS NOT NULL AND confirmed_by IS NOT NULL)),
  -- Hai đoạn đã xác nhận của cùng một tệp không được chồng trang.
  EXCLUDE USING gist (source_file_id WITH =, int4range(page_from, page_to, '[]') WITH &&) WHERE (status = 'confirmed')
);

CREATE TABLE document_relations (
  from_document_id uuid NOT NULL REFERENCES documents(id),
  to_document_id uuid NOT NULL REFERENCES documents(id),
  relation text NOT NULL CHECK (relation IN ('appendix_of','replaces','amends','responds_to','related')),
  note text NOT NULL DEFAULT '',
  created_by uuid REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (from_document_id, to_document_id, relation),
  CHECK (from_document_id <> to_document_id)
);

-- Chỉ ghi kết quả kỹ thuật khi kiểm tra chữ ký số; không kết luận hiệu lực pháp lý.
CREATE TABLE file_signatures (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  signer_name text,
  certificate_serial text,
  certificate_issuer text,
  signed_at timestamptz,
  verification_status text NOT NULL CHECK (verification_status IN ('valid','invalid','unknown','revoked')),
  verifier_version text NOT NULL,
  verified_at timestamptz NOT NULL DEFAULT now(),
  details jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(details) = 'object')
);
CREATE INDEX file_signatures_file_idx ON file_signatures(file_id);

ALTER TABLE document_field_values
  ADD COLUMN value_normalized text,
  ADD COLUMN ai_field_suggestion_id bigint REFERENCES ai_field_suggestions(id);
CREATE INDEX document_field_values_review_idx ON document_field_values(document_id) WHERE needs_review;
COMMENT ON COLUMN document_field_values.value_normalized IS 'Ngày ISO, số dạng 80.5; value_text giữ nguyên chuỗi gốc (số ký hiệu giữ số 0 đầu).';
