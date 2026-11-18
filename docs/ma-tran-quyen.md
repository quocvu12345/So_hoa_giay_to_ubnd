# Ma trận quyền của API (QA-01)

> **Tệp này do test sinh ra từ mã** (`PermissionMatrixTests`), không sửa tay. Đổi quyền của endpoint hay của vai trò thì test đỏ cho tới khi cập nhật:
> `HOSO_WRITE_PERMISSION_MATRIX=1 dotnet test --project tests/HoSoSo.Api.IntegrationTests -- --filter-class "*PermissionMatrixTests"` (chạy từ thư mục `backend/`).

Đây là ma trận **quyền**: vai trò có được gọi endpoint hay không. Việc từ chối thật được kiểm ở `PermissionEnforcementTests` (gọi từng endpoint bằng từng vai trò không có quyền, mong 403; chưa đăng nhập mong 401). Việc chỉ thấy hồ sơ, giấy tờ trong **phạm vi phân công** do `IScopeFilter` lọc ở mọi truy vấn, được kiểm riêng ở `ScopeTests`, `AssignmentScopeTests`, `ScopePrefilterTests`; ma trận này không thay cho các test đó.

**144 endpoint**: 119 cần quyền riêng, 20 chỉ cần đăng nhập (phạm vi do use case kiểm tra), 2 dùng khóa máy (script sao lưu), 3 ẩn danh (chỉ dưới `/auth`).

Ký hiệu: ✓ vai trò có quyền cần thiết (một trong các quyền nếu liệt kê nhiều) · — không có. Endpoint "đăng nhập" mọi vai trò đều gọi được.

## admin

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/admin/ai/jobs` | `processing.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/ai/jobs/{id:guid}/cancel` | `processing.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/ai/jobs/{id:guid}/retry` | `processing.manage` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/ai/status` | `processing.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/assignments` | `admin.users` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/assignments/{id:guid}/end` | `admin.users` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/audit` | `admin.settings` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/backups` | `admin.settings` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/backups` | `admin.settings` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/backups/status` | `admin.settings` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/backups/{id:guid}/restore-test` | `admin.settings` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/catalog/document-types` | `catalog.manage` | — | — | — | — | — | ✓ |
| DELETE | `/api/v1/admin/catalog/document-types/{code}` | `catalog.manage` | — | — | — | — | — | ✓ |
| PATCH | `/api/v1/admin/catalog/document-types/{code}` | `catalog.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/catalog/field-definitions` | `catalog.manage` | — | — | — | — | — | ✓ |
| DELETE | `/api/v1/admin/catalog/field-definitions/{code}` | `catalog.manage` | — | — | — | — | — | ✓ |
| PATCH | `/api/v1/admin/catalog/field-definitions/{code}` | `catalog.manage` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/catalog/retention-rules` | `catalog.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/catalog/retention-rules` | `catalog.manage` | — | — | — | — | — | ✓ |
| DELETE | `/api/v1/admin/catalog/retention-rules/{id:guid}` | `catalog.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/catalog/retention-rules/{id:guid}/confirm` | `catalog.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/catalog/work-groups` | `catalog.manage` | — | — | — | — | — | ✓ |
| DELETE | `/api/v1/admin/catalog/work-groups/{code}` | `catalog.manage` | — | — | — | — | — | ✓ |
| PATCH | `/api/v1/admin/catalog/work-groups/{code}` | `catalog.manage` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/delegations` | `admin.users` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/delegations/{id:guid}/revoke` | `admin.users` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/errors` | `admin.settings` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/roles` | `admin.users` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/settings` | `admin.settings` | — | — | — | — | — | ✓ |
| PATCH | `/api/v1/admin/settings` | `admin.settings` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/users` | `admin.users` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/users` | `admin.users` | — | — | — | — | — | ✓ |
| GET | `/api/v1/admin/users/{id:guid}` | `admin.users` | — | — | — | — | — | ✓ |
| PATCH | `/api/v1/admin/users/{id:guid}` | `admin.users` | — | — | — | — | — | ✓ |
| POST | `/api/v1/admin/users/{id:guid}/revoke-sessions` | `admin.users` | — | — | — | — | — | ✓ |

## archive-submissions

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/archive-submissions/` | `dossier.archive` | — | — | ✓ | — | — | — |
| POST | `/api/v1/archive-submissions/` | `dossier.archive` | — | — | ✓ | — | — | — |
| DELETE | `/api/v1/archive-submissions/{id:guid}` | `dossier.archive` | — | — | ✓ | — | — | — |
| GET | `/api/v1/archive-submissions/{id:guid}` | `dossier.archive` | — | — | ✓ | — | — | — |
| GET | `/api/v1/archive-submissions/{id:guid}/minutes` | `dossier.archive` | — | — | ✓ | — | — | — |
| POST | `/api/v1/archive-submissions/{id:guid}/receive` | `dossier.archive` | — | — | ✓ | — | — | — |
| POST | `/api/v1/archive-submissions/{id:guid}/return` | `dossier.archive` | — | — | ✓ | — | — | — |
| POST | `/api/v1/archive-submissions/{id:guid}/submit` | `dossier.archive` | — | — | ✓ | — | — | — |

