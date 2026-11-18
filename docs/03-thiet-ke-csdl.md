# 03 · Thiết kế cơ sở dữ liệu

PostgreSQL 16, schema `hoso`. Thiết kế **giữ nguyên 23 bảng** trong `database/001_schema.sql` (đã có kiểm thử) và mở rộng thêm để phủ đủ 12 nhóm chức năng trong đề xuất. Tổng cộng **60 bảng** (23 hiện có + 37 mới), chia 10 nhóm.

Ký hiệu trong sơ đồ:

- Bảng có `<<mới>>`: bảng thêm mới.
- Cột có `★`: cột thêm vào bảng hiện có.
- `PK`, `FK`, `UQ`: khóa chính, khóa ngoại, duy nhất.

---

## 1. Quy ước

| Hạng mục | Quy ước |
|---|---|
| Tên | `snake_case`, bảng số nhiều, tiếng Anh; nhãn tiếng Việt nằm trong dữ liệu |
| Khóa chính | Danh mục dùng mã `text` (`U15`, `ht`, `tl-ubnd`); thực thể nghiệp vụ dùng `uuid` (`gen_random_uuid()`); nhật ký dùng `bigint identity` |
| Thời gian | `timestamptz` cho thời điểm; `date` cho ngày nghiệp vụ (ngày ban hành, hạn) |
| Giá trị liệt kê | `text` + `CHECK (... IN (...))`; ánh xạ sang `enum` C# bằng value converter. Không dùng kiểu `ENUM` của PostgreSQL vì khó đổi |
| Tiền tệ, số đo | Lưu chuỗi gốc trong `value_text`; giá trị chuẩn hóa ở cột riêng khi cần |
| Xóa | Không xóa cứng dữ liệu nghiệp vụ. Dùng trạng thái (`discarded`, `revoked_at`, `ended_at`). Hủy tài liệu chỉ qua `disposal_requests` |
| Khóa lạc quan | Bảng được sửa đồng thời (`dossiers`, `documents`, `document_field_values`) có cột `row_version` ★ dùng `xmin` của PostgreSQL qua EF Core |
| Nhật ký | `audit_events`, `workflow_events`, `access_events` chỉ ghi thêm (trigger chặn sửa, xóa) |
| Extension | `pgcrypto` (đã có), `unaccent`, `pg_trgm` cho tìm kiếm tiếng Việt không dấu |

---

## 2. Sơ đồ tổng quan

```mermaid
flowchart LR
  subgraph A["A · Tổ chức & danh mục"]
    org[organizations] --> ds[department_scopes] --> wg[work_groups] --> dt[document_types] --> fd[field_definitions]
    wg --> rr["retention_rules ★"]
  end
  subgraph B["B · Định danh & phân quyền"]
    u[users] --> ur[user_roles] --> dl["delegations ★"]
    u --> ag["document_access_grants ★"]
  end
  subgraph C["C · Thủ tục hành chính ★"]
    pr[procedures] --> pc[procedure_components] --> ft[form_templates]
  end
  subgraph D["D · Tiếp nhận & số hóa"]
    sb["scan_batches ★"] --> fi[files] --> pi["page_images ★"]
    sb --> qi["quality_issues ★"]
  end
  subgraph E["E · Văn bản"]
    doc[documents] --> seg["document_segments ★"]
    doc --> fv[document_field_values]
    doc --> rel["document_relations ★"]
  end
  subgraph F["F · Xử lý AI"]
    oj[ocr_jobs] --> op["ocr_pages ★"]
    oj --> as["ai_suggestions ★"] --> afs["ai_field_suggestions ★"]
  end
  subgraph G["G · Hồ sơ & quy trình"]
    dos[dossiers] --> dd[dossier_documents]
    dos --> da["dossier_assignments ★"]
    dos --> we[workflow_events]
  end
  subgraph H["H · Kho bản giấy ★"]
    sl[storage_locations] --> ln[loans]
  end
  subgraph I["I · Nộp lưu & bàn giao ★"]
    asub[archive_submissions] --> ex[export_packages]
    dp[disposal_requests]
  end
  subgraph J["J · Hệ thống"]
    au[audit_events]
    nt["notifications ★"]
    ob["outbox_messages ★"]
  end
  wg --> dos
  fi --> doc
  fi --> oj
  dd --> doc
  pc --> dd
  dt --> fv
  sl --> dos
  dos --> asub
  ur -. phạm vi .-> dos
```

---

## 3. Nhóm A · Tổ chức & danh mục

