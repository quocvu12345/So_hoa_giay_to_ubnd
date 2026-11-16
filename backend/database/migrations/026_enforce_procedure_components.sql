-- 026 · Khóa cứng thành phần bắt buộc của thủ tục (BE-64), do cơ quan bật bằng cài đặt.
-- Mặc định TẮT: danh mục thủ tục lấy từ bản công bố và có mục "bắt buộc" thực ra chỉ là điều kiện hay hướng dẫn. Quản trị bật
-- `dossier.enforce_procedure_components` (PATCH /api/v1/admin/settings) sau khi rà danh mục; từ lúc đó các bước cần "giấy tờ đã đối chiếu"
-- (gửi, tiếp nhận, nộp lưu...) bị chặn (HS004) khi hồ sơ theo một thủ tục mà còn thành phần bắt buộc chưa có giấy tờ hoặc chưa đối chiếu xong.
-- Hồ sơ không gắn thủ tục không bị ảnh hưởng. Hàm giữ nguyên chữ ký và mọi kiểm tra của bản ở 019.
SET search_path = hoso, public, pg_catalog;

INSERT INTO system_settings(key, value) VALUES ('dossier.enforce_procedure_components', 'false'::jsonb)
ON CONFLICT (key) DO NOTHING;

CREATE OR REPLACE FUNCTION transition_dossier(p_dossier uuid, p_actor uuid, p_role text, p_action text,
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

  -- Thành phần bắt buộc của thủ tục (chỉ khi cơ quan bật cài đặt). Một thành phần đạt khi có giấy tờ được gán và tất cả đã đối chiếu xong.
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