## auth

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/auth/dev-login` | (ẩn danh) | n/a | n/a | n/a | n/a | n/a | n/a |
| GET | `/api/v1/auth/login` | (ẩn danh) | n/a | n/a | n/a | n/a | n/a | n/a |
| POST | `/api/v1/auth/logout` | (ẩn danh) | n/a | n/a | n/a | n/a | n/a | n/a |

## catalog

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/catalog/departments` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/catalog/organizations` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/catalog/work-groups` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/catalog/work-groups/{code}/document-types` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## disposals

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/disposals/` | `disposal.request` hoặc `disposal.approve` | — | — | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/disposals/` | `disposal.request` | — | — | ✓ | — | — | — |
| GET | `/api/v1/disposals/eligible` | `disposal.request` hoặc `disposal.approve` | — | — | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/disposals/{id:guid}` | `disposal.request` hoặc `disposal.approve` | — | — | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/disposals/{id:guid}/approve` | `disposal.approve` | — | — | — | ✓ | ✓ | — |
| POST | `/api/v1/disposals/{id:guid}/execute` | `disposal.request` | — | — | ✓ | — | — | — |
| POST | `/api/v1/disposals/{id:guid}/reject` | `disposal.approve` | — | — | — | ✓ | ✓ | — |

## documents

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/documents/{id:guid}` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/documents/{id:guid}/ai/extract` | `intake.upload` hoặc `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| PUT | `/api/v1/documents/{id:guid}/classification` | `document.edit` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/documents/{id:guid}/fields` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| PATCH | `/api/v1/documents/{id:guid}/fields` | `document.edit` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/documents/{id:guid}/files` | `document.edit` | ✓ | — | ✓ | — | — | — |
| PUT | `/api/v1/documents/{id:guid}/metadata` | `document.edit` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/documents/{id:guid}/relations` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/documents/{id:guid}/relations` | `document.edit` | ✓ | — | ✓ | — | — | — |
| DELETE | `/api/v1/documents/{id:guid}/relations/{toId:guid}/{relation}` | `document.edit` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/documents/{id:guid}/review` | `document.edit` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/documents/{id:guid}/segments` | `document.edit` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/documents/{id:guid}/segments` | `document.edit` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/documents/{id:guid}/verify` | `document.edit` | ✓ | — | ✓ | — | — | — |

## dossiers

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/dossiers/` | `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/dossiers/` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/dossiers/export.csv` | `export.create` | — | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/dossiers/suggestions` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/dossiers/{id:guid}` | `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| PATCH | `/api/v1/dossiers/{id:guid}` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/dossiers/{id:guid}/actions` | `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/dossiers/{id:guid}/ai/extract` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/dossiers/{id:guid}/assignees` | `dossier.assign` | — | ✓ | — | — | — | — |
| PUT | `/api/v1/dossiers/{id:guid}/assignment` | `dossier.assign` | — | ✓ | — | — | — | — |
| GET | `/api/v1/dossiers/{id:guid}/checklist` | `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| PATCH | `/api/v1/dossiers/{id:guid}/documents` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/dossiers/{id:guid}/documents` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| DELETE | `/api/v1/dossiers/{id:guid}/documents/{documentId:guid}` | `dossier.prepare` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/dossiers/{id:guid}/history` | `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| PUT | `/api/v1/dossiers/{id:guid}/location` | `storage.manage` | — | — | ✓ | — | — | — |
| POST | `/api/v1/dossiers/{id:guid}/transitions` | `dossier.read` | ✓ | ✓ | ✓ | ✓ | ✓ | — |

## events

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/events` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## exports

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/exports/` | `export.create` | — | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/exports/` | `export.create` | — | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/exports/{id:guid}` | `export.create` | — | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/exports/{id:guid}/file` | `export.create` | — | ✓ | ✓ | ✓ | ✓ | — |

## files

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| PUT | `/api/v1/files/{fileId:guid}/pages/{page:int}/quality` | `intake.qc` | — | — | ✓ | — | — | — |
| GET | `/api/v1/files/{id:guid}/content` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/files/{id:guid}/download` | `document.download` hoặc `document.print` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/files/{id:guid}/pages/{page:int}/preview` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| GET | `/api/v1/files/{id:guid}/signatures` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |
| POST | `/api/v1/files/{id:guid}/signatures/verify` | `document.edit` | ✓ | — | ✓ | — | — | — |

