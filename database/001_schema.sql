-- PostgreSQL 16+. Migration 001; run through install.sql in a fresh database.
-- Public source metadata is separate from internal dossiers and demo workflow data.
SET search_path = hoso, pg_catalog;

CREATE TABLE organizations (
  code text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL CHECK (kind IN ('UBND','HDND')),
  locality text NOT NULL
);
CREATE TABLE departments (
  code text PRIMARY KEY,
  name text NOT NULL,
  kind text NOT NULL,
  assignment_note text NOT NULL,
  verification_status text NOT NULL DEFAULT 'proposed' CHECK (verification_status IN ('proposed','confirmed')),
  valid_from date,
  valid_until date,
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
CREATE TABLE department_scopes (
  department_code text REFERENCES departments(code),
  organization_code text REFERENCES organizations(code),
  PRIMARY KEY (department_code, organization_code)
);
CREATE TABLE work_groups (
  code text PRIMARY KEY,
  organization_code text NOT NULL,
  department_code text NOT NULL,
  title text NOT NULL,
  responsibility text NOT NULL,
  filing_rule text NOT NULL,
  business_fields text NOT NULL,
  verification_status text NOT NULL DEFAULT 'proposed' CHECK (verification_status IN ('proposed','confirmed')),
  FOREIGN KEY (department_code,organization_code) REFERENCES department_scopes,
  UNIQUE (code,department_code,organization_code)
);
CREATE TABLE document_types (
  code text PRIMARY KEY,
  work_group_code text NOT NULL REFERENCES work_groups(code),
  name text NOT NULL,
  -- Contextual paper types: the same label can legitimately occur in several groups.
  UNIQUE (code,work_group_code)
);
CREATE TABLE field_definitions (
  code text PRIMARY KEY,
  document_type_code text NOT NULL REFERENCES document_types(code),
  label text NOT NULL,
  position integer NOT NULL CHECK (position > 0),
  value_type text NOT NULL DEFAULT 'text' CHECK (value_type IN ('text','date','number','boolean')),
  required_for_review boolean NOT NULL DEFAULT false,
  UNIQUE (document_type_code,position),
  UNIQUE (code,document_type_code)
);

CREATE TABLE users (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  username text NOT NULL UNIQUE,
  display_name text NOT NULL,
  external_auth_subject text UNIQUE,
  is_demo boolean NOT NULL DEFAULT false,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
  -- No plaintext passwords or real employee identities in the seed.
);
CREATE TABLE roles (
  code text PRIMARY KEY,
  name text NOT NULL,
  scope_kind text NOT NULL CHECK (scope_kind IN ('assigned','department','organization','technical'))
);
CREATE TABLE permissions (
  code text PRIMARY KEY,
  description text NOT NULL
);
CREATE TABLE role_permissions (
  role_code text REFERENCES roles(code),
  permission_code text REFERENCES permissions(code),
  PRIMARY KEY (role_code,permission_code)
);
CREATE TABLE user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  role_code text NOT NULL REFERENCES roles(code),
  organization_code text REFERENCES organizations(code),
  department_code text,
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz,
  assignment_basis text NOT NULL,
  FOREIGN KEY (department_code,organization_code) REFERENCES department_scopes,
  CHECK (valid_until IS NULL OR valid_until > valid_from),
  CHECK ((role_code = 'technical_admin' AND organization_code IS NULL AND department_code IS NULL)
    OR (role_code IN ('employee','manager') AND organization_code IS NOT NULL AND department_code IS NOT NULL)
    OR (role_code IN ('clerk','chair','council') AND organization_code IS NOT NULL)),
  UNIQUE NULLS NOT DISTINCT (user_id,role_code,organization_code,department_code,valid_from)
);

