-- 019 · Hàm và view dùng chung: phạm vi truy cập, chuyển bước, hàng việc, mức đủ thành phần.
SET search_path = hoso, public, pg_catalog;

-- Quy tắc phạm vi MỘT NƠI DUY NHẤT (docs/03 mục 4). API gọi hàm này, không tự viết lại điều kiện.
--   1. Phân công còn hiệu lực của người dùng đang hoạt động; hoặc phân công được ủy quyền còn hiệu lực.
--   2. Chuyên viên chỉ thấy hồ sơ mình chủ trì hoặc được phối hợp.
--   3. Chủ tịch chỉ khối tl-ubnd, lãnh đạo HĐND chỉ khối tl-hdnd; quản trị kỹ thuật không đọc nội dung.
--   4. Hồ sơ 'restricted' cần thêm quyền cấp riêng còn hiệu lực.
CREATE OR REPLACE FUNCTION scope_matches(p_user uuid, p_dossier uuid, p_role text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM hoso.dossiers d
    JOIN hoso.users u ON u.id = p_user AND u.active
    JOIN LATERAL (
      SELECT ur.organization_code, ur.department_code
      FROM hoso.user_roles ur
      WHERE ur.user_id = p_user AND ur.role_code = p_role
        AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
      UNION ALL
      SELECT ur.organization_code, ur.department_code
      FROM hoso.delegations dg
      JOIN hoso.user_roles ur ON ur.id = dg.from_user_role_id AND ur.role_code = p_role
      JOIN hoso.users du ON du.id = ur.user_id AND du.active
      WHERE dg.to_user_id = p_user AND dg.revoked_at IS NULL
        AND dg.valid_from <= now() AND dg.valid_until > now()
        AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
    ) a ON a.organization_code = d.organization_code AND (a.department_code IS NULL OR a.department_code = d.department_code)
    WHERE d.id = p_dossier
      AND p_role <> 'technical_admin'
      AND (p_role <> 'employee' OR d.assignee_id = p_user OR EXISTS (
            SELECT 1 FROM hoso.dossier_assignments da WHERE da.dossier_id = d.id AND da.user_id = p_user AND da.ended_at IS NULL))
      AND (p_role <> 'chair' OR d.organization_code = 'tl-ubnd')
      AND (p_role <> 'council' OR d.organization_code = 'tl-hdnd')
      AND (d.access_level <> 'restricted' OR EXISTS (
            SELECT 1 FROM hoso.document_access_grants g
            WHERE g.dossier_id = d.id AND g.grantee_user_id = p_user AND g.revoked_at IS NULL AND g.valid_until > now()))
  );
$$;

CREATE VIEW v_dossier_completeness AS
SELECT d.id AS dossier_id,
       count(dd.document_id) FILTER (WHERE dd.relation_kind = 'component') AS component_count,
       count(dd.document_id) FILTER (WHERE dd.relation_kind = 'component' AND doc.data_review_status = 'verified') AS verified_count,
       count(dd.document_id) FILTER (WHERE dd.relation_kind = 'component' AND doc.metadata_status = 'needs_review') AS metadata_review_count,
       coalesce(sum(pending.n) FILTER (WHERE dd.relation_kind = 'component'), 0)::integer AS pending_field_count
FROM dossiers d
LEFT JOIN dossier_documents dd ON dd.dossier_id = d.id
LEFT JOIN documents doc ON doc.id = dd.document_id
LEFT JOIN LATERAL (SELECT count(*) AS n FROM document_field_values f WHERE f.document_id = doc.id AND f.needs_review) pending ON true
GROUP BY d.id;

