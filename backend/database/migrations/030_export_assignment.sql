-- 030 · Gói xuất gắn với phân công đã tạo và thu hồi được (BE-91, rà soát bảo mật 16/11/2026).
-- Trước đây ai tạo được gói thì tải được tới hết 7 ngày dù đã mất quyền hồ sơ. Từ nay: gói ghi mã phân công đã dùng; khi tải kiểm lại quyền, phân công
-- và phạm vi từng hồ sơ; mất phạm vi thì gói chuyển sang 'revoked' và nội dung bị xóa như gói hết hạn. Kết thúc phân công, thu hồi ủy quyền, khóa tài khoản
-- cũng thu hồi các gói còn hiệu lực của phân công đó (hàm revoke_exports).
SET search_path = hoso, public, pg_catalog;

ALTER TABLE export_packages ADD COLUMN requested_assignment text;
ALTER TABLE export_packages DROP CONSTRAINT export_packages_status_check;
ALTER TABLE export_packages ADD CONSTRAINT export_packages_status_check
  CHECK (status IN ('queued','running','ready','failed','expired','revoked'));
CREATE INDEX export_packages_assignment_idx ON export_packages(requested_by, requested_assignment) WHERE status IN ('queued','running','ready');

-- Thu hồi các gói còn hiệu lực của một người (hoặc chỉ của một phân công). Trả số gói bị thu hồi.
CREATE FUNCTION revoke_exports(p_user uuid, p_assignment text DEFAULT NULL, p_reason text DEFAULT '') RETURNS integer LANGUAGE sql AS $$
  WITH r AS (
    UPDATE hoso.export_packages SET status = 'revoked', error_message = left(p_reason, 500)
    WHERE requested_by = p_user AND status IN ('queued','running','ready')
      AND (p_assignment IS NULL OR requested_assignment = p_assignment)
    RETURNING 1)
  SELECT count(*)::integer FROM r $$;
COMMENT ON FUNCTION revoke_exports(uuid, text, text) IS 'Thu hồi gói xuất còn hiệu lực của người dùng (tùy chọn: chỉ của một phân công). Nội dung được dịch vụ nền xóa sau đó.';
