-- 015 · Hồ sơ mở rộng: ba quy trình, phân công nhiều người, cấp mã hồ sơ an toàn khi chạy đồng thời.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE workflow_definitions (
  code text PRIMARY KEY,
  name text NOT NULL,
  description text NOT NULL
);
INSERT INTO workflow_definitions(code, name, description) VALUES
  ('in_progress','Hồ sơ đang xử lý (luồng B)','Chuyên viên chuẩn bị → trưởng phòng kiểm tra → lãnh đạo cho ý kiến nếu cần → nộp lưu.'),
  ('digitize_closed','Số hóa hồ sơ giấy đã kết thúc (luồng A)','Không trình ký lại: đối chiếu và kiểm tra chất lượng → kiểm tra gói nộp lưu. ĐỀ XUẤT, cần cơ quan xác nhận.'),
  ('council','Kỳ họp, thẩm tra, giám sát HĐND (luồng C)','Chuẩn bị → Ban thẩm tra/giám sát → lãnh đạo HĐND → nộp lưu. ĐỀ XUẤT, cần cơ quan xác nhận.');

ALTER TABLE workflow_transitions ADD COLUMN workflow_code text NOT NULL DEFAULT 'in_progress' REFERENCES workflow_definitions(code);
ALTER TABLE workflow_transitions DROP CONSTRAINT workflow_transitions_pkey;
ALTER TABLE workflow_transitions ADD PRIMARY KEY (workflow_code, from_state, action, actor_role);
-- Luồng A bỏ bước lãnh đạo cho ý kiến; luồng C dùng đủ các bước (hàm transition_dossier tự đưa Thường trực/Tổ đại biểu lên lãnh đạo).
INSERT INTO workflow_transitions(workflow_code, from_state, action, actor_role, to_state, requires_verified_documents, requires_note)
SELECT 'digitize_closed', from_state, action, actor_role, to_state, requires_verified_documents, requires_note
FROM workflow_transitions WHERE workflow_code = 'in_progress' AND from_state <> 'leadership_review' AND action <> 'escalate';
INSERT INTO workflow_transitions(workflow_code, from_state, action, actor_role, to_state, requires_verified_documents, requires_note)
SELECT 'council', from_state, action, actor_role, to_state, requires_verified_documents, requires_note
FROM workflow_transitions WHERE workflow_code = 'in_progress';

ALTER TABLE dossiers
  ADD COLUMN workflow_code text NOT NULL DEFAULT 'in_progress' REFERENCES workflow_definitions(code),
  ADD COLUMN holding_department_code text REFERENCES departments(code),
  ADD COLUMN opened_on date,
  ADD COLUMN closed_on date,
  ADD CONSTRAINT dossiers_dates_check CHECK (closed_on IS NULL OR opened_on IS NULL OR closed_on >= opened_on);
CREATE INDEX dossiers_title_trgm_idx ON dossiers USING gin (hoso.f_fold(title) gin_trgm_ops);
CREATE INDEX dossiers_keyset_idx ON dossiers(updated_at DESC, id DESC);

ALTER TABLE dossier_documents
  ADD COLUMN added_by uuid REFERENCES users(id),
  ADD COLUMN added_at timestamptz NOT NULL DEFAULT now();
CREATE INDEX dossier_documents_document_idx ON dossier_documents(document_id);

CREATE TABLE dossier_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid NOT NULL REFERENCES dossiers(id),
  user_id uuid NOT NULL REFERENCES users(id),
  assignment_role text NOT NULL CHECK (assignment_role IN ('lead','support','reviewer')),
  due_on date,
  assigned_by uuid NOT NULL REFERENCES users(id),
  assigned_at timestamptz NOT NULL DEFAULT now(),
  ended_at timestamptz,
  note text NOT NULL DEFAULT ''
);
CREATE INDEX dossier_assignments_user_idx ON dossier_assignments(user_id) WHERE ended_at IS NULL;
-- Mỗi hồ sơ chỉ có một người chủ trì tại một thời điểm.
CREATE UNIQUE INDEX dossier_assignments_lead_uq ON dossier_assignments(dossier_id) WHERE assignment_role = 'lead' AND ended_at IS NULL;
INSERT INTO dossier_assignments(dossier_id, user_id, assignment_role, assigned_by, note)
SELECT id, assignee_id, 'lead', created_by, 'Chuyển từ cột assignee_id khi nâng cấp CSDL' FROM dossiers WHERE assignee_id IS NOT NULL;

CREATE TABLE dossier_code_sequences (
  organization_code text NOT NULL REFERENCES organizations(code),
  year integer NOT NULL CHECK (year BETWEEN 1900 AND 2200),
  last_value integer NOT NULL DEFAULT 0 CHECK (last_value >= 0),
  PRIMARY KEY (organization_code, year)
);
-- UBND-2026-000123. Hàng chỉ bị khóa trong lúc cấp mã nên hai người tạo hồ sơ cùng lúc không trùng mã.
CREATE FUNCTION next_dossier_code(p_org text, p_year integer) RETURNS text LANGUAGE plpgsql AS $$
DECLARE n integer;
BEGIN
  INSERT INTO hoso.dossier_code_sequences(organization_code, year, last_value) VALUES (p_org, p_year, 1)
  ON CONFLICT (organization_code, year) DO UPDATE SET last_value = hoso.dossier_code_sequences.last_value + 1
  RETURNING last_value INTO n;
  RETURN CASE p_org WHEN 'tl-ubnd' THEN 'UBND' WHEN 'tl-hdnd' THEN 'HDND' ELSE upper(p_org) END
         || '-' || p_year || '-' || lpad(n::text, 6, '0');
END $$;
