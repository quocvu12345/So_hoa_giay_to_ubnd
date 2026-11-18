-- 041 · LOG-05. Mã tương quan trong nhật ký thay đổi dữ liệu.
-- Mỗi request có một mã tương quan (header X-Correlation-Id, có trong log JSON, access_events, error_events). Trước đây audit_events không có,
-- nên thấy một dòng thay đổi dữ liệu thì không tra ngược được về request đã gây ra nó. ActorContextInterceptor đã đặt sẵn hoso.correlation_id
-- cho mọi kết nối; trigger chỉ cần đọc thêm. Các dòng cũ không có mã (NULL), nhật ký vẫn bất biến.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE audit_events ADD COLUMN correlation_id text;
CREATE INDEX audit_events_correlation_idx ON audit_events (correlation_id) WHERE correlation_id IS NOT NULL;

CREATE OR REPLACE FUNCTION audit_change() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO hoso.audit_events(table_name, operation, database_user, actor_subject, correlation_id, old_row, new_row)
  VALUES (TG_TABLE_NAME, TG_OP, session_user, nullif(current_setting('hoso.actor_subject', true), ''), nullif(current_setting('hoso.correlation_id', true), ''),
    CASE WHEN TG_OP <> 'INSERT' THEN to_jsonb(OLD) END,
    CASE WHEN TG_OP <> 'DELETE' THEN to_jsonb(NEW) END);
  IF TG_OP = 'DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
