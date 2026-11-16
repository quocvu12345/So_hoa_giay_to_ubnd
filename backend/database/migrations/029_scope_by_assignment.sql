-- 029 · Phạm vi theo ĐÚNG phân công đang chọn (BE-90, rà soát bảo mật 16/11/2026).
-- Trước đây scope_matches(user, dossier, vai_trò) lấy hợp của mọi phân công và ủy quyền cùng vai trò, nên: (a) quyền đầy đủ của phân công riêng áp được lên hồ sơ mà
-- người đó chỉ có một ủy quyền XEM; (b) người kiêm nhiệm cùng vai trò ở hai đơn vị đang chọn đơn vị A vẫn thấy hồ sơ đơn vị B.
-- Từ nay phạm vi chỉ lấy từ MỘT phân công: mã dạng "<user_roles.id>" (phân công riêng) hoặc "d:<delegations.id>" (ủy quyền), cùng dạng với claim
-- hoso_assignment của API. Vai trò suy ra từ chính phân công đó, không nhận từ bên ngoài. Mã sai dạng, không phải của người dùng, hết hạn hoặc bị thu hồi
-- thì KHÔNG khớp (an toàn khi lỗi). Hàm cũ nhận vai trò bị xóa hẳn: lời gọi cũ truyền "manager" sẽ không khớp gì thay vì khớp nhầm.
SET search_path = hoso, public, pg_catalog;

-- Phạm vi của một phân công: đúng một dòng (vai trò, cơ quan, đơn vị) nếu còn hiệu lực và thuộc về p_user; không thì không dòng nào.
CREATE FUNCTION assignment_scope(p_user uuid, p_assignment text)
RETURNS TABLE(role_code text, organization_code text, department_code text)
LANGUAGE sql STABLE AS $$
  WITH k AS (
    SELECT CASE WHEN p_assignment ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN p_assignment::uuid END AS own_id,
           CASE WHEN p_assignment ~* '^d:[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' THEN substr(p_assignment, 3)::uuid END AS delegation_id
  )
  SELECT ur.role_code, ur.organization_code, ur.department_code
  FROM k
  JOIN hoso.user_roles ur ON ur.id = k.own_id
  JOIN hoso.users u ON u.id = ur.user_id AND u.active
  WHERE ur.user_id = p_user
    AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
  UNION ALL
  SELECT ur.role_code, ur.organization_code, ur.department_code
  FROM k
  JOIN hoso.delegations dg ON dg.id = k.delegation_id
  JOIN hoso.user_roles ur ON ur.id = dg.from_user_role_id
  JOIN hoso.users grantor ON grantor.id = ur.user_id AND grantor.active
  JOIN hoso.users grantee ON grantee.id = dg.to_user_id AND grantee.active
  WHERE dg.to_user_id = p_user AND dg.revoked_at IS NULL
    AND dg.valid_from <= now() AND dg.valid_until > now()
    AND ur.valid_from <= now() AND (ur.valid_until IS NULL OR ur.valid_until > now())
$$;
COMMENT ON FUNCTION assignment_scope(uuid, text) IS 'Phạm vi của đúng một phân công (riêng hoặc ủy quyền "d:<id>") còn hiệu lực của người dùng; không khớp thì không dòng nào.';

-- Bỏ các hàm cũ theo vai trò. Hàm phụ thuộc được tạo lại ngay dưới đây.
DROP FUNCTION my_queue(uuid, text);
DROP FUNCTION assign_dossier(uuid, uuid, uuid, date, text);
DROP FUNCTION transition_dossier(uuid, uuid, text, text, text, bigint);
DROP FUNCTION scope_matches(uuid, uuid, text);

