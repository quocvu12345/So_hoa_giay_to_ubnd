-- 038 · BE-111. Chỉ mục cho danh sách hồ sơ sắp theo tên và theo hạn nội bộ.
-- Không có chỉ mục thì PostgreSQL phải tính phạm vi (scope_matches) cho MỌI hồ sơ rồi mới sắp: 20.000 hồ sơ mất ~350 ms.
-- Có chỉ mục thì đi theo thứ tự và dừng ngay khi đủ trang. Mã và "mới cập nhật" đã có chỉ mục (dossiers_code_key, dossiers_keyset_idx).
-- Hạn nội bộ: hồ sơ chưa có hạn luôn xếp CUỐI cả hai chiều, nên chỉ mục mở đầu bằng (internal_due_on IS NULL); chiều giảm dần cần chỉ mục riêng
-- vì PostgreSQL chỉ đọc ngược được khi MỌI cột cùng đảo chiều.
SET search_path = hoso, public, pg_catalog;

CREATE INDEX dossiers_title_idx ON dossiers (title, id);
CREATE INDEX dossiers_due_asc_idx ON dossiers ((internal_due_on IS NULL), internal_due_on, id);
CREATE INDEX dossiers_due_desc_idx ON dossiers ((internal_due_on IS NULL), internal_due_on DESC, id DESC);
