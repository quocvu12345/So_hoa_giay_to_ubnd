-- 021 · Tài khoản quản trị GIẢ LẬP cho phát triển (tệp *_optional: KHÔNG chạy ở Production).
--
-- dev_admin có nhiều phân công, đúng theo mô hình phân quyền (không phải cửa hậu):
--   technical_admin  → quản trị người dùng, cấu hình, danh mục, hàng đợi AI. Theo thiết kế KHÔNG đọc nội dung hồ sơ.
--   chair / council / clerk / manager theo từng đơn vị → để thử giao diện và quy trình ở mọi vai trò (đổi bằng bộ chọn phân công).
-- Phân công đầu tiên (technical_admin) là mặc định khi đăng nhập. Đăng nhập dev: /api/v1/auth/dev-login?username=dev_admin.
SET search_path = hoso, public, pg_catalog;

INSERT INTO users(username, display_name, is_demo, active)
VALUES ('dev_admin', 'GIẢ LẬP · Quản trị dev (nhiều phân công)', true, true)
ON CONFLICT (username) DO NOTHING;

-- Mặc định: quản trị kỹ thuật (valid_from sớm nhất nên đứng đầu danh sách phân công).
INSERT INTO user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis)
SELECT u.id, 'technical_admin', NULL, NULL, now() - interval '1 day', 'Tài khoản GIẢ LẬP cho phát triển; không dùng ở production'
FROM users u WHERE u.username = 'dev_admin'
ON CONFLICT DO NOTHING;

-- Lãnh đạo và văn thư theo cơ quan.
INSERT INTO user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis)
SELECT u.id, r.role_code, r.organization_code, NULL, now(), 'Tài khoản GIẢ LẬP cho phát triển; không dùng ở production'
FROM users u
CROSS JOIN (VALUES ('chair','tl-ubnd'), ('clerk','tl-ubnd'), ('council','tl-hdnd'), ('clerk','tl-hdnd')) AS r(role_code, organization_code)
WHERE u.username = 'dev_admin'
ON CONFLICT DO NOTHING;

-- Trưởng phòng/Ban của mọi đơn vị trong danh mục.
INSERT INTO user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis)
SELECT u.id, 'manager', s.organization_code, s.department_code, now(), 'Tài khoản GIẢ LẬP cho phát triển; không dùng ở production'
FROM users u CROSS JOIN department_scopes s
WHERE u.username = 'dev_admin'
ON CONFLICT DO NOTHING;

-- Chuyên viên của đơn vị Hạ tầng (UBND) để thử soạn hồ sơ và tải PDF.
INSERT INTO user_roles(user_id, role_code, organization_code, department_code, valid_from, assignment_basis)
SELECT u.id, 'employee', 'tl-ubnd', 'ht', now(), 'Tài khoản GIẢ LẬP cho phát triển; không dùng ở production'
FROM users u WHERE u.username = 'dev_admin'
ON CONFLICT DO NOTHING;