-- Hàm chuyển bước thay thế bản ở 001: thêm quy trình theo hồ sơ, mã lỗi riêng (HSxxx) thay cho so chuỗi,
-- kiểm tra phiên bản (xmin) để chống ghi đè, ghi outbox và báo cho giao diện đang mở.
DROP FUNCTION transition_dossier(uuid, uuid, text, text, text);
CREATE FUNCTION transition_dossier(p_dossier uuid, p_actor uuid, p_role text, p_action text,
                                   p_note text DEFAULT '', p_expected_version bigint DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE d hoso.dossiers%ROWTYPE; t hoso.workflow_transitions%ROWTYPE; target text; version bigint;
BEGIN
  SELECT * INTO d FROM hoso.dossiers WHERE id = p_dossier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier not found' USING ERRCODE = 'HS006'; END IF;
  -- xmin là cột hệ thống nên không có trong biến dòng d (SELECT *): đọc riêng từ bảng sau khi đã khóa dòng.
  SELECT xmin::text::bigint INTO version FROM hoso.dossiers WHERE id = p_dossier;
  IF NOT hoso.scope_matches(p_actor, p_dossier, p_role) THEN
    RAISE EXCEPTION 'Actor outside dossier scope' USING ERRCODE = 'HS001';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> version THEN
    RAISE EXCEPTION 'Dossier was changed by someone else' USING ERRCODE = 'HS005';
  END IF;
  SELECT * INTO t FROM hoso.workflow_transitions
  WHERE workflow_code = d.workflow_code AND from_state = d.status AND action = p_action AND actor_role = p_role;
  IF NOT FOUND THEN RAISE EXCEPTION 'Action not allowed at current workflow step' USING ERRCODE = 'HS002'; END IF;
  IF t.requires_note AND length(btrim(coalesce(p_note, ''))) < 10 THEN
    RAISE EXCEPTION 'A meaningful handling note is required' USING ERRCODE = 'HS003';
  END IF;
  IF t.requires_verified_documents AND (
    NOT EXISTS (SELECT 1 FROM hoso.dossier_documents WHERE dossier_id = p_dossier AND relation_kind = 'component')
    OR EXISTS (SELECT 1 FROM hoso.dossier_documents dd JOIN hoso.documents doc ON doc.id = dd.document_id
      WHERE dd.dossier_id = p_dossier AND dd.relation_kind = 'component'
        AND (doc.data_review_status <> 'verified' OR doc.metadata_status = 'needs_review'
             OR EXISTS (SELECT 1 FROM hoso.document_field_values fv WHERE fv.document_id = doc.id AND fv.needs_review)))
  ) THEN RAISE EXCEPTION 'Dossier contains missing or unverified components' USING ERRCODE = 'HS004'; END IF;

  target := t.to_state;
  IF d.workflow_code <> 'digitize_closed' THEN
    IF p_action = 'submit' AND d.department_code IN ('tt','db') THEN target := 'leadership_review'; END IF;
    IF p_action = 'return' AND p_role IN ('chair','council') AND d.department_code IN ('tt','db') THEN target := 'returned'; END IF;
  END IF;

  UPDATE hoso.dossiers SET status = target, updated_at = now(),
         archived_at = CASE WHEN target = 'archived' THEN now() END,
         closed_on = CASE WHEN target = 'archived' THEN current_date ELSE closed_on END
  WHERE id = p_dossier;
  INSERT INTO hoso.workflow_events(dossier_id, actor_id, actor_role, action, from_state, to_state, note)
  VALUES (p_dossier, p_actor, p_role, p_action, d.status, target, coalesce(p_note, ''));
  INSERT INTO hoso.outbox_messages(type, payload) VALUES ('dossier.transitioned', jsonb_build_object(
    'dossierId', p_dossier, 'action', p_action, 'from', d.status, 'to', target, 'actorId', p_actor, 'actorRole', p_role));
  PERFORM pg_notify('dossier_changed', json_build_object('dossierId', p_dossier, 'status', target)::text);
  RETURN target;
END $$;
COMMENT ON FUNCTION transition_dossier(uuid, uuid, text, text, text, bigint) IS
'Luồng hoàn thiện gói số hóa đề xuất; không thay ký số, phê duyệt chuyên môn hoặc biểu quyết. Lỗi: HS001 ngoài phạm vi, HS002 bước không cho phép, HS003 thiếu ghi chú, HS004 chưa đủ/đối chiếu, HS005 xung đột phiên bản, HS006 không thấy hồ sơ.';

-- Giao người chủ trì: cập nhật assignee_id (để scope_matches giữ nguyên) và bảng phân công trong cùng giao dịch.
CREATE FUNCTION assign_dossier(p_dossier uuid, p_by uuid, p_user uuid, p_due date DEFAULT NULL, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE d hoso.dossiers%ROWTYPE;
BEGIN
  SELECT * INTO d FROM hoso.dossiers WHERE id = p_dossier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier not found' USING ERRCODE = 'HS006'; END IF;
  IF NOT EXISTS (
    SELECT 1 FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id AND u.active
    WHERE ur.user_id = p_user AND ur.role_code = 'employee' AND ur.organization_code = d.organization_code
      AND ur.department_code = d.department_code AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
  ) THEN RAISE EXCEPTION 'Assignee is not an active employee of the dossier department' USING ERRCODE = 'HS001'; END IF;
  UPDATE hoso.dossier_assignments SET ended_at = now() WHERE dossier_id = p_dossier AND assignment_role = 'lead' AND ended_at IS NULL;
  INSERT INTO hoso.dossier_assignments(dossier_id, user_id, assignment_role, due_on, assigned_by, note)
  VALUES (p_dossier, p_user, 'lead', p_due, p_by, coalesce(p_note, ''));
  UPDATE hoso.dossiers SET assignee_id = p_user, internal_due_on = coalesce(p_due, internal_due_on), updated_at = now() WHERE id = p_dossier;
  INSERT INTO hoso.outbox_messages(type, payload)
  VALUES ('dossier.assigned', jsonb_build_object('dossierId', p_dossier, 'userId', p_user, 'assignedBy', p_by));
  PERFORM pg_notify('dossier_changed', json_build_object('dossierId', p_dossier, 'status', d.status)::text);
END $$;

-- Việc cần làm theo phân công đang dùng (màn "Việc của tôi").
CREATE FUNCTION my_queue(p_user uuid, p_role text)
RETURNS TABLE(dossier_id uuid, queue_kind text, status text, due_on date, updated_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT q.id, q.kind, q.status, q.internal_due_on, q.updated_at FROM (
    SELECT d.id, d.status, d.internal_due_on, d.updated_at,
      CASE
        WHEN d.status IN ('draft','returned') AND p_role IN ('employee','clerk') THEN 'assigned'
        WHEN d.status = 'department_review' AND p_role = 'manager' THEN 'to_review'
        WHEN d.status = 'leadership_review' AND p_role IN ('chair','council') THEN 'to_decide'
        WHEN d.status = 'ready_archive' AND p_role = 'clerk' THEN 'to_archive'
      END AS kind
    FROM hoso.dossiers d
    WHERE hoso.scope_matches(p_user, d.id, p_role)
  ) q
  WHERE q.kind IS NOT NULL
  ORDER BY q.internal_due_on NULLS LAST, q.updated_at DESC
$$;