```mermaid
classDiagram
  direction LR
  class organizations {
    +text code PK
    +text name
    +text kind UBND|HDND
    +text locality
    +date valid_from ★
    +date valid_until ★
  }
  class organization_names {
    <<mới>>
    +bigint id PK
    +text organization_code FK
    +text name
    +date valid_from
    +date valid_until
    +text basis
  }
  class departments {
    +text code PK
    +text name
    +text kind
    +text assignment_note
    +text verification_status proposed|confirmed
    +date valid_from
    +date valid_until
  }
  class department_scopes {
    +text department_code PK FK
    +text organization_code PK FK
  }
  class work_groups {
    +text code PK
    +text organization_code FK
    +text department_code FK
    +text title
    +text responsibility
    +text filing_rule
    +text business_fields
    +text verification_status
    +bool active ★
  }
  class document_types {
    +text code PK
    +text work_group_code FK
    +text name
    +text document_form ★
    +bool required_in_dossier ★
    +smallint min_count ★
    +bool active ★
  }
  class field_definitions {
    +text code PK
    +text document_type_code FK
    +text label
    +int position
    +text value_type text|date|number|boolean
    +bool required_for_review
    +text field_group ★
    +bool is_key_field ★
    +text validation_pattern ★
  }
  class retention_rules {
    <<mới>>
    +uuid id PK
    +text work_group_code FK
    +text document_type_code FK
    +text retention_label
    +smallint retention_years
    +text legal_reference
    +text status proposed|confirmed
    +uuid confirmed_by FK
    +timestamptz confirmed_at
  }
  organizations "1" -- "*" organization_names
  organizations "1" -- "*" department_scopes
  departments "1" -- "*" department_scopes
  department_scopes "1" -- "*" work_groups
  work_groups "1" *-- "*" document_types
  document_types "1" *-- "*" field_definitions
  work_groups "1" -- "*" retention_rules
```

| Bảng | Ghi chú thiết kế |
|---|---|
| `organization_names` | Tên cơ quan theo thời kỳ (trước/sau sắp xếp 2025). Giấy tờ giữ tên tại thời điểm lập; tra cứu theo tên cũ vẫn ra |
| `document_types.document_form` | Hình thức (Quyết định, Công văn…) để đối chiếu với `documents.document_form` mà AI đọc |
| `document_types.required_in_dossier`, `min_count` | Dùng cho danh sách kiểm tra đủ thành phần. Mặc định `false` vì danh mục hiện là đề xuất |
| `field_definitions.is_key_field` | Trường quan trọng (người, định danh, số tiền, số thửa, số/ký hiệu) bắt buộc người kiểm tra xác nhận |
| `retention_rules` | Chỉ lưu khi cơ quan xác nhận (`status=confirmed`); không tự đặt thời hạn |

---

## 4. Nhóm B · Định danh & phân quyền

```mermaid
classDiagram
  direction LR
  class users {
    +uuid id PK
    +text username UQ
    +text display_name
    +text email ★
    +text external_auth_subject UQ
    +bool is_demo
    +bool active
    +timestamptz last_login_at ★
    +timestamptz created_at
  }
  class roles {
    +text code PK
    +text name
    +text scope_kind assigned|department|organization|technical
  }
  class permissions {
    +text code PK
    +text description
  }
  class role_permissions {
    +text role_code PK FK
    +text permission_code PK FK
  }
  class user_roles {
    +uuid id PK
    +uuid user_id FK
    +text role_code FK
    +text organization_code FK
    +text department_code FK
    +timestamptz valid_from
    +timestamptz valid_until
    +text assignment_basis
    +bool is_deputy ★
  }
  class delegations {
    <<mới>>
    +uuid id PK
    +uuid from_user_role_id FK
    +uuid to_user_id FK
    +text[] permission_codes
    +timestamptz valid_from
    +timestamptz valid_until
    +text basis
    +uuid created_by FK
    +timestamptz revoked_at
  }
  class document_access_grants {
    <<mới>>
    +uuid id PK
    +uuid dossier_id FK
    +uuid document_id FK
    +uuid grantee_user_id FK
    +text access view|download|print
    +timestamptz valid_until
    +text reason
    +uuid granted_by FK
    +timestamptz revoked_at
  }
  class access_events {
    <<mới>>
    +bigint id PK
    +uuid user_id FK
    +uuid user_role_id FK
    +text action view|download|print|export|search
    +text object_type
    +uuid object_id
    +inet client_ip
    +timestamptz happened_at
  }
  users "1" -- "*" user_roles
  roles "1" -- "*" user_roles
  roles "1" -- "*" role_permissions
  permissions "1" -- "*" role_permissions
  user_roles "1" -- "*" delegations : ủy quyền
  users "1" -- "*" delegations : nhận
  users "1" -- "*" document_access_grants
  users "1" -- "*" access_events
```

