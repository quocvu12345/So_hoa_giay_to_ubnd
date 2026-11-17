-- 036 · Mô hình phân loại và trích trường mặc định là Qwen3-4B-Instruct-2507 IFStruct (chốt 17/11/2026), thay Qwen3-1.7B của migration 033.
-- Worker nạp bản MLX 4-bit tự chuyển từ nguồn BF16 này (python -m document_ai.convert), thư mục Qwen3-4B-Instruct-2507-ifstruct-4bit.
-- Bảng chỉ GHI NHẬN, không quyết định mô hình nào được nạp; trang vận hành so với ocr_jobs.model_version (BE-100).
SET search_path = hoso, public, pg_catalog;

UPDATE ai_models
SET repo = 'ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct',
    revision = '00161de525486e01ba505e6c24f39472fdfe4a23',
    purpose = 'Gợi ý nhóm, loại giấy tờ và trích trường',
    receipt = jsonb_build_object(
      'decision', 'Dùng IFStruct (Qwen3-4B-Instruct-2507 tinh chỉnh tuân thủ JSON/schema) làm mặc định (quyết định 17/11/2026)',
      'previous', jsonb_build_object('repo', repo, 'revision', revision),
      'local_build', 'MLX 4-bit, group 64, affine; thư mục Qwen3-4B-Instruct-2507-ifstruct-4bit, có conversion-receipt.json',
      'rollback', 'Đặt HOSO_AI_CLASSIFIER_MODEL về thư mục mô hình cũ còn trên máy rồi khởi động lại worker, và thêm migration ghi lại',
      'measured_on', 'dữ liệu giả lập 20 tài liệu, 79 giá trị: trích trường đúng 86,1% (Qwen3-4B gốc: 78,5%), bỏ sót 3 (gốc: 8), cùng 2,98 GiB bộ nhớ MLX')
WHERE key = 'classifier';
