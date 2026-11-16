-- 031 · Nhật ký truy cập ghi phân công đã dùng (BE-94).
-- Cột user_role_id đã có nhưng chưa từng được ghi, nên không biết người xem/tải dùng phân công nào. `assignment` ghi đúng mã phân công đang dùng
-- (user_roles.id, hoặc "d:<delegations.id>" khi dùng quyền được ủy); user_role_id chỉ điền được với phân công riêng (khóa ngoại).
SET search_path = hoso, public, pg_catalog;

ALTER TABLE access_events ADD COLUMN assignment text;
