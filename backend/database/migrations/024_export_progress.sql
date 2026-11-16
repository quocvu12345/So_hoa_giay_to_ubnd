-- 024 · Gói xuất: nhịp sống của việc đang chạy (để nhặt lại việc treo) và báo tiến độ cho giao diện.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE export_packages
  ADD COLUMN started_at timestamptz,
  ADD COLUMN heartbeat_at timestamptz;

-- Mỗi lần trạng thái hoặc tiến độ đổi thì báo người yêu cầu (API đang LISTEN và chuyển thành sự kiện SSE).
CREATE FUNCTION notify_export_progress() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM pg_notify('export_progress', json_build_object(
    'id', NEW.id, 'userId', NEW.requested_by, 'status', NEW.status,
    'processed', NEW.processed_items, 'total', NEW.total_items)::text);
  RETURN NULL;
END $$;
CREATE TRIGGER export_packages_notify AFTER UPDATE OF status, processed_items ON export_packages
FOR EACH ROW WHEN (OLD.status IS DISTINCT FROM NEW.status OR OLD.processed_items IS DISTINCT FROM NEW.processed_items)
EXECUTE FUNCTION notify_export_progress();

-- Việc "running" mà tiến trình đã chết (không còn nhịp sống) được xếp lại hàng đợi. Trả số việc được xếp lại.
CREATE FUNCTION requeue_stale_exports(p_older interval DEFAULT interval '10 minutes') RETURNS integer LANGUAGE sql AS $$
  WITH r AS (
    UPDATE hoso.export_packages SET status = 'queued', processed_items = 0, started_at = NULL, heartbeat_at = NULL
    WHERE status = 'running' AND coalesce(heartbeat_at, started_at, created_at) < now() - p_older
    RETURNING 1)
  SELECT count(*)::integer FROM r $$;
