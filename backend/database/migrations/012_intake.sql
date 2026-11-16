-- 012 · Tiếp nhận và số hóa: lô quét, ảnh từng trang, lỗi chất lượng, chống nạp trùng.
SET search_path = hoso, public, pg_catalog;

CREATE SEQUENCE scan_batch_seq;
CREATE TABLE scan_batches (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  organization_code text NOT NULL REFERENCES organizations(code),
  department_code text,
  handed_over_by text,
  received_by uuid NOT NULL REFERENCES users(id),
  handover_document_id uuid REFERENCES documents(id),
  box_label text,
  expected_sheet_count integer CHECK (expected_sheet_count >= 0),
  scanned_page_count integer NOT NULL DEFAULT 0 CHECK (scanned_page_count >= 0),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','scanning','qc','closed')),
  note text NOT NULL DEFAULT '',
  opened_at timestamptz NOT NULL DEFAULT now(),
  closed_at timestamptz,
  FOREIGN KEY (department_code, organization_code) REFERENCES department_scopes,
  CHECK ((status = 'closed') = (closed_at IS NOT NULL))
);
CREATE INDEX scan_batches_status_idx ON scan_batches(organization_code, status, opened_at DESC);

ALTER TABLE files
  ADD COLUMN scan_batch_id uuid REFERENCES scan_batches(id),
  ADD COLUMN uploaded_by uuid REFERENCES users(id),
  ADD COLUMN uploaded_at timestamptz;
-- Cùng một PDF quét không nạp hai lần; API trả 409 duplicate_file kèm giấy tờ cũ.
CREATE UNIQUE INDEX files_scan_sha256_uq ON files(sha256) WHERE file_role = 'scan';
CREATE INDEX files_scan_batch_idx ON files(scan_batch_id) WHERE scan_batch_id IS NOT NULL;

-- Giấy tờ vừa tải lên nằm ở hộp tiếp nhận (inbox) cho tới khi người dùng xếp vào hồ sơ.
ALTER TABLE documents
  ADD COLUMN intake_status text NOT NULL DEFAULT 'filed' CHECK (intake_status IN ('inbox','filed','discarded','split')),
  ADD COLUMN uploaded_by uuid REFERENCES users(id),
  ADD COLUMN discarded_at timestamptz,
  ADD COLUMN signer_name text,
  ADD COLUMN recipient_text text,
  ADD CONSTRAINT documents_discard_check CHECK ((intake_status = 'discarded') = (discarded_at IS NOT NULL));
CREATE INDEX documents_inbox_idx ON documents(uploaded_by, intake_status) WHERE intake_status IN ('inbox','discarded');
-- Tìm không dấu theo số ký hiệu + trích yếu (tiếng Việt: "dat dai" khớp "đất đai").
CREATE INDEX documents_fold_search_idx ON documents
  USING gin (to_tsvector('simple', hoso.f_unaccent(coalesce(document_number, '') || ' ' || title)));

CREATE TABLE page_images (
  file_id uuid NOT NULL REFERENCES files(id) ON DELETE CASCADE,
  page_no integer NOT NULL CHECK (page_no > 0),
  width_px integer CHECK (width_px > 0),
  height_px integer CHECK (height_px > 0),
  dpi smallint CHECK (dpi > 0),
  rotation smallint NOT NULL DEFAULT 0 CHECK (rotation IN (0, 90, 180, 270)),
  quality_flags text[] NOT NULL DEFAULT '{}'
    CHECK (quality_flags <@ ARRAY['blank','blurry','skewed','cropped','duplicate']::text[]),
  quality_status text NOT NULL DEFAULT 'ok' CHECK (quality_status IN ('ok','suspect','rescan_required','rescanned')),
  preview_storage_key text,
  PRIMARY KEY (file_id, page_no)
);
CREATE INDEX page_images_suspect_idx ON page_images(file_id) WHERE quality_status IN ('suspect','rescan_required');

CREATE TABLE quality_issues (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scan_batch_id uuid REFERENCES scan_batches(id),
  document_id uuid REFERENCES documents(id),
  file_id uuid REFERENCES files(id),
  page_no integer CHECK (page_no > 0),
  issue_type text NOT NULL CHECK (issue_type IN ('blank','blurry','skewed','cropped','duplicate','missing_page','wrong_order','other')),
  severity text NOT NULL DEFAULT 'medium' CHECK (severity IN ('low','medium','high')),
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','fixed','wont_fix')),
  raised_by uuid REFERENCES users(id),
  raised_at timestamptz NOT NULL DEFAULT now(),
  resolved_by uuid REFERENCES users(id),
  resolved_at timestamptz,
  CHECK (document_id IS NOT NULL OR file_id IS NOT NULL OR scan_batch_id IS NOT NULL),
  CHECK ((status = 'open') = (resolved_at IS NULL))
);
CREATE INDEX quality_issues_open_idx ON quality_issues(scan_batch_id, raised_at DESC) WHERE status = 'open';

CREATE FUNCTION next_scan_batch_code(p_year integer DEFAULT extract(year FROM now())::integer) RETURNS text
LANGUAGE sql AS $$ SELECT 'LQ-' || p_year || '-' || lpad(nextval('hoso.scan_batch_seq')::text, 4, '0') $$;
