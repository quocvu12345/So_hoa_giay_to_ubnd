-- 039 · BE-126. Bản quét thay thế của giấy tờ (phiên bản 2, 3…).
-- Bản cũ KHÔNG bị xóa hay sửa nội dung: vẫn mở, tải được và là nơi các trường đã đối chiếu trỏ vùng nguồn (document_field_values.source_file_id).
-- Bản thay thế ghi bản nó thay (replaces_file_id) và lý do (bắt buộc, từ 10 ký tự): giấy tờ lưu trữ đổi bản quét phải có căn cứ.
SET search_path = hoso, public, pg_catalog;

ALTER TABLE files
  ADD COLUMN replaces_file_id uuid,
  ADD COLUMN replacement_reason text,
  -- Cùng giấy tờ: khóa ngoại hai cột dựa trên UNIQUE (id, document_id) có sẵn.
  ADD CONSTRAINT files_replaces_same_document_fk FOREIGN KEY (replaces_file_id, document_id) REFERENCES files(id, document_id),
  ADD CONSTRAINT files_replacement_reason_chk CHECK (
    (replaces_file_id IS NULL AND replacement_reason IS NULL)
    OR (replaces_file_id IS NOT NULL AND length(btrim(replacement_reason)) >= 10 AND length(replacement_reason) <= 500)
  ),
  ADD CONSTRAINT files_replacement_self_chk CHECK (replaces_file_id IS NULL OR replaces_file_id <> id);

-- Mỗi bản chỉ bị thay một lần (chuỗi phiên bản thẳng, không rẽ nhánh). Tìm bản thay của một tệp: tìm kiếm toàn văn bỏ trang của bản đã bị thay.
CREATE UNIQUE INDEX files_replaces_file_uq ON files(replaces_file_id) WHERE replaces_file_id IS NOT NULL;

COMMENT ON COLUMN files.replaces_file_id IS 'Bản quét mà tệp này thay thế (cùng giấy tờ, phiên bản trước). NULL: bản gốc.';
COMMENT ON COLUMN files.replacement_reason IS 'Lý do thay bản quét (bắt buộc khi có replaces_file_id).';
