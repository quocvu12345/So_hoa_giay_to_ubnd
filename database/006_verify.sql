\set ON_ERROR_STOP on
BEGIN;
SET search_path = hoso, pg_catalog;
CREATE FUNCTION pg_temp.assert_true(ok boolean,message text) RETURNS void LANGUAGE plpgsql AS $$
BEGIN IF ok IS DISTINCT FROM TRUE THEN RAISE EXCEPTION 'ASSERT FAILED: %',message; END IF; END $$;

SELECT pg_temp.assert_true((SELECT count(*)=19 FROM documents WHERE origin='public_source'),'19 public documents');
SELECT pg_temp.assert_true((SELECT count(*)=19 FROM sources),'19 source pages');
SELECT pg_temp.assert_true((SELECT count(*)=19 FROM v_public_documents),'one public row per document, attachment not duplicated');
SELECT pg_temp.assert_true((SELECT count(*)=20 FROM files),'20 public source files');
SELECT pg_temp.assert_true((SELECT count(*)=11 FROM departments),'11 proposed departments / units');
SELECT pg_temp.assert_true((SELECT count(*)=38 FROM work_groups),'38 work groups');
SELECT pg_temp.assert_true((SELECT count(*)=427 FROM document_types),'427 contextual paper types');
SELECT pg_temp.assert_true((SELECT count(*)=2624 FROM field_definitions),'2624 field definitions');
SELECT pg_temp.assert_true((SELECT count(*)=8 FROM dossiers WHERE origin='demo'),'8 optional demo dossiers');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM dossiers WHERE origin='internal'),'no invented real internal cases');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM ocr_jobs),'no fabricated OCR jobs');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM documents WHERE origin='public_source' AND data_review_status='verified'),'public metadata is not a simulated human acceptance');
SELECT pg_temp.assert_true((SELECT count(*)=0 FROM document_classifications c JOIN documents d ON d.id=c.document_id WHERE d.origin='public_source' AND c.classification_status<>'proposed'),'public classifications explicitly proposed');
SELECT pg_temp.assert_true((SELECT issued_on IS NULL AND metadata_status='needs_review' AND source_observations->>'registry_issued_on'='2026-01-26' AND source_observations->>'pdf_header_issued_on'='2026-01-20' FROM documents WHERE external_key='public-019'),'date conflict preserved');
SELECT pg_temp.assert_true((SELECT count(*)=2 FROM documents WHERE origin='public_source' AND document_number='17/NQ-HĐND'),'same number across different years retained');