**Quyền bổ sung** (seed vào `permissions`): `document.view`, `document.download`, `document.print`, `document.edit`, `intake.upload`, `intake.manage`, `intake.qc`, `processing.manage`, `catalog.manage`, `storage.manage`, `loan.request`, `loan.approve`, `export.create`, `disposal.request`, `disposal.approve`, `admin.users`, `admin.settings`.

**Quy tắc phạm vi** (mở rộng `scope_matches`):

1. Phân công còn hiệu lực (`valid_from ≤ now < valid_until`) và người dùng `active`.
2. Hoặc ủy quyền còn hiệu lực trỏ tới phân công đó, chỉ với `permission_codes` được ủy.
3. Hồ sơ `access_level = restricted` chỉ đọc được khi có thêm `document_access_grants` còn hiệu lực.
4. `technical_admin` không đọc nội dung hồ sơ.

`access_events` phân vùng theo tháng (`PARTITION BY RANGE (happened_at)`) vì tăng nhanh.

---

## 5. Nhóm C · Thủ tục hành chính (mới)

Nạp từ `data/official-forms/*.json` bằng script nhập có thể chạy lại.

```mermaid
classDiagram
  direction LR
  class procedures {
    <<mới>>
    +text id PK hn87-001 | dvc-…
    +text procedure_code
    +text name
    +text domain
    +text managing_agency
    +text execution_level
    +text competent_authority
    +text fees
    +text receiving_location
    +text ministry_decision
    +text hanoi_decision
    +text workflow_decision
    +text delegation_decision
    +date delegation_expiry
    +text source_url
    +int source_page
    +text lifecycle_status active|repealed|replaced|unverified
    +timestamptz collected_at
  }
  class procedure_lifecycle_events {
    <<mới>>
    +bigint id PK
    +text procedure_code
    +text status
    +text label
    +text note
    +jsonb evidence
    +date effective_from
    +date reviewed_on
  }
  class procedure_departments {
    <<mới>>
    +text procedure_id PK FK
    +text department_code PK FK
    +text organization_code FK
    +text verification_status
  }
  class paper_types {
    <<mới>>
    +text code PK G09-KQ003211
    +text canonical_name
    +jsonb names
  }
  class procedure_components {
    <<mới>>
    +uuid id PK
    +text procedure_id FK
    +text section
    +int position
    +text name
    +text paper_code FK
    +smallint original_quantity
    +smallint copy_quantity
    +bool required_as_published
    +bool has_electronic_form
  }
  class form_templates {
    <<mới>>
    +uuid id PK
    +text kind blank_form|guide_pdf|eform_json|official_bundle
    +text filename
    +text sha256
    +bigint byte_size
    +text storage_key
    +text source_url
    +text version_label
    +uuid superseded_by FK
  }
  class procedure_component_templates {
    <<mới>>
    +uuid component_id PK FK
    +uuid template_id PK FK
  }
  class form_template_fields {
    <<mới>>
    +uuid id PK
    +uuid template_id FK
    +text field_key
    +text label
    +int page
    +jsonb bbox
    +text input_type
    +text role
  }
  procedures "1" *-- "*" procedure_components
  procedures "1" -- "*" procedure_departments
  procedures "*" -- "*" procedure_lifecycle_events : procedure_code
  paper_types "1" -- "*" procedure_components
  procedure_components "1" -- "*" procedure_component_templates
  form_templates "1" -- "*" procedure_component_templates
  form_templates "1" *-- "*" form_template_fields
```

| Điểm thiết kế | Lý do |
|---|---|
| `procedures.id` là mã nguồn (`hn87-001`, `dvc-…`), `procedure_code` không duy nhất | Một mã DVC có thể xuất hiện ở cả danh sách Hà Nội và Cổng DVC Quốc gia |
| `lifecycle_status` + `procedure_lifecycle_events` | 32 thủ tục đã có quyết định thay thế/bãi bỏ; giữ lịch sử, không dùng mẫu cũ làm mẫu hiện hành |
| `required_as_published` | Một thành phần nguồn có thể là điều kiện hoặc lời hướng dẫn, không nhất thiết là giấy phải nộp |
| `form_templates.sha256` | 1.085 tệp chỉ có 768 nội dung khác nhau; tệp lưu một lần, nhiều liên kết |
| `form_template_fields.bbox` | Từ `data/form-test-data/schemas.json`, dùng cho trích xuất theo toạ độ và kiểm thử |

---

## 6. Nhóm D · Tiếp nhận & số hóa