-- Quy tắc phạm vi MỘT NƠI DUY NHẤT (docs/03 mục 4). API gọi hàm này, không tự viết lại điều kiện.
--   1. Phạm vi lấy từ đúng phân công p_assignment (xem assignment_scope).
--   2. Chuyên viên chỉ thấy hồ sơ mình chủ trì hoặc được phối hợp.
--   3. Chủ tịch chỉ khối tl-ubnd, lãnh đạo HĐND chỉ khối tl-hdnd; quản trị kỹ thuật không đọc nội dung.
--   4. Hồ sơ 'restricted' cần thêm quyền cấp riêng còn hiệu lực.
CREATE FUNCTION scope_matches(p_user uuid, p_dossier uuid, p_assignment text) RETURNS boolean
LANGUAGE sql STABLE AS $$
  SELECT EXISTS (
    SELECT 1
    FROM hoso.dossiers d
    JOIN hoso.assignment_scope(p_user, p_assignment) a
      ON a.organization_code = d.organization_code AND (a.department_code IS NULL OR a.department_code = d.department_code)
    WHERE d.id = p_dossier
      AND a.role_code <> 'technical_admin'
      AND (a.role_code <> 'employee' OR d.assignee_id = p_user OR EXISTS (
            SELECT 1 FROM hoso.dossier_assignments da WHERE da.dossier_id = d.id AND da.user_id = p_user AND da.ended_at IS NULL))
      AND (a.role_code <> 'chair' OR d.organization_code = 'tl-ubnd')
      AND (a.role_code <> 'council' OR d.organization_code = 'tl-hdnd')
      AND (d.access_level <> 'restricted' OR EXISTS (
            SELECT 1 FROM hoso.document_access_grants g
            WHERE g.dossier_id = d.id AND g.grantee_user_id = p_user AND g.revoked_at IS NULL AND g.valid_until > now()))
  );
$$;
COMMENT ON FUNCTION scope_matches(uuid, uuid, text) IS 'Người dùng p_user, đang dùng phân công p_assignment, có thấy hồ sơ p_dossier không. Không nhận vai trò từ ngoài.';

-- Chuyển bước. Vai trò lấy từ phân công; ngoài phạm vi (kể cả mã phân công sai) là HS001. Giữ nguyên mọi kiểm tra khác của bản ở 026.
CREATE FUNCTION transition_dossier(p_dossier uuid, p_actor uuid, p_assignment text, p_action text,
                                   p_note text DEFAULT '', p_expected_version bigint DEFAULT NULL)
RETURNS text LANGUAGE plpgsql AS $$
DECLARE d hoso.dossiers%ROWTYPE; t hoso.workflow_transitions%ROWTYPE; target text; version bigint; v_role text;
BEGIN
  SELECT * INTO d FROM hoso.dossiers WHERE id = p_dossier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier not found' USING ERRCODE = 'HS006'; END IF;
  -- xmin là cột hệ thống nên không có trong biến dòng d (SELECT *): đọc riêng từ bảng sau khi đã khóa dòng.
  SELECT xmin::text::bigint INTO version FROM hoso.dossiers WHERE id = p_dossier;
  SELECT a.role_code INTO v_role FROM hoso.assignment_scope(p_actor, p_assignment) a;
  IF v_role IS NULL OR NOT hoso.scope_matches(p_actor, p_dossier, p_assignment) THEN
    RAISE EXCEPTION 'Actor outside dossier scope' USING ERRCODE = 'HS001';
  END IF;
  IF p_expected_version IS NOT NULL AND p_expected_version <> version THEN
    RAISE EXCEPTION 'Dossier was changed by someone else' USING ERRCODE = 'HS005';
  END IF;
  SELECT * INTO t FROM hoso.workflow_transitions
  WHERE workflow_code = d.workflow_code AND from_state = d.status AND action = p_action AND actor_role = v_role;
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

  -- Thành phần bắt buộc của thủ tục (chỉ khi cơ quan bật cài đặt, migration 026).
  IF t.requires_verified_documents AND d.procedure_id IS NOT NULL
     AND coalesce((SELECT value = 'true'::jsonb FROM hoso.system_settings WHERE key = 'dossier.enforce_procedure_components'), false)
     AND EXISTS (
       SELECT 1 FROM hoso.procedure_components pc
       WHERE pc.procedure_id = d.procedure_id AND pc.required_as_published
         AND (
           NOT EXISTS (SELECT 1 FROM hoso.dossier_documents dd
                       WHERE dd.dossier_id = p_dossier AND dd.relation_kind = 'component' AND dd.procedure_component_id = pc.id)
           OR EXISTS (SELECT 1 FROM hoso.dossier_documents dd JOIN hoso.documents doc ON doc.id = dd.document_id
                      WHERE dd.dossier_id = p_dossier AND dd.relation_kind = 'component' AND dd.procedure_component_id = pc.id
                        AND (doc.data_review_status <> 'verified'
                             OR EXISTS (SELECT 1 FROM hoso.document_field_values fv WHERE fv.document_id = doc.id AND fv.needs_review)))
         )
     )
  THEN RAISE EXCEPTION 'Dossier is missing required procedure components' USING ERRCODE = 'HS004'; END IF;

  target := t.to_state;
  IF d.workflow_code <> 'digitize_closed' THEN
    IF p_action = 'submit' AND d.department_code IN ('tt','db') THEN target := 'leadership_review'; END IF;
    IF p_action = 'return' AND v_role IN ('chair','council') AND d.department_code IN ('tt','db') THEN target := 'returned'; END IF;
  END IF;

  UPDATE hoso.dossiers SET status = target, updated_at = now(),
         archived_at = CASE WHEN target = 'archived' THEN now() END,
         closed_on = CASE WHEN target = 'archived' THEN current_date ELSE closed_on END
  WHERE id = p_dossier;
  INSERT INTO hoso.workflow_events(dossier_id, actor_id, actor_role, action, from_state, to_state, note)
  VALUES (p_dossier, p_actor, v_role, p_action, d.status, target, coalesce(p_note, ''));
  INSERT INTO hoso.outbox_messages(type, payload) VALUES ('dossier.transitioned', jsonb_build_object(
    'dossierId', p_dossier, 'action', p_action, 'from', d.status, 'to', target, 'actorId', p_actor, 'actorRole', v_role));
  PERFORM pg_notify('dossier_changed', json_build_object('dossierId', p_dossier, 'status', target)::text);
  RETURN target;
