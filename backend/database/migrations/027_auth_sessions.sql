-- 027 · Phiên đăng nhập lưu trong CSDL (BE-12).
-- Cookie chỉ chứa khóa phiên (ngẫu nhiên, đã mã hóa bằng Data Protection); vé xác thực nằm ở đây nên thu hồi được ngay:
-- đăng xuất, khóa tài khoản hoặc quản trị bấm "buộc đăng xuất" đều làm cookie cũ hết tác dụng ở request kế tiếp.
-- Vé chứa mã người dùng, tên và id_token (để gửi id_token_hint khi đăng xuất); không có access/refresh token. Role chỉ-đọc không được đọc bảng này.
SET search_path = hoso, public, pg_catalog;

CREATE TABLE auth_sessions (
  id text PRIMARY KEY CHECK (length(id) >= 32),
  user_id uuid NOT NULL REFERENCES users(id),
  ticket bytea NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  renewed_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  revoked_at timestamptz,
  revoked_reason text,
  CHECK ((revoked_at IS NULL) = (revoked_reason IS NULL))
);
CREATE INDEX auth_sessions_user_idx ON auth_sessions(user_id) WHERE revoked_at IS NULL;
CREATE INDEX auth_sessions_expiry_idx ON auth_sessions(expires_at);
COMMENT ON TABLE auth_sessions IS 'Phiên đăng nhập phía máy chủ. Thu hồi bằng revoked_at; dịch vụ nền xóa dòng hết hạn sau 1 ngày và dòng đã thu hồi sau 7 ngày.';

GRANT SELECT, INSERT, UPDATE, DELETE ON auth_sessions TO hoso_api;