```mermaid
classDiagram
  direction LR
  class scan_batches {
    <<mới>>
    +uuid id PK
    +text code UQ
    +text organization_code FK
    +text department_code FK
    +text handed_over_by
    +uuid received_by FK
    +uuid handover_document_id FK
    +text box_label
    +int expected_sheet_count
    +int scanned_page_count
    +text status open|scanning|qc|closed
    +timestamptz opened_at
    +timestamptz closed_at
  }
  class files {
    +uuid id PK
    +uuid document_id FK
    +text component_key
    +int version_no
    +text file_role published_pdf|published_attachment|scan|derivative|ocr_pdf ★|signed ★
    +text original_name
    +text media_type
    +bigint byte_size
    +text sha256
    +int page_count
    +text external_url
    +text local_path
    +text storage_key
    +uuid scan_batch_id ★ FK
    +uuid replaces_file_id ★ FK bản quét mà tệp này thay (cùng giấy tờ, migration 039)
    +text replacement_reason ★ bắt buộc khi thay, 10-500 ký tự
    +uuid uploaded_by ★ FK
    +timestamptz uploaded_at ★
  }
  class page_images {
    <<mới>>
    +uuid file_id PK FK
    +int page_no PK
    +int width_px
    +int height_px
    +smallint dpi
    +smallint rotation
    +text[] quality_flags blank|blurry|skewed|cropped|duplicate
    +text quality_status ok|suspect|rescan_required|rescanned
    +text preview_storage_key
  }
  class quality_issues {
    <<mới>>
    +uuid id PK
    +uuid scan_batch_id FK
    +uuid document_id FK
    +uuid file_id FK
    +int page_no
    +text issue_type
    +text severity low|medium|high
    +text description
    +text status open|fixed|wont_fix
    +uuid raised_by FK
    +timestamptz raised_at
    +uuid resolved_by FK
    +timestamptz resolved_at
  }
  scan_batches "1" -- "*" files
  scan_batches "1" -- "*" quality_issues
  files "1" *-- "*" page_images
  files "1" -- "*" quality_issues
```

- **Chống trùng:** `CREATE UNIQUE INDEX files_scan_sha256_uq ON files(sha256) WHERE file_role = 'scan'`.
- **Ba lớp tách rõ:** lô quét (`scan_batches`) → tệp quét (`files`) → văn bản (`documents`, tách bằng `document_segments`) → hồ sơ (`dossiers`).
- Biên bản giao nhận là một `documents` (`handover_document_id`), không phải tệp rời.

---

## 7. Nhóm E · Văn bản & tệp

```mermaid
classDiagram
  direction LR
  class sources {
    +text id PK
    +text publisher
    +text url UQ
    +text resolved_url
    +timestamptz retrieved_at
    +text response_sha256
    +text verification_note
  }
  class documents {
    +uuid id PK
    +text external_key UQ
    +text origin public_source|internal|demo
    +text title
    +text document_form
    +text document_number
    +date issued_on
    +timestamptz published_at
    +text issuer_organization_code FK
    +text issuer_name
    +text source_id FK
    +text metadata_status
    +jsonb source_observations
    +text data_review_status pending|verified
    +uuid reviewed_by FK
    +text intake_status ★ inbox|filed|discarded|split
    +uuid uploaded_by ★ FK
    +timestamptz discarded_at ★
    +text signer_name ★
    +text recipient_text ★
  }
  class document_classifications {
    +uuid document_id PK FK
    +text work_group_code PK FK
    +text document_type_code FK
    +text classification_status proposed|confirmed
    +text basis
  }
  class document_segments {
    <<mới>>
    +uuid id PK
    +uuid source_document_id FK
    +uuid source_file_id FK
    +int page_from
    +int page_to
    +uuid target_document_id FK
    +text proposed_by ai|user|separator_sheet
    +text status proposed|confirmed|rejected
    +uuid confirmed_by FK
    +timestamptz confirmed_at
  }
  class document_relations {
    <<mới>>
    +uuid from_document_id PK FK
    +uuid to_document_id PK FK
    +text relation PK appendix_of|replaces|amends|responds_to|related
    +text note
    +uuid created_by FK
  }
  class document_field_values {
    +uuid document_id PK FK
    +text field_definition_code PK FK
    +text value_text
    +text value_normalized ★
    +text value_origin manual|ocr|public_metadata|demo
    +numeric confidence
    +uuid source_file_id FK
    +int source_page
    +jsonb source_region
    +bigint ai_field_suggestion_id ★ FK
    +bool needs_review
    +uuid verified_by FK
    +timestamptz verified_at
  }
  class file_signatures {
    <<mới>>
    +uuid id PK
    +uuid file_id FK
    +text signer_name
    +text certificate_serial
    +text certificate_issuer
    +timestamptz signed_at
    +text verification_status valid|invalid|unknown|revoked
    +text verifier_version
    +timestamptz verified_at
    +jsonb details
  }
  sources "1" -- "*" documents
  documents "1" -- "*" document_classifications
  documents "1" -- "*" document_segments : nguồn
  documents "1" -- "0..1" document_segments : đích
  documents "1" -- "*" document_relations
  documents "1" *-- "*" document_field_values
  files "1" -- "*" file_signatures
```

