-- 008 · Tiện ích và quy ước chung (docs/03-thiet-ke-csdl.md mục 15).
SET search_path = hoso, public, pg_catalog;

CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA public;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA public;

-- unaccent không phải IMMUTABLE nên không dùng được trong chỉ mục hay cột sinh sẵn; bọc lại.
-- Tìm kiếm tiếng Việt không dấu: "đường" khớp "duong".
CREATE FUNCTION f_unaccent(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$;

CREATE FUNCTION f_fold(text) RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT
AS $$ SELECT lower(hoso.f_unaccent($1)) $$;

-- Mã lỗi nghiệp vụ do hàm SQL ném ra (SQLSTATE riêng, lớp 'HS'); API ánh xạ theo mã, không so chuỗi.
COMMENT ON SCHEMA hoso IS
'HS001 ngoài phạm vi · HS002 bước không cho phép · HS003 thiếu ghi chú · HS004 hồ sơ chưa đủ/chưa đối chiếu · HS005 xung đột phiên bản · HS006 không tìm thấy';

ALTER TABLE files DROP CONSTRAINT files_file_role_check;
ALTER TABLE files ADD CONSTRAINT files_file_role_check
  CHECK (file_role IN ('published_pdf','published_attachment','scan','derivative','ocr_pdf','signed'));

ALTER TABLE ocr_jobs DROP CONSTRAINT ocr_jobs_status_check;
ALTER TABLE ocr_jobs ADD CONSTRAINT ocr_jobs_status_check
  CHECK (status IN ('queued','running','completed','failed','cancelled'));