## form-templates

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/form-templates/{id:guid}/file` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## intake

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/intake/batches` | `intake.manage` hoặc `intake.upload` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/intake/batches` | `intake.manage` | — | — | ✓ | — | — | — |
| GET | `/api/v1/intake/batches/{id:guid}` | `intake.manage` hoặc `intake.upload` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/intake/batches/{id:guid}/close` | `intake.manage` | — | — | ✓ | — | — | — |
| POST | `/api/v1/intake/documents/{id:guid}/discard` | `intake.upload` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/intake/documents/{id:guid}/restore` | `intake.upload` | ✓ | — | ✓ | — | — | — |
| POST | `/api/v1/intake/files` | `intake.upload` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/intake/inbox` | `intake.upload` | ✓ | — | ✓ | — | — | — |
| GET | `/api/v1/intake/inbox/summary` | `intake.upload` | ✓ | — | ✓ | — | — | — |

## jobs

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/jobs/{id:guid}` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST | `/api/v1/jobs/{id:guid}/cancel` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST | `/api/v1/jobs/{id:guid}/pages/{page:int}/retry` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## loans

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/loans/` | `loan.request` hoặc `loan.approve` | ✓ | ✓ | ✓ | — | — | — |
| POST | `/api/v1/loans/` | `loan.request` | ✓ | ✓ | ✓ | — | — | — |
| POST | `/api/v1/loans/{id:guid}/approve` | `loan.approve` | — | — | ✓ | — | — | — |
| POST | `/api/v1/loans/{id:guid}/lend` | `loan.approve` | — | — | ✓ | — | — | — |
| POST | `/api/v1/loans/{id:guid}/reject` | `loan.approve` | — | — | ✓ | — | — | — |
| POST | `/api/v1/loans/{id:guid}/return` | `loan.approve` | — | — | ✓ | — | — | — |

## me

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/me` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/me/logins` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## notifications

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/notifications/` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST | `/api/v1/notifications/read-all` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| POST | `/api/v1/notifications/{id:guid}/read` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## ops

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| POST | `/api/v1/ops/backups` | (khóa máy) | n/a | n/a | n/a | n/a | n/a | n/a |
| PATCH | `/api/v1/ops/backups/{id:guid}` | (khóa máy) | n/a | n/a | n/a | n/a | n/a | n/a |

## procedures

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/procedures/` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/procedures/domains` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/procedures/levels` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/procedures/{id}` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |

## quality-issues

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/quality-issues/` | `intake.qc` | — | — | ✓ | — | — | — |
| POST | `/api/v1/quality-issues/` | `intake.qc` | — | — | ✓ | — | — | — |
| POST | `/api/v1/quality-issues/{id:guid}/resolve` | `intake.qc` | — | — | ✓ | — | — | — |

## search

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/search` | `document.view` | ✓ | ✓ | ✓ | ✓ | ✓ | — |

## segments

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| POST | `/api/v1/segments/{id:guid}/confirm` | `document.edit` | ✓ | — | ✓ | — | — | — |

## storage-locations

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/storage-locations/` | `storage.manage` | — | — | ✓ | — | — | — |
| POST | `/api/v1/storage-locations/` | `storage.manage` | — | — | ✓ | — | — | — |
| GET | `/api/v1/storage-locations/by-qr` | `storage.manage` | — | — | ✓ | — | — | — |
| GET | `/api/v1/storage-locations/labels` | `storage.manage` | — | — | ✓ | — | — | — |
| GET | `/api/v1/storage-locations/{id:guid}` | `storage.manage` | — | — | ✓ | — | — | — |
| PATCH | `/api/v1/storage-locations/{id:guid}` | `storage.manage` | — | — | ✓ | — | — | — |
| GET | `/api/v1/storage-locations/{id:guid}/qr` | `storage.manage` | — | — | ✓ | — | — | — |

## workspace

| Phương thức | Đường dẫn | Quyền cần | Chuyên viên | Trưởng phòng/Ban | Văn thư | Chủ tịch UBND | Lãnh đạo HĐND | Quản trị kỹ thuật |
|---|---|---|:-:|:-:|:-:|:-:|:-:|:-:|
| GET | `/api/v1/workspace/leadership` | `dossier.decide` | — | — | — | ✓ | ✓ | — |
| GET | `/api/v1/workspace/queue` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
| GET | `/api/v1/workspace/summary` | (đăng nhập) | ✓ | ✓ | ✓ | ✓ | ✓ | ✓ |