- **Tách văn bản:** PDF 12 trang tiếp nhận thành một văn bản `intake_status = inbox`. Khi xác nhận tách, tạo các văn bản con (đơn 1–2, biên bản 3–5, quyết định 6–8, phụ lục 9–12), mỗi văn bản một dòng `document_segments`; văn bản nguồn chuyển `split`. Phụ lục nối với quyết định bằng `document_relations(appendix_of)`.
- `value_normalized`: ngày ISO, số dạng `80.5`; `value_text` giữ nguyên chuỗi gốc (giữ số 0 đầu trong số ký hiệu).
- Kiểm tra chữ ký chỉ ghi kết quả kỹ thuật, không kết luận hiệu lực pháp lý.

---

## 8. Nhóm F · Xử lý AI

```mermaid
classDiagram
  direction LR
  class ai_models {
    <<mới>>
    +text key PK ocr|layout|orientation|classifier|qwen_vl
    +text repo
    +text revision
    +text purpose
    +jsonb receipt
    +bool active
  }
  class ocr_jobs {
    +uuid id PK
    +uuid file_id FK
    +text provider
    +text model_version
    +text job_type ★ read_classify|reread_page|segment|reclassify
    +jsonb options ★
    +text status queued|running|completed|failed|cancelled ★
    +text stage ★
    +int page_count ★
    +int processed_pages ★
    +smallint priority ★
    +smallint attempt ★
    +uuid requested_by ★ FK
    +text locked_by ★
    +timestamptz heartbeat_at ★
    +jsonb warnings ★
    +timestamptz started_at
    +timestamptz finished_at
    +text error_message
  }
  class ocr_pages {
    <<mới>>
    +uuid job_id PK FK
    +int page_no PK
    +text method pdf_text|ocr|failed
    +text text
    +text native_text
    +jsonb blocks
    +text status completed|empty|failed
    +numeric elapsed_seconds
    +tsvector search_vector
  }
  class ai_suggestions {
    <<mới>>
    +bigint id PK
    +uuid job_id FK
    +uuid document_id FK
    +text work_group_code FK
    +text document_type_code FK
    +text document_form
    +text title
    +text reason
    +text quote
    +bool evidence_verified
    +bool mixed_documents
    +text model_key FK
    +text decision accepted|changed|rejected
    +uuid decided_by FK
    +timestamptz decided_at
  }
  class ai_field_suggestions {
    <<mới>>
    +bigint id PK
    +bigint suggestion_id FK
    +text field_definition_code FK
    +text value
    +text quote
    +int[] source_pages
    +jsonb source_region
    +bool quote_verified
    +numeric confidence
  }
  ocr_jobs "1" *-- "*" ocr_pages
  ocr_jobs "1" -- "0..1" ai_suggestions
  ai_suggestions "1" *-- "*" ai_field_suggestions
  ai_models "1" -- "*" ai_suggestions
```

**Giao kèo giữa API .NET và worker Python** (qua DB):

```sql
-- Worker lấy việc
UPDATE hoso.ocr_jobs SET status='running', locked_by=$1, started_at=now(), heartbeat_at=now(), attempt=attempt+1
WHERE id = (SELECT id FROM hoso.ocr_jobs WHERE status='queued'
            ORDER BY priority, created_at FOR UPDATE SKIP LOCKED LIMIT 1)
RETURNING *;
-- Sau mỗi trang: INSERT ocr_pages; UPDATE processed_pages, heartbeat_at; NOTIFY job_progress, '<job_id>:<page>'
-- Kết thúc: INSERT ai_suggestions + ai_field_suggestions; status='completed'; NOTIFY job_progress, '<job_id>:done'
```

Job `running` có `heartbeat_at` cũ hơn 5 phút được trả về `queued` (tối đa 3 lần, sau đó `failed`). Trang đã đọc giữ nguyên, lần sau chỉ đọc trang còn thiếu.

`ai_field_suggestions.source_region` (và `document_field_values.source_region` khi sao sang) là vùng chứa trích dẫn trên trang,
toạ độ theo **tỉ lệ** kích thước trang (0..1), gốc ở góc trên bên trái, trang đánh số từ 1:
`{"page": 2, "x": 0.12, "y": 0.30, "width": 0.40, "height": 0.03}`. Thêm `"approximate": true` khi engine chỉ ước theo vị trí dòng
(trang lấy chữ từ lớp chữ PDF, chưa có khung chữ). `NULL` khi engine không biết vùng. `confidence` từ 0 đến 1, `NULL` khi engine không ước được.
Từ 18/11/2026 (AI-21) AI thật cũng ghi `source_region`: khối bố cục OCR hoặc ô bảng (đa số `approximate`), khung chữ PDFium cho trang có lớp chữ. `confidence` chỉ AI giả ghi; AI thật để `NULL` vì chưa có nguồn đáng tin.