CREATE TABLE sources (
  id text PRIMARY KEY,
  publisher text NOT NULL,
  url text NOT NULL UNIQUE CHECK (url ~ '^https://'),
  resolved_url text NOT NULL CHECK (resolved_url ~ '^https://'),
  retrieved_at timestamptz NOT NULL,
  response_sha256 text NOT NULL CHECK (response_sha256 ~ '^[0-9a-f]{64}$'),
  verification_note text NOT NULL
);
CREATE TABLE documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  external_key text UNIQUE,
  origin text NOT NULL CHECK (origin IN ('public_source','internal','demo')),
  title text NOT NULL,
  document_form text NOT NULL,
  document_number text,
  issued_on date,
  published_at timestamptz,
  issuer_organization_code text REFERENCES organizations(code),
  issuer_name text,
  source_id text REFERENCES sources(id),
  metadata_status text NOT NULL DEFAULT 'unverified' CHECK (metadata_status IN ('unverified','registry_verified','header_checked','needs_review')),
  verification_note text NOT NULL DEFAULT '',
  -- Preserve conflicting observations; do not silently pick an uncertain canonical date.
  source_observations jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(source_observations) = 'object'),
  data_review_status text NOT NULL DEFAULT 'pending' CHECK (data_review_status IN ('pending','verified')),
  reviewed_by uuid REFERENCES users(id),
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (origin <> 'public_source' OR source_id IS NOT NULL),
  CHECK ((data_review_status = 'pending' AND reviewed_by IS NULL AND reviewed_at IS NULL)
    OR (data_review_status = 'verified' AND reviewed_by IS NOT NULL AND reviewed_at IS NOT NULL))
);
-- Number alone is NOT unique: e.g. 17/NQ-HĐND exists in 2025 and 2026.
CREATE INDEX documents_number_issuer_idx ON documents(issuer_organization_code,document_number,issued_on);
CREATE INDEX documents_search_idx ON documents USING gin(to_tsvector('simple',coalesce(document_number,'') || ' ' || title));
CREATE TABLE document_classifications (
  document_id uuid REFERENCES documents(id),
  work_group_code text REFERENCES work_groups(code),
  document_type_code text,
  classification_status text NOT NULL DEFAULT 'proposed' CHECK (classification_status IN ('proposed','confirmed')),
  basis text NOT NULL,
  PRIMARY KEY (document_id,work_group_code),
  FOREIGN KEY (document_type_code,work_group_code) REFERENCES document_types(code,work_group_code)
);
CREATE TABLE files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  document_id uuid NOT NULL REFERENCES documents(id),
  component_key text NOT NULL DEFAULT 'main',
  version_no integer NOT NULL CHECK (version_no > 0),
  file_role text NOT NULL CHECK (file_role IN ('published_pdf','published_attachment','scan','derivative')),
  original_name text NOT NULL,
  media_type text NOT NULL,
  byte_size bigint NOT NULL CHECK (byte_size > 0),
  sha256 text NOT NULL CHECK (sha256 ~ '^[0-9a-f]{64}$'),
  page_count integer CHECK (page_count > 0),
  external_url text CHECK (external_url ~ '^https://'),
  local_path text,
  storage_key text,
  verified_download_at timestamptz,
  UNIQUE (document_id,component_key,version_no),
  UNIQUE (id,document_id),
  CHECK (external_url IS NOT NULL OR local_path IS NOT NULL OR storage_key IS NOT NULL)
  -- A PDF download/hash is not verification of its electronic signature.
);
CREATE TABLE ocr_jobs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id uuid NOT NULL REFERENCES files(id),
  provider text NOT NULL,
  model_version text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','running','completed','failed')),
  started_at timestamptz,
  finished_at timestamptz,
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  CHECK (finished_at IS NULL OR (started_at IS NOT NULL AND finished_at >= started_at))
);
CREATE TABLE document_field_values (
  document_id uuid REFERENCES documents(id),
  field_definition_code text REFERENCES field_definitions(code),
  value_text text,
  value_origin text NOT NULL CHECK (value_origin IN ('manual','ocr','public_metadata','demo')),
  confidence numeric(5,4) CHECK (confidence BETWEEN 0 AND 1),
  source_file_id uuid,
  source_page integer CHECK (source_page > 0),
  source_region jsonb CHECK (source_region IS NULL OR jsonb_typeof(source_region) = 'object'),
  needs_review boolean NOT NULL DEFAULT true,
  verified_by uuid REFERENCES users(id),
  verified_at timestamptz,
  PRIMARY KEY (document_id,field_definition_code),
  FOREIGN KEY (source_file_id,document_id) REFERENCES files(id,document_id),
  CHECK (source_page IS NULL OR source_file_id IS NOT NULL),
  CHECK (needs_review OR (verified_by IS NOT NULL AND verified_at IS NOT NULL)),
  CHECK ((verified_by IS NULL) = (verified_at IS NULL))
);

