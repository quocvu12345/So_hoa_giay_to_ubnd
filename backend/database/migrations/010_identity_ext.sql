-- 010 · Định danh và phân quyền mở rộng: ủy quyền, cấp quyền xem hồ sơ hạn chế, nhật ký truy cập.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE users
  ADD COLUMN email text CHECK (email IS NULL OR email ~ '^[^@\s]+@[^@\s]+$'),
  ADD COLUMN last_login_at timestamptz;
-- Cấp phó: được thay trưởng phòng khi có phân công, nhưng đánh dấu để truy vết.
ALTER TABLE user_roles ADD COLUMN is_deputy boolean NOT NULL DEFAULT false;

INSERT INTO permissions(code, description) VALUES
  ('document.view','Xem giấy tờ trong phạm vi'),
  ('document.download','Tải bản số của giấy tờ'),
  ('document.print','In giấy tờ'),
  ('document.edit','Sửa thông tin và đối chiếu trường của giấy tờ'),
  ('intake.upload','Tải PDF lên hộp tiếp nhận'),
  ('intake.manage','Tạo, đóng lô quét; xử lý tiếp nhận hàng loạt'),
  ('intake.qc','Kiểm tra chất lượng ảnh quét'),
  ('processing.manage','Xem và điều khiển hàng đợi AI'),
  ('catalog.manage','Sửa danh mục nhóm công việc, loại giấy tờ, trường'),
  ('storage.manage','Quản lý kho, tủ, kệ, hộp và vị trí bản giấy'),
  ('loan.request','Đề nghị mượn bản giấy'),
  ('loan.approve','Duyệt cho mượn, ghi nhận trả'),
  ('export.create','Tạo gói xuất bàn giao'),
  ('disposal.request','Đề nghị hủy tài liệu hết hạn bảo quản'),
  ('disposal.approve','Phê duyệt hủy tài liệu'),
  ('admin.users','Quản lý người dùng và phân công'),
  ('admin.settings','Cấu hình hệ thống, xem nhật ký vận hành')
ON CONFLICT (code) DO NOTHING;

-- Quyền mặc định theo vai trò; phải khớp DefaultRolePermissions trong backend/src/HoSoSo.Domain (có test đối chiếu).
INSERT INTO role_permissions(role_code, permission_code) VALUES
  ('employee','document.view'),('employee','document.download'),('employee','document.edit'),('employee','intake.upload'),('employee','loan.request'),
  ('clerk','document.view'),('clerk','document.download'),('clerk','document.print'),('clerk','document.edit'),
  ('clerk','intake.upload'),('clerk','intake.manage'),('clerk','intake.qc'),('clerk','storage.manage'),
  ('clerk','loan.request'),('clerk','loan.approve'),('clerk','export.create'),('clerk','disposal.request'),
  ('manager','document.view'),('manager','document.download'),('manager','loan.request'),('manager','export.create'),
  ('chair','document.view'),('chair','document.download'),('chair','document.print'),('chair','export.create'),('chair','disposal.approve'),
  ('council','document.view'),('council','document.download'),('council','document.print'),('council','export.create'),('council','disposal.approve'),
  ('technical_admin','admin.users'),('technical_admin','admin.settings'),('technical_admin','catalog.manage'),('technical_admin','processing.manage')
ON CONFLICT DO NOTHING;

CREATE TABLE delegations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  from_user_role_id uuid NOT NULL REFERENCES user_roles(id),
  to_user_id uuid NOT NULL REFERENCES users(id),
  permission_codes text[] NOT NULL CHECK (cardinality(permission_codes) > 0),
  valid_from timestamptz NOT NULL DEFAULT now(),
  valid_until timestamptz NOT NULL,
  basis text NOT NULL CHECK (length(btrim(basis)) >= 10),
  created_by uuid NOT NULL REFERENCES users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (valid_until > valid_from)
);
CREATE INDEX delegations_to_user_idx ON delegations(to_user_id) WHERE revoked_at IS NULL;

CREATE FUNCTION check_delegation_permissions() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM unnest(NEW.permission_codes) c WHERE c NOT IN (SELECT code FROM hoso.permissions)) THEN
    RAISE EXCEPTION 'Delegation contains an unknown permission code';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER delegations_permission_check BEFORE INSERT OR UPDATE ON delegations
FOR EACH ROW EXECUTE FUNCTION check_delegation_permissions();

CREATE TABLE document_access_grants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  dossier_id uuid REFERENCES dossiers(id),
  document_id uuid REFERENCES documents(id),
  grantee_user_id uuid NOT NULL REFERENCES users(id),
  access text NOT NULL CHECK (access IN ('view','download','print')),
  valid_until timestamptz NOT NULL,
  reason text NOT NULL CHECK (length(btrim(reason)) >= 10),
  granted_by uuid NOT NULL REFERENCES users(id),
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  CHECK (dossier_id IS NOT NULL OR document_id IS NOT NULL)
);
CREATE INDEX document_access_grants_grantee_idx ON document_access_grants(grantee_user_id) WHERE revoked_at IS NULL;

-- Ai xem, tải, in, xuất, tìm gì. Chỉ thêm, không sửa; phân vùng theo tháng vì tăng nhanh.
CREATE TABLE access_events (
  id bigint GENERATED ALWAYS AS IDENTITY,
  user_id uuid REFERENCES users(id),
  user_role_id uuid REFERENCES user_roles(id),
  action text NOT NULL CHECK (action IN ('view','download','print','export','search','login','logout')),
  object_type text,
  object_id uuid,
  client_ip inet,
  correlation_id text,
  happened_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (id, happened_at)
) PARTITION BY RANGE (happened_at);
CREATE TABLE access_events_default PARTITION OF access_events DEFAULT;
CREATE INDEX access_events_user_idx ON access_events(user_id, happened_at DESC);
CREATE INDEX access_events_object_idx ON access_events(object_type, object_id, happened_at DESC);
CREATE TRIGGER access_events_immutable BEFORE UPDATE OR DELETE ON access_events
FOR EACH ROW EXECUTE FUNCTION reject_log_mutation();

-- Tạo phân vùng tháng (gọi từ việc định kỳ BE-88). Hàng đã nằm trong phân vùng mặc định thì báo lỗi rõ ràng.
CREATE FUNCTION ensure_access_events_partition(p_month date) RETURNS text LANGUAGE plpgsql AS $$
DECLARE first_day date := date_trunc('month', p_month)::date; part text := 'access_events_y' || to_char(p_month, 'YYYY"m"MM');
BEGIN
  IF to_regclass('hoso.' || part) IS NULL THEN
    EXECUTE format('CREATE TABLE hoso.%I PARTITION OF hoso.access_events FOR VALUES FROM (%L) TO (%L)',
                   part, first_day, (first_day + interval '1 month')::date);
  END IF;
  RETURN part;
END $$;
SELECT ensure_access_events_partition((current_date + (n || ' month')::interval)::date) FROM generate_series(0, 2) n;