`ai_suggestions` không bao giờ ghi đè dữ liệu đã đối chiếu: khi người dùng chấp nhận, API sao giá trị sang `document_field_values` (`value_origin = 'ocr'`, `needs_review = true`, `ai_field_suggestion_id`), người dùng xác nhận thì `needs_review = false`. Từ hai bảng này đo được tỉ lệ AI đúng theo từng loại giấy tờ và trường.

---

## 9. Nhóm G · Hồ sơ & quy trình

```mermaid
classDiagram
  direction LR
  class dossiers {
    +uuid id PK
    +text code UQ
    +text origin internal|demo
    +text title
    +int year
    +text organization_code FK
    +text department_code FK
    +text work_group_code FK
    +text procedure_id ★ FK
    +text workflow_code ★ FK
    +text creator_organization_name
    +text holding_department_code ★ FK
    +uuid assignee_id FK
    +text status FK
    +date internal_due_on
    +text access_level internal|restricted|public
    +uuid retention_rule_id ★ FK
    +text retention_rule_reference
    +uuid storage_location_id ★ FK
    +date opened_on ★
    +date closed_on ★
    +text notes
    +uuid created_by FK
    +timestamptz archived_at
  }
  class dossier_documents {
    +uuid dossier_id PK FK
    +uuid document_id PK FK
    +int position
    +text direction incoming|outgoing|internal
    +text relation_kind component|reference
    +uuid procedure_component_id ★ FK
    +uuid added_by ★ FK
    +timestamptz added_at ★
  }
  class dossier_assignments {
    <<mới>>
    +uuid id PK
    +uuid dossier_id FK
    +uuid user_id FK
    +text assignment_role lead|support|reviewer
    +date due_on
    +uuid assigned_by FK
    +timestamptz assigned_at
    +timestamptz ended_at
    +text note
  }
  class dossier_code_sequences {
    <<mới>>
    +text organization_code PK
    +int year PK
    +int last_value
  }
  class workflow_definitions {
    <<mới>>
    +text code PK digitize_closed|in_progress|council
    +text name
    +text description
  }
  class workflow_states {
    +text code PK
    +text label
  }
  class workflow_transitions {
    +text workflow_code ★ PK FK
    +text from_state PK FK
    +text action PK
    +text actor_role PK FK
    +text to_state FK
    +bool requires_verified_documents
    +bool requires_note
  }
  class workflow_events {
    +bigint id PK
    +uuid dossier_id FK
    +uuid actor_id FK
    +text actor_role FK
    +text action
    +text from_state
    +text to_state
    +text note
    +timestamptz happened_at
  }
  dossiers "1" *-- "*" dossier_documents
  dossiers "1" *-- "*" dossier_assignments
  dossiers "1" *-- "*" workflow_events
  workflow_definitions "1" *-- "*" workflow_transitions
  workflow_definitions "1" -- "*" dossiers
  workflow_states "1" -- "*" dossiers
  workflow_states "1" -- "*" workflow_transitions
```

- **Ba quy trình** (luồng A, B, C) cấu hình bằng `workflow_definitions`; 13 luật hiện có gán `workflow_code = 'in_progress'`. Luồng A thay `department_review` bằng bước kiểm tra chất lượng do người được giao trong kế hoạch số hóa thực hiện.
- `dossiers.assignee_id` giữ lại làm người chủ trì hiện tại (cập nhật cùng transaction với `dossier_assignments`) để không phá hàm `scope_matches`.
- **Mã hồ sơ** sinh bằng `UPDATE dossier_code_sequences SET last_value = last_value + 1 … RETURNING`, dạng `UBND-2026-000123`.
- **Đủ thành phần:** view `v_dossier_completeness` kết hợp `document_types.required_in_dossier` (hồ sơ công việc) hoặc `procedure_components.required_as_published` (hồ sơ thủ tục). Hàm `transition_dossier` gọi view này thay cho kiểm tra chung.

---

## 10. Nhóm H · Kho bản giấy (mới)