CREATE TABLE workflow_states (
  code text PRIMARY KEY,
  label text NOT NULL
);
CREATE TABLE dossiers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  origin text NOT NULL CHECK (origin IN ('internal','demo')),
  title text NOT NULL,
  year integer NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  organization_code text NOT NULL REFERENCES organizations(code),
  department_code text NOT NULL,
  work_group_code text NOT NULL,
  creator_organization_name text,
  physical_location text,
  assignee_id uuid REFERENCES users(id),
  status text NOT NULL DEFAULT 'draft' REFERENCES workflow_states(code),
  internal_due_on date,
  access_level text NOT NULL DEFAULT 'internal' CHECK (access_level IN ('internal','restricted','public')),
  retention_rule_reference text,
  notes text NOT NULL DEFAULT '',
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  archived_at timestamptz,
  FOREIGN KEY (work_group_code,department_code,organization_code) REFERENCES work_groups(code,department_code,organization_code),
  CHECK ((status = 'archived') = (archived_at IS NOT NULL))
);
CREATE INDEX dossiers_queue_idx ON dossiers(organization_code,department_code,status,internal_due_on);
CREATE INDEX dossiers_assignee_idx ON dossiers(assignee_id,status);
CREATE TABLE dossier_documents (
  dossier_id uuid REFERENCES dossiers(id),
  document_id uuid REFERENCES documents(id),
  position integer NOT NULL CHECK (position > 0),
  direction text CHECK (direction IN ('incoming','outgoing','internal')),
  relation_kind text NOT NULL DEFAULT 'component' CHECK (relation_kind IN ('component','reference')),
  PRIMARY KEY (dossier_id,document_id),
  UNIQUE (dossier_id,position)
);
CREATE TABLE workflow_transitions (
  from_state text REFERENCES workflow_states(code),
  action text,
  actor_role text REFERENCES roles(code),
  to_state text NOT NULL REFERENCES workflow_states(code),
  requires_verified_documents boolean NOT NULL,
  requires_note boolean NOT NULL,
  PRIMARY KEY (from_state,action,actor_role)
);
CREATE TABLE workflow_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dossier_id uuid NOT NULL REFERENCES dossiers(id),
  actor_id uuid NOT NULL REFERENCES users(id),
  actor_role text NOT NULL REFERENCES roles(code),
  action text NOT NULL,
  from_state text REFERENCES workflow_states(code),
  to_state text NOT NULL REFERENCES workflow_states(code),
  note text NOT NULL,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX workflow_events_dossier_idx ON workflow_events(dossier_id,happened_at DESC);
CREATE TABLE audit_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  table_name text NOT NULL,
  operation text NOT NULL,
  database_user text NOT NULL,
  actor_subject text,
  old_row jsonb,
  new_row jsonb,
  happened_at timestamptz NOT NULL DEFAULT now()
);

CREATE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO hoso.audit_events(table_name,operation,database_user,actor_subject,old_row,new_row)
  VALUES (TG_TABLE_NAME,TG_OP,session_user,nullif(current_setting('hoso.actor_subject',true),''),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER documents_audit AFTER INSERT OR UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER dossiers_audit AFTER INSERT OR UPDATE OR DELETE ON dossiers FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER field_values_audit AFTER INSERT OR UPDATE OR DELETE ON document_field_values FOR EACH ROW EXECUTE FUNCTION audit_change();

CREATE FUNCTION reject_log_mutation() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'History is append-only'; END $$;
CREATE TRIGGER workflow_events_immutable BEFORE UPDATE OR DELETE ON workflow_events FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();
CREATE TRIGGER audit_events_immutable BEFORE UPDATE OR DELETE ON audit_events FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();

CREATE FUNCTION guard_field_definition() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM hoso.document_classifications c JOIN hoso.field_definitions f
    ON f.document_type_code=c.document_type_code
    WHERE c.document_id=NEW.document_id AND f.code=NEW.field_definition_code
  ) THEN RAISE EXCEPTION 'Field definition does not match a classified paper type'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER field_definition_guard BEFORE INSERT OR UPDATE ON document_field_values
FOR EACH ROW EXECUTE FUNCTION guard_field_definition();

CREATE FUNCTION scope_matches(p_user uuid,p_dossier uuid,p_role text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1 FROM hoso.dossiers d
    JOIN hoso.user_roles ur ON ur.user_id=p_user AND ur.role_code=p_role
      AND ur.organization_code=d.organization_code
    JOIN hoso.users u ON u.id=ur.user_id AND u.active
    WHERE d.id=p_dossier AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
      AND (ur.department_code IS NULL OR ur.department_code=d.department_code)
      AND (p_role <> 'employee' OR d.assignee_id=p_user)
      AND p_role <> 'technical_admin'
      AND (p_role <> 'chair' OR d.organization_code='tl-ubnd')
      AND (p_role <> 'council' OR d.organization_code='tl-hdnd')
  );
