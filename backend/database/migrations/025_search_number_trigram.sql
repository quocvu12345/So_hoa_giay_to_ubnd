-- 025 · Tra cứu gần đúng theo số ký hiệu (BE-80).
-- Số ký hiệu hay bị gõ lệch ("17 NQ HDND", "17/NQHĐND", bỏ dấu gạch): xếp hạng theo độ giống pg_trgm.
-- Chỉ mục khớp đúng biểu thức dùng trong truy vấn tra cứu: hoso.f_fold(coalesce(document_number, '')).
SET search_path = hoso, public, pg_catalog;

CREATE INDEX documents_number_trgm_idx ON documents USING gin (hoso.f_fold(coalesce(document_number, '')) gin_trgm_ops);