```mermaid
classDiagram
  direction LR
  class storage_locations {
    <<mới>>
    +uuid id PK
    +uuid parent_id FK
    +text kind warehouse|room|cabinet|shelf|box
    +text code UQ
    +text name
    +text organization_code FK
    +text qr_payload UQ
    +text capacity_note
    +bool active
  }
  class dossier_location_moves {
    <<mới>>
    +bigint id PK
    +uuid dossier_id FK
    +uuid from_location_id FK
    +uuid to_location_id FK
    +uuid moved_by FK
    +timestamptz moved_at
    +text note
  }
  class loans {
    <<mới>>
    +uuid id PK
    +uuid dossier_id FK
    +uuid borrower_id FK
    +text purpose
    +text status requested|approved|lent|returned|rejected|overdue
    +timestamptz requested_at
    +uuid approved_by FK
    +timestamptz approved_at
    +date due_on
    +timestamptz lent_at
    +timestamptz returned_at
    +text condition_note
  }
  storage_locations "1" -- "*" storage_locations : chứa
  storage_locations "1" -- "*" dossier_location_moves
```

`dossiers.storage_location_id` trỏ tới hộp đang chứa hồ sơ; `loans.dossier_id` và `dossier_location_moves.dossier_id` trỏ tới `dossiers` (nhóm G).

- Cây vị trí dùng `parent_id`; truy vấn đường dẫn đầy đủ bằng CTE đệ quy, cache ở API.
- Mỗi lần đổi `dossiers.storage_location_id` ghi một dòng `dossier_location_moves` (trigger).
- Ràng buộc: một hồ sơ chỉ có một khoản mượn ở trạng thái `approved|lent` (partial unique index).

---

## 11. Nhóm I · Nộp lưu, xuất dữ liệu, hủy (mới)

```mermaid
classDiagram
  direction LR
  class archive_submissions {
    <<mới>>
    +uuid id PK
    +text code UQ
    +text organization_code FK
    +text status draft|submitted|received|returned
    +uuid submitted_by FK
    +timestamptz submitted_at
    +uuid received_by FK
    +timestamptz received_at
    +uuid minutes_document_id FK
    +text note
  }
  class archive_submission_items {
    <<mới>>
    +uuid submission_id PK FK
    +uuid dossier_id PK FK
    +int page_count
    +text check_result ok|issue
    +text note
  }
  class export_packages {
    <<mới>>
    +uuid id PK
    +uuid requested_by FK
    +jsonb scope
    +text format zip_pdf_json|zip_pdf_csv
    +text status queued|running|ready|failed|expired
    +text storage_key
    +text manifest_sha256
    +bigint byte_size
    +timestamptz created_at
    +timestamptz ready_at
    +timestamptz expires_at
    +text error_message
  }
  class disposal_requests {
    <<mới>>
    +uuid id PK
    +uuid dossier_id FK
    +uuid retention_rule_id FK
    +text reason
    +text status requested|approved|rejected|executed
    +uuid requested_by FK
    +timestamptz requested_at
    +uuid decided_by FK
    +uuid decision_document_id FK
    +timestamptz decided_at
    +timestamptz executed_at
  }
  archive_submissions "1" *-- "*" archive_submission_items
```

- Nhận nộp lưu một đợt: trong một transaction, gọi `transition_dossier(…, 'archive', …)` cho từng hồ sơ; một hồ sơ lỗi thì cả đợt trả về `submitted` kèm danh sách lỗi.
- Gói xuất gồm PDF, `metadata.json`, `danh-muc.csv`, `manifest.sha256`; mỗi lần xuất ghi `access_events(action='export')`.
- Hủy chỉ thực hiện khi `status = approved` và có `decision_document_id`; hệ thống không tự hủy.

---

## 12. Nhóm J · Hệ thống

```mermaid
classDiagram
  direction LR
  class audit_events {
    +bigint id PK
    +text table_name
    +text operation
    +text database_user
    +text actor_subject
    +jsonb old_row
    +jsonb new_row
    +timestamptz happened_at
  }
  class notifications {
    <<mới>>
    +uuid id PK
    +uuid user_id FK
    +text kind
    +text title
    +text body
    +text link
    +uuid dossier_id FK
    +timestamptz created_at
    +timestamptz read_at
  }
  class outbox_messages {
    <<mới>>
    +bigint id PK
    +text type
    +jsonb payload
    +timestamptz created_at
    +timestamptz processed_at
    +smallint attempts
    +text last_error
  }
  class system_settings {
    <<mới>>
    +text key PK
    +jsonb value
    +uuid updated_by FK
    +timestamptz updated_at
  }
  class backup_runs {
    <<mới>>
    +uuid id PK
    +text kind database|files|config
    +text status running|succeeded|failed
    +timestamptz started_at
    +timestamptz finished_at
    +bigint byte_size
    +text location
    +timestamptz restore_tested_at
    +text note
  }
```

- Trigger `audit_change` mở rộng cho `dossier_documents`, `dossier_assignments`, `document_classifications`, `storage_locations`, `loans`, `user_roles`, `delegations`.
- `audit_events` phân vùng theo tháng khi vượt khoảng 10 triệu dòng.

---

## 13. View và hàm

