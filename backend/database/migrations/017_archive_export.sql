-- 017 · Nộp lưu theo đợt, xuất gói bàn giao, đề nghị hủy. Hủy là đường duy nhất được xóa tệp.
SET search_path = hoso, public, pg_catalog;

CREATE SEQUENCE archive_submission_seq;
CREATE FUNCTION next_archive_code(p_year integer DEFAULT extract(year FROM now())::integer) RETURNS text
LANGUAGE sql AS $$ SELECT 'NL-' || p_year || '-' || lpad(nextval('hoso.archive_submission_seq')::text, 4, '0') $$;

CREATE TABLE archive_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  organization_code text NOT NULL REFERENCES organizations(code),
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted','received','returned')),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  submitted_by uuid REFERENCES users(id),
  submitted_at timestamptz,
  received_by uuid REFERENCES users(id),
  received_at timestamptz,
  minutes_document_id uuid REFERENCES documents(id),
  note text NOT NULL DEFAULT '',
  return_note text NOT NULL DEFAULT '',
  CHECK (status NOT IN ('submitted','received') OR (submitted_by IS NOT NULL AND submitted_at IS NOT NULL)),
  CHECK ((status = 'received') = (received_at IS NOT NULL AND received_by IS NOT NULL))
);
CREATE INDEX archive_submissions_status_idx ON archive_submissions(organization_code, status, created_at DESC);

CREATE TABLE archive_submission_items (
  submission_id uuid NOT NULL REFERENCES archive_submissions(id) ON DELETE CASCADE,
  dossier_id uuid NOT NULL REFERENCES dossiers(id),
  page_count integer NOT NULL DEFAULT 0 CHECK (page_count >= 0),
  check_result text NOT NULL DEFAULT 'ok' CHECK (check_result IN ('ok','issue')),
  note text NOT NULL DEFAULT '',
  PRIMARY KEY (submission_id, dossier_id)
);
CREATE INDEX archive_submission_items_dossier_idx ON archive_submission_items(dossier_id);

CREATE TABLE export_packages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  requested_by uuid NOT NULL REFERENCES users(id),
  scope jsonb NOT NULL CHECK (jsonb_typeof(scope) = 'object'),
  format text NOT NULL DEFAULT 'zip_pdf_json' CHECK (format IN ('zip_pdf_json','zip_pdf_csv')),
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','ready','failed','expired')),
  total_items integer NOT NULL DEFAULT 0,
  processed_items integer NOT NULL DEFAULT 0,
  storage_key text,
  manifest_sha256 text CHECK (manifest_sha256 IS NULL OR manifest_sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint CHECK (byte_size >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  ready_at timestamptz,
  expires_at timestamptz,
  error_message text,
  CHECK (status <> 'ready' OR (storage_key IS NOT NULL AND ready_at IS NOT NULL AND expires_at IS NOT NULL))
);
CREATE INDEX export_packages_queue_idx ON export_packages(created_at) WHERE status = 'queued';
CREATE INDEX export_packages_user_idx ON export_packages(requested_by, created_at DESC);

CREATE TABLE disposal_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id),
  retention_rule_id uuid NOT NULL REFERENCES retention_rules(id),
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  status text NOT NULL DEFAULT 'requested' CHECK (status IN ('requested','approved','rejected','executed')),
  requested_by uuid NOT NULL REFERENCES users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  decided_by uuid REFERENCES users(id),
  decision_document_id uuid REFERENCES documents(id),
  decision_note text NOT NULL DEFAULT '',
  decided_at timestamptz,
  executed_by uuid REFERENCES users(id),
  executed_at timestamptz,
  -- Hủy chỉ thực hiện được khi đã phê duyệt và có văn bản quyết định; hệ thống không bao giờ tự hủy.
  CHECK (status NOT IN ('approved','executed') OR (decided_by IS NOT NULL AND decided_at IS NOT NULL AND decision_document_id IS NOT NULL)),
  CHECK ((status = 'executed') = (executed_at IS NOT NULL AND executed_by IS NOT NULL))
);
CREATE UNIQUE INDEX disposal_requests_one_open_per_dossier ON disposal_requests(dossier_id) WHERE status IN ('requested','approved');

-- Tệp đã hủy vẫn còn dòng metadata (không mất dấu vết) nhưng không còn nội dung.
ALTER TABLE files ADD COLUMN disposed_at timestamptz;
ALTER TABLE files DROP CONSTRAINT files_check;
ALTER TABLE files ADD CONSTRAINT files_check CHECK (external_url IS NOT NULL OR local_path IS NOT NULL OR storage_key IS NOT NULL OR disposed_at IS NOT NULL);

CREATE TRIGGER archive_submissions_audit AFTER INSERT OR UPDATE OR DELETE ON archive_submissions FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER disposal_requests_audit AFTER INSERT OR UPDATE OR DELETE ON disposal_requests FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER export_packages_audit AFTER INSERT OR UPDATE OR DELETE ON export_packages FOR EACH ROW EXECUTE FUNCTION audit_change();
