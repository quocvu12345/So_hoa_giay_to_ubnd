-- 043 · qwen_vl (Qwen3-VL-8B, đối chiếu ảnh + chữ) thôi ghi là mô hình đang bật.
-- Phương án này bị loại cùng NuExtract, BKEE, Qwen3.5-4B (docs/tasks/ai.md, mã đã gỡ ở commit bba886b): không worker nào nạp nó,
-- nhưng migration 013 để active = true nên trang vận hành vẫn liệt kê như đang dùng. Giữ dòng làm lịch sử, chỉ tắt và ghi lý do.
SET search_path = hoso, public, pg_catalog;

UPDATE ai_models
SET active = false,
    receipt = receipt || jsonb_build_object(
      'retired', 'Phương án Qwen3-VL-8B bị loại ngày 17/11/2026; mã đã gỡ (commit bba886b), không worker nào nạp',
      'retired_by', '043_retire_qwen_vl.sql')
WHERE key = 'qwen_vl';