| Tên | Loại | Mục đích |
|---|---|---|
| `v_public_documents`, `v_dossier_summary`, `v_catalog_composition` | View (đã có) | Giữ nguyên |
| `v_dossier_completeness` | View mới | Mỗi hồ sơ: loại giấy tờ/thành phần bắt buộc, số đã có, số đã đối chiếu, còn thiếu |
| `v_my_queue` | Hàm mới `my_queue(p_user, p_user_role)` | Hàng việc theo phân công: hồ sơ được giao, chờ kiểm tra, chờ ý kiến, chờ nộp lưu, PDF chờ xếp |
| `v_ai_accuracy` | View mới | Theo loại giấy tờ, trường: tỉ lệ gợi ý được chấp nhận nguyên, bị sửa, bị bỏ |
| `scope_matches` | Hàm (sửa) | Thêm ủy quyền, `restricted`, `is_deputy` |
| `transition_dossier` | Hàm (sửa) | Thêm `workflow_code`, kiểm tra qua `v_dossier_completeness`, kiểm tra `row_version`, ghi `outbox_messages` |
| `next_dossier_code(org, year)` | Hàm mới | Sinh mã hồ sơ an toàn khi chạy đồng thời |
| `search_documents(q, filters)` | Hàm mới | Kết hợp `documents_search_idx`, `ocr_pages.search_vector` (unaccent), `pg_trgm` cho số ký hiệu |

## 14. Chỉ mục chính

| Bảng | Chỉ mục | Phục vụ |
|---|---|---|
| `files` | `UNIQUE (sha256) WHERE file_role='scan'` | Chống nạp trùng |
| `documents` | `(intake_status, uploaded_by)`, GIN `to_tsvector('simple', unaccent(title \|\| number))` | Hộp tiếp nhận, tìm kiếm |
| `ocr_jobs` | `(priority, created_at) WHERE status='queued'`; `(status, heartbeat_at) WHERE status='running'` | Lấy việc, thu hồi job treo |
| `ocr_pages` | GIN `search_vector` | Tìm toàn văn |
| `document_field_values` | `(document_id) WHERE needs_review` | Đếm trường chờ đối chiếu |
| `dossiers` | Đã có `dossiers_queue_idx`, `dossiers_assignee_idx`; thêm GIN trigram `title` | Danh sách, tìm hồ sơ |
| `dossier_assignments` | `(user_id) WHERE ended_at IS NULL` | Việc của tôi |
| `notifications` | `(user_id, created_at DESC) WHERE read_at IS NULL` | Chuông thông báo |
| `outbox_messages` | `(id) WHERE processed_at IS NULL` | Dispatcher |
| `loans` | `UNIQUE (dossier_id) WHERE status IN ('approved','lent')` | Một khoản mượn mỗi lúc |

## 15. Thứ tự migration

| File | Nội dung |
|---|---|
| `001`–`007` | Giữ nguyên (baseline), DbUp ghi nhận đã chạy |
| `008_extensions_conventions.sql` | `unaccent`, `pg_trgm`; cột `row_version` (xmin), mở rộng CHECK `file_role`, `ocr_jobs.status` |
| `009_catalog_ext.sql` | `organization_names`, cột mới của danh mục, `retention_rules` |
| `010_identity_ext.sql` | Cột mới `users`, `user_roles.is_deputy`, `delegations`, `document_access_grants`, `access_events` (phân vùng), quyền mới |
| `011_procedures.sql` | Nhóm C |
| `012_intake.sql` | `scan_batches`, cột mới `files`/`documents`, `page_images`, `quality_issues`, chỉ mục chống trùng |
| `013_processing.sql` | `ai_models`, cột mới `ocr_jobs`, `ocr_pages`, `ai_suggestions`, `ai_field_suggestions` |
| `014_documents_ext.sql` | `document_segments`, `document_relations`, `file_signatures`, cột mới `document_field_values` |
| `015_dossiers_ext.sql` | `workflow_definitions`, cột `workflow_code`, `dossier_assignments`, `dossier_code_sequences`, cột mới `dossiers`, `dossier_documents` |
| `016_physical_storage.sql` | Nhóm H |
| `017_archive_export.sql` | Nhóm I |
| `018_system.sql` | `notifications`, `outbox_messages`, `system_settings`, `backup_runs`, trigger audit mở rộng |
| `019_views_functions.sql` | View và hàm ở mục 13; thay `scope_matches`, `transition_dossier` |
| `020_db_roles.sql` | Role `hoso_migrator`, `hoso_api`, `hoso_ai_worker`, `hoso_readonly` với GRANT tối thiểu |

Mỗi migration kèm kiểm thử trong `database/scripts/test_database.py` (giữ cách chạy trong transaction rồi ROLLBACK) và kiểm thử tích hợp .NET bằng Testcontainers.
