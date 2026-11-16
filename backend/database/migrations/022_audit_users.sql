-- 022 · Ghi vết thay đổi bảng users (khóa/mở khóa, đổi tên, đổi mã danh tính). Trước đó chỉ user_roles và delegations được ghi.
SET search_path = hoso, public, pg_catalog;

CREATE TRIGGER users_audit AFTER INSERT OR UPDATE OR DELETE ON users FOR EACH ROW EXECUTE FUNCTION audit_change();
