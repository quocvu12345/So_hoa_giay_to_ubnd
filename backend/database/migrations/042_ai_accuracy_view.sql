-- 042 · DB-14 (v_ai_accuracy), AI-10. Độ đúng của AI đo từ việc cán bộ đã đối chiếu, theo mô hình, loại giấy tờ và trường.
-- Nguồn: mỗi giá trị trong document_field_values do người xác nhận (needs_review = false, có verified_by) và còn trỏ về gợi ý AI đã sao sang nó
-- (ai_field_suggestion_id). So giá trị AI gợi ý với giá trị người chốt, sau khi bỏ khoảng trắng thừa:
--   accepted  AI có giá trị và người giữ nguyên
--   edited    AI có giá trị và người sửa thành giá trị khác
--   cleared   AI có giá trị và người xóa trống (AI đọc cái không có thật)
--   missed    AI để trống và người điền (AI bỏ sót)
-- Trường AI để trống và người cũng để trống không nói lên điều gì nên không tính. Chỉ gợi ý ĐÃ ĐƯỢC chấp nhận sao sang bảng chính mới có dòng ở đây:
-- gợi ý bị bỏ qua hay đổi nhóm/loại không tính (người dùng không xác nhận trường nào từ nó).
SET search_path = hoso, public, pg_catalog;

CREATE VIEW v_ai_accuracy AS
WITH judged AS (
  SELECT s.model_key, s.document_type_code, d.work_group_code, f.field_definition_code, fd.label AS field_label,
         nullif(regexp_replace(btrim(f.value), '\s+', ' ', 'g'), '') AS suggested_value,
         nullif(regexp_replace(btrim(coalesce(v.value_text, '')), '\s+', ' ', 'g'), '') AS final_value
  FROM document_field_values v
  JOIN ai_field_suggestions f ON f.id = v.ai_field_suggestion_id
  JOIN ai_suggestions s ON s.id = f.suggestion_id
  JOIN field_definitions fd ON fd.code = f.field_definition_code
  JOIN document_types d ON d.code = s.document_type_code
  WHERE v.needs_review = false AND v.verified_by IS NOT NULL AND s.document_type_code IS NOT NULL
)
SELECT model_key, work_group_code, document_type_code, field_definition_code, field_label,
       count(*) FILTER (WHERE suggested_value IS NOT NULL) AS suggested,
       count(*) FILTER (WHERE suggested_value IS NOT NULL AND final_value = suggested_value) AS accepted,
       count(*) FILTER (WHERE suggested_value IS NOT NULL AND final_value IS NOT NULL AND final_value <> suggested_value) AS edited,
       count(*) FILTER (WHERE suggested_value IS NOT NULL AND final_value IS NULL) AS cleared,
       count(*) FILTER (WHERE suggested_value IS NULL AND final_value IS NOT NULL) AS missed,
       round((count(*) FILTER (WHERE suggested_value IS NOT NULL AND final_value = suggested_value))::numeric
             / nullif(count(*) FILTER (WHERE suggested_value IS NOT NULL OR final_value IS NOT NULL), 0), 4) AS accepted_rate
FROM judged
WHERE suggested_value IS NOT NULL OR final_value IS NOT NULL
GROUP BY model_key, work_group_code, document_type_code, field_definition_code, field_label;

COMMENT ON VIEW v_ai_accuracy IS
  'Độ đúng của AI theo trường, đo từ giá trị cán bộ đã đối chiếu. accepted_rate = accepted / (trường AI có giá trị hoặc người điền): trường AI bỏ sót (missed) kéo tỉ lệ xuống, trường cả hai để trống thì không tính.';

GRANT SELECT ON v_ai_accuracy TO hoso_api, hoso_readonly;
