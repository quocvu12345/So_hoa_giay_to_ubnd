-- 011 · Thủ tục hành chính cấp xã. Nạp bằng backend/scripts/import_procedures.py (chạy lại được) từ data/official-forms.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE procedures (
  id text PRIMARY KEY,                       -- mã nguồn: hn87-001 (danh mục Hà Nội) hoặc dvc-<uuid> (Cổng DVC Quốc gia)
  procedure_code text,                       -- KHÔNG duy nhất: một mã DVC có thể nằm ở cả hai nguồn
  name text NOT NULL,
  domain text,
  managing_agency text,
  execution_level text,
  competent_authority text,
  fees text,
  receiving_location text,
  ministry_decision text,
  hanoi_decision text,
  workflow_decision text,
  delegation_decision text,
  delegation_expiry text,
  source_url text,
  source_page integer,
  lifecycle_status text NOT NULL DEFAULT 'unverified' CHECK (lifecycle_status IN ('active','repealed','replaced','unverified')),
  collected_at timestamptz
);
CREATE INDEX procedures_code_idx ON procedures(procedure_code);
CREATE INDEX procedures_domain_idx ON procedures(domain);
CREATE INDEX procedures_name_trgm_idx ON procedures USING gin (hoso.f_fold(name) gin_trgm_ops);

-- 32 thủ tục đã có quyết định thay thế/bãi bỏ: giữ lịch sử, không dùng mẫu cũ làm mẫu hiện hành.
CREATE TABLE procedure_lifecycle_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  procedure_code text NOT NULL,
  status text NOT NULL CHECK (status IN ('active','repealed','replaced','unverified')),
  label text NOT NULL,
  note text NOT NULL DEFAULT '',
  evidence jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(evidence) = 'array'),
  effective_from date,
  reviewed_on date
);
CREATE INDEX procedure_lifecycle_events_code_idx ON procedure_lifecycle_events(procedure_code);

CREATE TABLE procedure_departments (
  procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  department_code text NOT NULL,
  organization_code text NOT NULL,
  verification_status text NOT NULL DEFAULT 'proposed' CHECK (verification_status IN ('proposed','confirmed')),
  PRIMARY KEY (procedure_id, department_code, organization_code),
  FOREIGN KEY (department_code, organization_code) REFERENCES department_scopes
);

CREATE TABLE paper_types (
  code text PRIMARY KEY,                     -- ví dụ G09-KQ003211
  canonical_name text NOT NULL,
  names jsonb NOT NULL DEFAULT '[]'::jsonb CHECK (jsonb_typeof(names) = 'array')
);

CREATE TABLE procedure_components (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  section text NOT NULL DEFAULT '',
  position integer NOT NULL CHECK (position > 0),
  name text NOT NULL,
  paper_code text REFERENCES paper_types(code),
  original_quantity smallint NOT NULL DEFAULT 0 CHECK (original_quantity >= 0),
  copy_quantity smallint NOT NULL DEFAULT 0 CHECK (copy_quantity >= 0),
  -- Một mục nguồn có thể chỉ là điều kiện hoặc lời hướng dẫn, không nhất thiết là giấy phải nộp.
  required_as_published boolean NOT NULL DEFAULT false,
  has_electronic_form boolean NOT NULL DEFAULT false
);
CREATE INDEX procedure_components_procedure_idx ON procedure_components(procedure_id, section, position);

-- 1.085 tệp mẫu chỉ có 768 nội dung khác nhau: lưu một lần theo mã băm, nhiều thành phần cùng trỏ tới.
CREATE TABLE form_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('blank_form','guide_pdf','eform_json','official_bundle')),
  filename text NOT NULL,
  sha256 text NOT NULL UNIQUE CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  byte_size bigint NOT NULL CHECK (byte_size >= 0),
  media_type text NOT NULL DEFAULT 'application/octet-stream',
  storage_key text,
  source_url text,
  version_label text,
  superseded_by uuid REFERENCES form_templates(id)
);

CREATE TABLE procedure_component_templates (
  component_id uuid NOT NULL REFERENCES procedure_components(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (component_id, template_id)
);
CREATE INDEX procedure_component_templates_template_idx ON procedure_component_templates(template_id);

-- Toạ độ trường trên mẫu (từ data/form-test-data/schemas.json) dùng cho trích xuất theo toạ độ và kiểm thử.
CREATE TABLE form_template_fields (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  field_key text NOT NULL,
  label text NOT NULL,
  page integer NOT NULL DEFAULT 1 CHECK (page > 0),
  bbox jsonb,
  input_type text NOT NULL DEFAULT 'text',
  role text,
  UNIQUE (template_id, field_key)
);

-- Hồ sơ theo thủ tục và liên kết giấy tờ với thành phần của thủ tục (danh sách kiểm tra đủ thành phần, BE-64).
ALTER TABLE dossiers ADD COLUMN procedure_id text REFERENCES procedures(id);
ALTER TABLE dossier_documents ADD COLUMN procedure_component_id uuid REFERENCES procedure_components(id);
CREATE INDEX dossiers_procedure_idx ON dossiers(procedure_id) WHERE procedure_id IS NOT NULL;
CREATE INDEX dossier_documents_component_idx ON dossier_documents(procedure_component_id) WHERE procedure_component_id IS NOT NULL;
