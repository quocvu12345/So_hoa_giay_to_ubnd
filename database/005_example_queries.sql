-- Read-only examples; psql -d hoso_dev -f database/005_example_queries.sql
SET search_path = hoso, pg_catalog;

-- 1. Real public documents, source provenance and attached file links.
SELECT external_key,document_number,issued_on,title,metadata_status,source_url,file_url
FROM v_public_documents ORDER BY issuer_name,issued_on NULLS LAST,document_number;

-- 2. Unresolved metadata discrepancies, preserved as observed.
SELECT document_number,source_observations,verification_note
FROM documents WHERE origin='public_source' AND metadata_status='needs_review';

-- 3. Dependent select boxes: department -> work group -> concrete paper types.
SELECT d.code,d.name FROM departments d ORDER BY d.code;
SELECT code,title FROM work_groups WHERE department_code='kt' AND organization_code='tl-ubnd' ORDER BY code;
SELECT document_type_code,document_type_name,fields FROM v_catalog_composition WHERE work_group_code='U11';

-- 4. Find the current owner's employee dossiers; no application authentication implied.
SELECT d.code,d.title,d.status_label,d.document_count,d.internal_due_on
FROM v_dossier_summary d
WHERE scope_matches((SELECT id FROM users WHERE username='demo_cv_ht'),d.id,'employee');

-- 5. Department head queue, in that head's unit only.
SELECT d.code,d.title,d.department_name,d.internal_due_on
FROM v_dossier_summary d
WHERE d.status='department_review'
AND scope_matches((SELECT id FROM users WHERE username='demo_head_kt'),d.id,'manager');

-- 6. UBND chair queue. HĐND is queried separately with the council role.
SELECT d.code,d.title,d.department_name FROM v_dossier_summary d
WHERE d.status='leadership_review'
AND scope_matches((SELECT id FROM users WHERE username='demo_chair'),d.id,'chair');

-- 7. Internal deadlines only; these are not statutory administrative-procedure deadlines.
SELECT code,title,internal_due_on,status_label FROM v_dossier_summary
WHERE internal_due_on < CURRENT_DATE AND status <> 'archived';

-- 8. OCR fields still needing human review. Real public seed contains NO fabricated OCR output.
SELECT doc.title,f.label,v.value_text,v.confidence,v.source_page,v.source_region
FROM document_field_values v JOIN documents doc ON doc.id=v.document_id
JOIN field_definitions f ON f.code=v.field_definition_code WHERE v.needs_review;

-- 9. Metadata search (accent-sensitive PostgreSQL simple dictionary).
SELECT document_number,title FROM documents
WHERE to_tsvector('simple',coalesce(document_number,'') || ' ' || title)
@@ plainto_tsquery('simple','ngân sách');

-- 10. History of a dossier, after invoking transition_dossier through a trusted backend.
SELECT e.happened_at,u.display_name,e.actor_role,e.action,e.from_state,e.to_state,e.note
FROM workflow_events e JOIN users u ON u.id=e.actor_id
JOIN dossiers d ON d.id=e.dossier_id WHERE d.code='DEMO-2026-0002' ORDER BY e.id;
