-- 009 · Danh mục mở rộng: tên cơ quan theo thời kỳ, ngừng dùng thay cho xóa, thành phần bắt buộc, thời hạn bảo quản có căn cứ.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE organizations ADD COLUMN valid_from date, ADD COLUMN valid_until date,
  ADD CONSTRAINT organizations_valid_check CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from);

-- Giấy tờ giữ tên cơ quan tại thời điểm lập; tra cứu theo tên cũ vẫn ra (trước/sau sắp xếp đơn vị hành chính 2025).
CREATE TABLE organization_names (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  organization_code text NOT NULL REFERENCES organizations(code),
  name text NOT NULL CHECK (length(btrim(name)) > 0),
  valid_from date,
  valid_until date,
  basis text NOT NULL DEFAULT '',
  CHECK (valid_until IS NULL OR valid_from IS NULL OR valid_until >= valid_from)
);
INSERT INTO organization_names(organization_code, name, basis) SELECT code, name, 'Tên hiện tại trong danh mục' FROM organizations;

-- Danh mục chỉ ngừng dùng, không xóa khi đã có giấy tờ tham chiếu (BE-32).
ALTER TABLE work_groups ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE document_types
  ADD COLUMN document_form text,
  ADD COLUMN required_in_dossier boolean NOT NULL DEFAULT false,
  ADD COLUMN min_count smallint NOT NULL DEFAULT 1 CHECK (min_count >= 0),
  ADD COLUMN active boolean NOT NULL DEFAULT true;
ALTER TABLE field_definitions
  ADD COLUMN field_group text,
  ADD COLUMN is_key_field boolean NOT NULL DEFAULT false,
  ADD COLUMN validation_pattern text;

-- Hình thức văn bản suy từ tên loại giấy tờ ("Quyết định ...", "Biên bản ...") để đối chiếu với kết quả AI đọc.
UPDATE document_types SET document_form = (regexp_match(name,
  '^(Quyết định|Nghị quyết|Công văn|Báo cáo|Thông báo|Tờ trình|Kế hoạch|Biên bản|Giấy mời|Công điện|Nghị định|Hợp đồng|Phụ lục|Chương trình|Đề án|Đơn|Giấy|Bản|Văn bản|Phiếu|Danh sách|Hồ sơ)'))[1];
-- Trường quan trọng: bắt buộc người kiểm tra xác nhận từng trường (người, định danh, số tiền, số thửa, số/ký hiệu).
UPDATE field_definitions SET is_key_field = true
WHERE label ~* '(họ và tên|họ, tên|họ tên|người ký|số/ký hiệu|số, ký hiệu|số định danh|căn cước|cccd|số tiền|số thửa|ngày ban hành|ngày lập)';

CREATE TABLE retention_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  work_group_code text NOT NULL REFERENCES work_groups(code),
  document_type_code text,
  retention_label text NOT NULL CHECK (length(btrim(retention_label)) > 0),
  retention_years smallint CHECK (retention_years >= 0),
  legal_reference text,
  status text NOT NULL DEFAULT 'proposed' CHECK (status IN ('proposed','confirmed')),
  proposed_by uuid REFERENCES users(id),
  confirmed_by uuid REFERENCES users(id),
  confirmed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY (document_type_code, work_group_code) REFERENCES document_types(code, work_group_code),
  -- Hệ thống không tự đặt thời hạn bảo quản: xác nhận cần người xác nhận và căn cứ pháp lý.
  CHECK (status = 'proposed' OR (confirmed_by IS NOT NULL AND confirmed_at IS NOT NULL AND length(btrim(coalesce(legal_reference, ''))) >= 5))
);
CREATE INDEX retention_rules_group_idx ON retention_rules(work_group_code, document_type_code);
ALTER TABLE dossiers ADD COLUMN retention_rule_id uuid REFERENCES retention_rules(id);

CREATE TRIGGER work_groups_audit AFTER INSERT OR UPDATE OR DELETE ON work_groups FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER document_types_audit AFTER INSERT OR UPDATE OR DELETE ON document_types FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER field_definitions_audit AFTER INSERT OR UPDATE OR DELETE ON field_definitions FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER retention_rules_audit AFTER INSERT OR UPDATE OR DELETE ON retention_rules FOR EACH ROW EXECUTE FUNCTION audit_change();