$$;
CREATE FUNCTION transition_dossier(p_dossier uuid,p_actor uuid,p_role text,p_action text,p_note text DEFAULT '')
RETURNS text LANGUAGE plpgsql AS $$
DECLARE d hoso.dossiers%ROWTYPE; t hoso.workflow_transitions%ROWTYPE; target text;
BEGIN
  SELECT * INTO STRICT d FROM hoso.dossiers WHERE id=p_dossier FOR UPDATE;
  IF NOT hoso.scope_matches(p_actor,p_dossier,p_role) THEN RAISE EXCEPTION 'Actor outside dossier scope'; END IF;
  SELECT * INTO t FROM hoso.workflow_transitions WHERE from_state=d.status AND action=p_action AND actor_role=p_role;
  IF NOT FOUND THEN RAISE EXCEPTION 'Action not allowed at current workflow step'; END IF;
  IF t.requires_note AND length(btrim(coalesce(p_note,''))) < 10 THEN RAISE EXCEPTION 'A meaningful handling note is required'; END IF;
  IF t.requires_verified_documents AND (
    NOT EXISTS (SELECT 1 FROM hoso.dossier_documents WHERE dossier_id=p_dossier AND relation_kind='component')
    OR EXISTS (SELECT 1 FROM hoso.dossier_documents dd JOIN hoso.documents doc ON doc.id=dd.document_id
      WHERE dd.dossier_id=p_dossier AND dd.relation_kind='component' AND (doc.data_review_status <> 'verified' OR doc.metadata_status='needs_review'
        OR EXISTS (SELECT 1 FROM hoso.document_field_values fv WHERE fv.document_id=doc.id AND fv.needs_review)))
  ) THEN RAISE EXCEPTION 'Dossier contains missing or unverified components'; END IF;
  target:=t.to_state;
  IF p_action='submit' AND d.department_code IN ('tt','db') THEN target:='leadership_review'; END IF;
  IF p_action='return' AND p_role IN ('chair','council') AND d.department_code IN ('tt','db') THEN target:='returned'; END IF;
  UPDATE hoso.dossiers SET status=target,updated_at=now(),archived_at=CASE WHEN target='archived' THEN now() END WHERE id=p_dossier;
  INSERT INTO hoso.workflow_events(dossier_id,actor_id,actor_role,action,from_state,to_state,note)
    VALUES(p_dossier,p_actor,p_role,p_action,d.status,target,coalesce(p_note,''));
  RETURN target;
END $$;
-- This is a backend helper, not authentication. The API must bind p_actor to the
-- authenticated principal. Do not expose arbitrary SQL or caller-controlled identities.

CREATE VIEW v_public_documents AS
SELECT d.id,d.external_key,d.document_number,d.title,d.document_form,d.issued_on,
  d.issuer_name,d.metadata_status,d.verification_note,d.source_observations,
  s.url AS source_url,s.publisher,s.retrieved_at,
  f.external_url AS file_url,f.local_path,f.sha256,f.byte_size,f.page_count
FROM documents d JOIN sources s ON s.id=d.source_id
LEFT JOIN files f ON f.document_id=d.id AND f.component_key='main' AND f.version_no=1 WHERE d.origin='public_source';
CREATE VIEW v_dossier_summary AS
SELECT d.*,g.title AS work_group_title,dep.name AS department_name,ws.label AS status_label,
  count(dd.document_id) AS document_count,
  count(dd.document_id) FILTER (WHERE doc.data_review_status='verified') AS verified_count
FROM dossiers d JOIN work_groups g ON g.code=d.work_group_code JOIN departments dep ON dep.code=d.department_code
JOIN workflow_states ws ON ws.code=d.status LEFT JOIN dossier_documents dd ON dd.dossier_id=d.id
LEFT JOIN documents doc ON doc.id=dd.document_id GROUP BY d.id,g.title,dep.name,ws.label;
CREATE VIEW v_catalog_composition AS
SELECT g.code AS work_group_code,g.title AS work_group_title,g.organization_code,g.department_code,
  dt.code AS document_type_code,dt.name AS document_type_name,
  jsonb_agg(jsonb_build_object('code',f.code,'label',f.label,'required',f.required_for_review) ORDER BY f.position) AS fields
FROM work_groups g JOIN document_types dt ON dt.work_group_code=g.code
JOIN field_definitions f ON f.document_type_code=dt.code GROUP BY g.code,dt.code;

COMMENT ON TABLE sources IS 'Nguồn công khai đã truy cập, có hash phản hồi và thời điểm kiểm tra; không khẳng định giấy phép dữ liệu mở.';
COMMENT ON TABLE documents IS 'Văn bản thật độc lập với hồ sơ nội bộ. Ngày đăng, ngày ban hành và thời gian ký sao y là các dữ kiện khác nhau.';
COMMENT ON TABLE document_classifications IS 'Gợi ý ghép văn bản vào danh mục sản phẩm; không suy ra phòng chủ trì thực tế của cơ quan.';
COMMENT ON TABLE user_roles IS 'Phân công và phạm vi theo thời gian; seed người dùng chỉ là tài khoản giả lập, không phải cán bộ thật.';
COMMENT ON FUNCTION transition_dossier(uuid,uuid,text,text,text) IS 'Luồng hoàn thiện gói số hóa đề xuất; không thay ký số, phê duyệt chuyên môn hoặc biểu quyết.';
