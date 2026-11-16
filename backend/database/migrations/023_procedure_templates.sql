-- 023 · Tệp gắn với cả thủ tục (PDF hướng dẫn 774 tệp, cấu hình biểu mẫu điện tử JSON 28 tệp), khác với mẫu gắn từng thành phần (011).
SET search_path = hoso, public, pg_catalog;

CREATE TABLE procedure_templates (
  procedure_id text NOT NULL REFERENCES procedures(id) ON DELETE CASCADE,
  template_id uuid NOT NULL REFERENCES form_templates(id) ON DELETE CASCADE,
  PRIMARY KEY (procedure_id, template_id)
);
CREATE INDEX procedure_templates_template_idx ON procedure_templates(template_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON procedure_templates TO hoso_api;
GRANT SELECT ON procedure_templates TO hoso_readonly;
