-- 033 · Mô hình phân loại và trích trường mặc định là Qwen3-1.7B (AI-14, chốt 17/11/2026).
-- Lý do: máy AI hiện tại (Mac M4 16 GB) chưa đủ cho mô hình lớn hơn. Có phần cứng tốt hơn thì đổi bằng cấu hình của worker
-- (HOSO_AI_CLASSIFIER_MODEL, xem ai-worker/README.md) rồi thêm một migration như tệp này; bảng chỉ GHI NHẬN, không quyết định mô hình nào được nạp.
-- Trang vận hành so mô hình thật sự chạy (ocr_jobs.model_version) với dòng này (BE-100).
SET search_path = hoso, public, pg_catalog;

UPDATE ai_models
SET repo = 'mlx-community/Qwen3-1.7B-4bit',
    revision = '3b1b1768f8f8cf8351c712464f906e86c2b8269e',
    purpose = 'Gợi ý nhóm, loại giấy tờ và trích trường',
    receipt = jsonb_build_object(
      'decision', 'Dùng Qwen3-1.7B làm mặc định vì phần cứng hiện tại chưa đáp ứng mô hình lớn hơn (quyết định 17/11/2026)',
      'previous', jsonb_build_object('repo', repo, 'revision', revision),
      'rollback', 'Đặt HOSO_AI_CLASSIFIER_MODEL=Qwen3-4B-Instruct-2507-4bit (tải bằng: python -m document_ai.download --model classifier_4b) rồi khởi động lại worker',
      'measured_on', 'dữ liệu giả lập 56 tài liệu: trích trường đúng 90,2% (4B: 88,9%), 14,2 giây/tài liệu với lời nhắc đầy đủ (4B: 24,9 giây)')
WHERE key = 'classifier';
