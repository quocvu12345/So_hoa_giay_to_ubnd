-- 018 · Hệ thống: thông báo, outbox, cấu hình, ghi nhận sao lưu, mở rộng trigger audit.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE notifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES users(id),
  kind text NOT NULL,
  title text NOT NULL,
  body text NOT NULL DEFAULT '',
  link text CHECK (link IS NULL OR link ~ '^/[^/]'),
  dossier_id uuid REFERENCES dossiers(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  read_at timestamptz
);
CREATE INDEX notifications_unread_idx ON notifications(user_id, created_at DESC) WHERE read_at IS NULL;
CREATE INDEX notifications_user_idx ON notifications(user_id, created_at DESC);

CREATE FUNCTION notify_notification_created() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('notification_created', json_build_object('id', NEW.id, 'userId', NEW.user_id, 'kind', NEW.kind)::text);
  RETURN NULL;
END $$;
CREATE TRIGGER notifications_notify AFTER INSERT ON notifications FOR EACH ROW EXECUTE FUNCTION notify_notification_created();

-- Việc cần làm sau khi giao dịch thành công (tạo thông báo, ...). Ghi cùng giao dịch với dữ liệu nghiệp vụ.
CREATE TABLE outbox_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  type text NOT NULL,
  payload jsonb NOT NULL DEFAULT '{}'::jsonb CHECK (jsonb_typeof(payload) = 'object'),
  created_at timestamptz NOT NULL DEFAULT now(),
  next_attempt_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  attempts smallint NOT NULL DEFAULT 0,
  last_error text
);
CREATE INDEX outbox_pending_idx ON outbox_messages(next_attempt_at, id) WHERE processed_at IS NULL;

CREATE TABLE system_settings (
  key text PRIMARY KEY,
  value jsonb NOT NULL,
  updated_by uuid REFERENCES users(id),
  updated_at timestamptz NOT NULL DEFAULT now()
);
-- Không lưu bí mật ở đây (mật khẩu, khóa API): bí mật nằm ở biến môi trường hoặc kho khóa.
COMMENT ON TABLE system_settings IS 'Cấu hình không nhạy cảm do quản trị đổi trên giao diện; bí mật nằm ngoài CSDL.';

CREATE TABLE backup_runs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  kind text NOT NULL CHECK (kind IN ('database','files','config')),
  status text NOT NULL DEFAULT 'running' CHECK (status IN ('running','succeeded','failed')),
  started_at timestamptz NOT NULL DEFAULT now(),
  finished_at timestamptz,
  byte_size bigint CHECK (byte_size >= 0),
  location text,
  restore_tested_at timestamptz,
  note text NOT NULL DEFAULT '',
  CHECK ((status = 'running') = (finished_at IS NULL))
);

CREATE TRIGGER dossier_documents_audit AFTER INSERT OR UPDATE OR DELETE ON dossier_documents FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER dossier_assignments_audit AFTER INSERT OR UPDATE OR DELETE ON dossier_assignments FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER document_classifications_audit AFTER INSERT OR UPDATE OR DELETE ON document_classifications FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER user_roles_audit AFTER INSERT OR UPDATE OR DELETE ON user_roles FOR EACH ROW EXECUTE FUNCTION audit_change();
CREATE TRIGGER delegations_audit AFTER INSERT OR UPDATE OR DELETE ON delegations FOR EACH ROW EXECUTE FUNCTION audit_change();