END $$;
COMMENT ON FUNCTION transition_dossier(uuid, uuid, text, text, text, bigint) IS
'Luồng hoàn thiện gói số hóa đề xuất; không thay ký số, phê duyệt chuyên môn hoặc biểu quyết. p_assignment là phân công đang dùng (vai trò suy ra từ đó). Lỗi: HS001 ngoài phạm vi, HS002 bước không cho phép, HS003 thiếu ghi chú, HS004 chưa đủ/đối chiếu, HS005 xung đột phiên bản, HS006 không thấy hồ sơ.';

-- Giao người chủ trì: người giao phải thấy hồ sơ theo đúng phân công đang dùng (trước đây hàm này tin hoàn toàn vào API).
CREATE FUNCTION assign_dossier(p_dossier uuid, p_by uuid, p_assignment text, p_user uuid, p_due date DEFAULT NULL, p_note text DEFAULT '')
RETURNS void LANGUAGE plpgsql AS $$
DECLARE d hoso.dossiers%ROWTYPE;
BEGIN
  SELECT * INTO d FROM hoso.dossiers WHERE id = p_dossier FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Dossier not found' USING ERRCODE = 'HS006'; END IF;
  IF NOT hoso.scope_matches(p_by, p_dossier, p_assignment) THEN
    RAISE EXCEPTION 'Actor outside dossier scope' USING ERRCODE = 'HS001';
  END IF;
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
CREATE FUNCTION my_queue(p_user uuid, p_assignment text)
RETURNS TABLE(dossier_id uuid, queue_kind text, status text, due_on date, updated_at timestamptz)
LANGUAGE sql STABLE AS $$
  SELECT q.id, q.kind, q.status, q.internal_due_on, q.updated_at FROM (
    SELECT d.id, d.status, d.internal_due_on, d.updated_at,
      CASE
        WHEN d.status IN ('draft','returned') AND a.role_code IN ('employee','clerk') THEN 'assigned'
        WHEN d.status = 'department_review' AND a.role_code = 'manager' THEN 'to_review'
        WHEN d.status = 'leadership_review' AND a.role_code IN ('chair','council') THEN 'to_decide'
        WHEN d.status = 'ready_archive' AND a.role_code = 'clerk' THEN 'to_archive'
      END AS kind
    FROM hoso.assignment_scope(p_user, p_assignment) a
    JOIN hoso.dossiers d ON hoso.scope_matches(p_user, d.id, p_assignment)
  ) q
  WHERE q.kind IS NOT NULL
  ORDER BY q.internal_due_on NULLS LAST, q.updated_at DESC
$$;
