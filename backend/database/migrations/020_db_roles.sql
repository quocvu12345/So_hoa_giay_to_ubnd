-- 020 · Role CSDL tối thiểu quyền (docs/05-bao-mat.md, SEC-04).
-- Role được tạo NOLOGIN; quản trị đặt mật khẩu/LOGIN ngoài migration (ALTER ROLE ... LOGIN PASSWORD ...), bí mật không nằm trong repo.
SET search_path = hoso, public, pg_catalog;

DO $$
DECLARE r text;
BEGIN
  FOREACH r IN ARRAY ARRAY['hoso_migrator','hoso_api','hoso_ai_worker','hoso_readonly'] LOOP
    IF NOT EXISTS (SELECT 1 FROM pg_roles WHERE rolname = r) THEN EXECUTE format('CREATE ROLE %I NOLOGIN', r); END IF;
  END LOOP;
END $$;

GRANT USAGE ON SCHEMA hoso TO hoso_api, hoso_ai_worker, hoso_readonly;
GRANT USAGE ON SCHEMA public TO hoso_api, hoso_ai_worker, hoso_readonly;

-- API: đọc/ghi dữ liệu nghiệp vụ; nhật ký chỉ được thêm.
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA hoso TO hoso_api;
REVOKE UPDATE, DELETE ON audit_events, workflow_events, access_events FROM hoso_api;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hoso TO hoso_api;
GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA hoso TO hoso_api;

-- Worker AI: không đọc người dùng, hồ sơ, phân quyền. Chỉ đọc tệp cần xử lý và ghi kết quả nhóm F.
GRANT SELECT ON files, documents, work_groups, document_types, field_definitions, ai_models TO hoso_ai_worker;
GRANT SELECT, UPDATE ON ocr_jobs TO hoso_ai_worker;
GRANT SELECT, INSERT, UPDATE ON ocr_pages, page_images TO hoso_ai_worker;
GRANT SELECT, INSERT ON ai_suggestions, ai_field_suggestions TO hoso_ai_worker;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA hoso TO hoso_ai_worker;
GRANT EXECUTE ON FUNCTION hoso.f_unaccent(text) TO hoso_ai_worker;

-- Báo cáo: chỉ đọc, không có audit_events/access_events (dữ liệu nhạy cảm về người dùng).
GRANT SELECT ON ALL TABLES IN SCHEMA hoso TO hoso_readonly;
REVOKE SELECT ON audit_events, access_events, users, user_roles, delegations, document_access_grants FROM hoso_readonly;

ALTER DEFAULT PRIVILEGES IN SCHEMA hoso GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO hoso_api;
ALTER DEFAULT PRIVILEGES IN SCHEMA hoso GRANT USAGE, SELECT ON SEQUENCES TO hoso_api;
