-- 037 · BE-117. Sự kiện lỗi: người dùng báo "Mã lỗi" (errorId trong ProblemDetails) thì quản trị tra ra đúng request và người.
-- Chuỗi tra: error_id → correlation_id → access_events.correlation_id. Chỉ ghi phần đã có trong log: không có thân request,
-- không có chuỗi truy vấn, không có thông điệp ngoại lệ (có thể chứa dữ liệu). Giữ 90 ngày (SessionCleanupService dọn).
SET search_path = hoso, public, pg_catalog;

CREATE TABLE error_events (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  error_id text NOT NULL CHECK (error_id ~ '^[0-9A-F]{8}$'),
  correlation_id text,
  status smallint NOT NULL CHECK (status BETWEEN 400 AND 599),
  error_code text NOT NULL,
  method text NOT NULL,
  path text NOT NULL,
  user_id uuid REFERENCES users(id),
  assignment text,
  happened_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX error_events_error_id_idx ON error_events(error_id);
CREATE INDEX error_events_correlation_idx ON error_events(correlation_id) WHERE correlation_id IS NOT NULL;
CREATE INDEX error_events_happened_idx ON error_events(happened_at DESC);

-- API ghi và đọc; xóa chỉ để dọn quá hạn, không có UPDATE (nhật ký không sửa được).
GRANT SELECT, INSERT, DELETE ON error_events TO hoso_api;
GRANT USAGE, SELECT ON SEQUENCE error_events_id_seq TO hoso_api;
REVOKE SELECT ON error_events FROM hoso_readonly;

COMMENT ON TABLE error_events IS 'Mã lỗi đã trả cho người dùng → request và người. Không chứa nội dung dữ liệu.';