DO $$
DECLARE d uuid; actor uuid; head uuid; clerk uuid; hcase uuid; initial_events bigint; result text; rejected boolean;
BEGIN
  SELECT id INTO d FROM dossiers WHERE code='DEMO-2026-0002';
  SELECT id INTO head FROM users WHERE username='demo_head_kt';
  SELECT id INTO clerk FROM users WHERE username='demo_clerk_ubnd';
  SELECT id INTO actor FROM users WHERE username='demo_chair';
  SELECT id INTO hcase FROM dossiers WHERE code='DEMO-2026-0006';
  PERFORM pg_temp.assert_true(NOT scope_matches(actor,hcase,'chair'),'UBND chair cannot enter HĐND scope');
  PERFORM pg_temp.assert_true(NOT scope_matches((SELECT id FROM users WHERE username='demo_head_ht'),d,'manager'),'head limited to own department');
  PERFORM pg_temp.assert_true(NOT scope_matches((SELECT id FROM users WHERE username='demo_cv_ht_02'),(SELECT id FROM dossiers WHERE code='DEMO-2026-0001'),'employee'),'employee limited to assignments');
  PERFORM pg_temp.assert_true(NOT scope_matches((SELECT id FROM users WHERE username='demo_admin'),d,'technical_admin'),'technical admin has no implicit business authority');
  SELECT count(*) INTO initial_events FROM workflow_events;
  rejected:=false;
  BEGIN PERFORM transition_dossier(d,actor,'chair','accept','Ý kiến thử nghiệm không đúng vai trò.');
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'reject wrong role/action');
  PERFORM pg_temp.assert_true((SELECT count(*)=initial_events FROM workflow_events),'failed action leaves no workflow event');
  PERFORM pg_temp.assert_true(transition_dossier(d,head,'manager','accept','Đã kiểm tra hồ sơ giả lập.')='ready_archive','head completes quality check');
  PERFORM pg_temp.assert_true(transition_dossier(d,clerk,'clerk','archive','Đã kiểm tra bàn giao giả lập.')='archived','clerk archives checked package');
  PERFORM pg_temp.assert_true((SELECT archived_at IS NOT NULL FROM dossiers WHERE id=d),'archive timestamp required');
  PERFORM pg_temp.assert_true((SELECT count(*)=initial_events+2 FROM workflow_events),'two transitions recorded');
  rejected:=false;
  BEGIN PERFORM transition_dossier(d,clerk,'clerk','archive','Lặp thao tác.');
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'cannot repeat archive transition');

  SELECT id INTO d FROM dossiers WHERE code='DEMO-2026-0005';
  SELECT id INTO head FROM users WHERE username='demo_head_bkt';
  rejected:=false;
  BEGIN PERFORM transition_dossier(d,head,'manager','escalate','');
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'escalation requires a meaningful note');
  PERFORM transition_dossier(d,head,'manager','escalate','Trình Thường trực xem bộ hồ sơ giả lập.');
  PERFORM pg_temp.assert_true(transition_dossier(d,(SELECT id FROM users WHERE username='demo_council'),'council','decide','Đã xem đủ tài liệu minh họa.')='ready_archive','HĐND queue handled by council');
  PERFORM transition_dossier(d,(SELECT id FROM users WHERE username='demo_clerk_hdnd'),'clerk','archive','Đã kiểm tra bàn giao gói giả lập.');

  SELECT id INTO d FROM dossiers WHERE code='DEMO-2026-0001';
  rejected:=false;
  BEGIN PERFORM transition_dossier(d,(SELECT id FROM users WHERE username='demo_cv_ht'),'employee','submit','Trình thử.');
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'pending papers cannot be submitted');

  rejected:=false;
  BEGIN UPDATE dossiers SET department_code='kt' WHERE id=d;
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'work group must belong to selected department and organization');
  rejected:=false;
  BEGIN INSERT INTO dossier_documents(dossier_id,document_id,position) VALUES(d,gen_random_uuid(),99);
  EXCEPTION WHEN foreign_key_violation THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'no orphan document links');
  rejected:=false;
  BEGIN UPDATE workflow_events SET note='Ghi đè lịch sử';
  EXCEPTION WHEN raise_exception THEN rejected:=true; END;
  PERFORM pg_temp.assert_true(rejected,'workflow history append-only');

  UPDATE user_roles SET valid_until='2026-01-01' WHERE user_id=head;
  PERFORM pg_temp.assert_true(NOT scope_matches(head,(SELECT id FROM dossiers WHERE code='DEMO-2026-0005'),'manager'),'expired role assignment rejected');
END $$;

-- A document carrying a conflict cannot be accepted even if somebody sets review stamps.
DO $$
DECLARE d uuid; doc uuid; actor uuid; rejected boolean:=false;
BEGIN
 SELECT id INTO d FROM dossiers WHERE code='DEMO-2026-0008';
 SELECT id INTO actor FROM users WHERE username='demo_cv_ht';
 UPDATE documents SET data_review_status='verified',reviewed_by=actor,reviewed_at=now()
 WHERE id IN (SELECT document_id FROM dossier_documents WHERE dossier_id=d);
 UPDATE document_field_values SET needs_review=false,verified_by=actor,verified_at=now()
 WHERE document_id IN (SELECT document_id FROM dossier_documents WHERE dossier_id=d);
 SELECT id INTO doc FROM documents WHERE external_key='public-019';
 UPDATE documents SET data_review_status='verified',reviewed_by=actor,reviewed_at=now() WHERE id=doc;
 INSERT INTO dossier_documents(dossier_id,document_id,position) VALUES(d,doc,4);
 BEGIN PERFORM transition_dossier(d,actor,'employee','submit','Trình thử tình huống sai khác ngày.');
 EXCEPTION WHEN raise_exception THEN rejected:=true; END;
 PERFORM pg_temp.assert_true(rejected,'source metadata conflict blocks submission');
END $$;

ROLLBACK;
\echo 'PASS: counts, provenance, conflict handling, referential integrity, scope, role expiry, workflow, audit and rollback.'
