# Task chi tiết · Backend .NET

Mã task giữ nguyên như `docs/04-ke-hoach-task.md`. Đường dẫn tệp tính từ `backend/`. Task cơ sở dữ liệu (`DB-*`) và worker AI (`AI-*`) xem ở tài liệu 04; task bảo mật (`SEC-*`) ở `05-bao-mat.md`; task log (`LOG-*`) ở `06-log-va-giam-sat.md`.

**Trạng thái:** ✅ xong · 🟡 đã có khung, cần làm tiếp · ⬜ chưa làm

## Kết quả kiểm chứng

Đã build và chạy thật với SDK 11.0.100 nhắm `net10.0`, trên PostgreSQL 16.13 (Homebrew). **288 test qua** (7 domain, 18 application, 263 tích hợp; 15 test kho S3 cần một máy chủ tương thích S3 cục bộ và được báo "bỏ qua" khi không có, xem `backend/README.md`); build với `CI=true` (cảnh báo là lỗi) sạch. Chạy lần cuối: có emulator S3 thì cả 288 qua; không có thì 273 qua và 15 test S3 báo bỏ qua; trước đó bộ 125 test đã chạy 3 lần liên tiếp đều qua (máy lúc đó còn chạy đánh giá AI nền nên có tải vừa). Lần chạy lặp đã lộ một race trong chính test: gọi `ProcessBatchAsync` thủ công trong khi vòng nền của outbox đang giữ khóa lô thì thấy rỗng và đọc thông báo quá sớm; đã thay bằng `DbApiFactory.DrainOutboxAsync()` (chờ tới khi không còn việc đến hạn). Chưa thử máy tải nặng. Kiểm thêm bằng máy chủ Kestrel thật và curl: đăng nhập, CSRF, tạo hồ sơ, tải PDF, 413.

**Chưa kiểm chứng:** đăng nhập với **Keycloak thật** (đã chạy luồng code + PKCE qua một nhà cung cấp OIDC giả theo đúng giao thức, không thay Keycloak); kho tệp trên **MinIO/AWS S3 thật** (đã chạy 15 test trên emulator `moto`, gồm cả gói xuất); máy chủ chạy với runtime .NET 10 thật (máy dev chỉ có runtime 11, chạy bằng `DOTNET_ROLL_FORWARD=Major`); gói xuất 1 GB; PDFium với PDF lớn hoặc cố ý hỏng; tải trọng nhiều người dùng; máy tải nặng.

**Phát hiện khi chạy lần đầu (đã sửa):**
- `xmin` không tồn tại trên biến dòng PL/pgSQL (`SELECT *`) nên so phiên bản trong `transition_dossier` luôn lệch. Sửa bằng truy vấn riêng sau khi khóa dòng; có test phiên bản đúng và sai.
- Quy ước snake_case của EF cũng áp cho kiểu tạm trong `SqlQuery`: cột phải đặt tên `dossier_id`, không phải `"DossierId"`.
- `Program.cs` gán và đóng `Log.Logger` tĩnh nên khi nhiều host chạy song song (kiểm thử) host này đóng logger của host kia → "entry point exited without ever building an IHost". Đã dùng logger riêng và `preserveStaticLogger: true`.
- Minimal API bọc lỗi "body quá lớn" thành 400; đã ánh xạ về 413 `payload_too_large`.
- Worker Python truy vấn cột `active`, `is_key_field` không có trong schema → sửa ở `ai-worker/.../postgres.py`; bổ sung mô hình `fake` trong `ai_models` để chế độ giả lập không vi phạm khóa ngoại.
- Danh mục: cả **2.624/2.624 trường đều kiểu `text`**, kể cả "Ngày ban hành". **Đã sửa (DB-09, migration 028):** 399 trường nhãn bắt đầu bằng "Ngày" nay là `date`, mã không còn đoán theo nhãn. Chưa gán `number`: các trường "Số ..." là số hiệu dạng chữ ("12/2025"). Bộ chuẩn hóa chấp nhận ngày kèm giờ ("20/01/2026 14:30") và chỉ lấy phần ngày.
- Chưa có trường nào `required_for_review` trong danh mục, nên "đã đối chiếu" hiện nghĩa là mọi trường đã có dòng dữ liệu đều được xác nhận.
- Quy tắc hồ sơ `restricted` theo đúng thiết kế: cả người chủ trì cũng cần được cấp quyền riêng. Cần cơ quan xác nhận có đúng ý không.
- Kestrel trả 413 khi tải lên vượt giới hạn nhưng thông điệp là mặc định (không có tiếng Việt); frontend nên tự hiển thị theo mã 413.
- **Log lộ dữ liệu ở mức chi tiết (SEC-07):** (1) log mặc định của ASP.NET "Request starting/finished" in cả chuỗi truy vấn (từ khóa tra cứu); (2) lỗi 5xx từ PostgreSQL ghi nguyên `DETAIL` (ví dụ `Key (email)=(...)`). Test `LogPrivacyTests` bắt được cả hai; nay hạ cố định log đó xuống Warning trong mã (cấu hình không hạ thấp lại được) và chỉ ghi bản lược của ngoại lệ (loại lỗi, SQLSTATE, tên bảng, ràng buộc, dấu vết gọi hàm).
- **Quy trình sao lưu CSDL ban đầu không khôi phục được (OPS-04):** `pg_dump -n public` bỏ qua đối tượng của extension (`unaccent`, `pg_trgm`, `btree_gist`) và có mục `CREATE SCHEMA public`, nên `pg_restore` thẳng vào CSDL mới hỏng. Lần diễn tập khôi phục đầu tiên lộ ra; quy trình đúng ở `ops/backup/README.md` và đã kiểm lại trên các bản sao lưu `hoso_dev` đã tạo (số dòng khớp).
- **Log HTTP chưa từng được ghi:** `UseSerilogRequestLogging` mặc định ghi qua logger tĩnh `Log`, mà host dùng `preserveStaticLogger: true` nên logger đó im lặng; dòng `http_request` không bao giờ ra. Test mới `LoggingTests` bắt được; đã gắn logger của host (BE-03).
- **Chế độ OIDC trả 302 thay vì 401:** `DefaultChallengeScheme` là OpenIdConnect nên gọi API khi chưa đăng nhập bị chuyển hướng sang máy chủ danh tính; frontend sẽ nhận HTML thay vì lỗi 401. Test `OidcLoginTests` bắt được; thách thức mặc định nay là cookie (401), chỉ `/auth/login` thách thức OIDC (BE-12).
- **Khóa tài khoản trước đây không thu hồi phiên:** cookie tự chứa vé nên người bị khóa chỉ bị chặn gián tiếp (không còn phân công, API trả 403) và **được mở khóa là phiên cũ sống lại**. Nay phiên nằm trong CSDL: khóa là thu hồi ngay (401), mở khóa không làm sống lại, phải đăng nhập lại (BE-12). Test `AdminSafetyTests` đã đổi theo hành vi mới.
- Tra cứu cũ cắt 300 khớp tốt nhất **trước** khi lọc phạm vi: một từ phổ biến khớp hàng trăm giấy tờ ngoài phạm vi có thể đẩy giấy tờ trong phạm vi ra khỏi danh sách. Nay lọc phạm vi trong cùng truy vấn, trước khi cắt và đếm (BE-80).

**CSDL dev của bạn (`hoso_dev` trên PostgreSQL 5432):** đã nâng cấp lên schema mới (sao lưu trước ở `data/db-backups/`, đánh dấu baseline `000–003, 007` rồi chạy 008–031; **không** nạp dữ liệu mẫu `004`). Nâng cấp tiếp bằng `backend/scripts/migrate-hoso-dev.sh` (mặc định chỉ liệt kê, `--apply` mới chạy, bỏ qua mọi `*_optional`), vì `migrate` trần ở Development tự chạy cả `*_optional.sql`. Dữ liệu cũ (3 hồ sơ TEST-CITIZEN, 31 giấy tờ, 38 tệp) còn nguyên. Ngày 16/11/2026 đã nạp thêm 850 bộ Từ Liêm: tổng 853 hồ sơ, 4.441 giấy tờ, 4.448 tệp; chưa chạy OCR. Chi tiết cách nạp, nhãn giả lập, 64 bộ lịch sử và kiểm chứng ở [backend/README.md](../../backend/README.md). Có tài khoản quản trị dev `dev_admin` (migration `021_dev_admin_optional.sql`, 18 phân công): mặc định `technical_admin`, đổi bằng bộ chọn phân công sang Chủ tịch, Lãnh đạo HĐND, văn thư, trưởng phòng từng đơn vị, chuyên viên Hạ tầng. Theo thiết kế `technical_admin` **không đọc nội dung hồ sơ** nên muốn xem hồ sơ thì đổi phân công.

**Cách chạy test:** xem [backend/README.md](../../backend/README.md) mục "Chạy test".

## Việc liên quan ngoài danh sách BE (đã làm cùng đợt)

| Mã | Kết quả |
|---|---|
| **SEC-05** | Giới hạn số trang: PDF vượt `Limits:MaxPdfPages` (500) bị từ chối ngay khi tải lên (422 `pdf_too_large`) và số trang được ghi sẵn; PDF đọc không được vẫn nhận như trước, riêng PDF làm trình đọc chạy quá 10 giây thì bị từ chối (422 `pdf_unreadable`). Quét ClamAV qua giao thức `clamd` (`Antivirus:*`, **tắt mặc định**): bị chặn thì 422 `file_infected` và không lưu gì; máy quét lỗi hoặc hết giờ thì mặc định từ chối (503 `scanner_unavailable`), `FailOpen=true` thì nhận và ghi cảnh báo. Test `UploadSecurityTests` (13) chạy với một máy chủ `clamd` giả nói đúng giao thức INSTREAM; **chưa thử với ClamAV thật**. Timeout của worker AI đã có sẵn (`HOSO_AI_PAGE_TIMEOUT_SECONDS`). |
| **SEC-07** | `LogPrivacyTests`: chạy một loạt thao tác có "chuỗi mồi" (tên hồ sơ, tên tệp có số định danh, từ khóa tìm, ghi chú, email, văn bản OCR, giá trị cài đặt) ở mức log Debug kể cả câu lệnh SQL của EF, rồi quét toàn bộ log. Đã lộ và sửa 2 chỗ (xem "Phát hiện"). |
| **DB-09** | Migration 028 gán kiểu `date` cho 399 trường ngày của danh mục (xem "Phát hiện"). Test `CatalogFieldTypeTests`, `DateNormalizationTests`. |
| **AI-09** | `ai-worker/deploy/`: `run-worker.sh`, LaunchAgent (`launchd/install.sh`) và unit systemd có hạn chế quyền. Đã kiểm cú pháp, `plutil -lint`, `run-worker.sh status`, mã thoát 78; **chưa cài thật** bằng `launchctl`/`systemctl`. |
| **OPS-03/04** | `ops/backup/`: sao lưu CSDL, kho tệp, cấu hình; diễn tập khôi phục có biên bản; báo về API (BE-89). Đã chạy thật với API và CSDL tạm, kể cả các đường lỗi (xem `ops/backup/README.md`). Chưa có sao lưu WAL. |

## Quy ước chung cho mọi task

- Mỗi use case là một lớp trong `src/HoSoSo.Application/<Module>/`, gồm:
  - `XxxQuery`/`XxxCommand` (record),
  - `XxxHandler` nhận `HoSoDbContext` qua interface `IHoSoDb`,
  - `ICurrentUser`, `IClock`.
- Endpoint trong `src/HoSoSo.Api/Endpoints/<Module>Endpoints.cs` chỉ làm 3 việc:
  - đọc tham số;
  - gọi handler;
  - trả `TypedResults`.
- Thay `Planned.Task("BE-xx")` bằng handler thật; giữ nguyên đường dẫn, quyền và `WithSummary`.
- Lỗi nghiệp vụ ném `AppException` với mã trong `ErrorCodes`; không tự viết ProblemDetails trong endpoint.
- Mỗi endpoint có test tích hợp, gồm ít nhất một ca trong phạm vi và một ca ngoài phạm vi.
- Truy vấn danh sách luôn qua `IScopeFilter` (BE-15). Không trả entity EF trực tiếp; luôn trả DTO.

---

## P2 · Nền tảng

### BE-01 · Tạo solution ✅ · 0,5 ngày
- **Kết quả:** Build và test chạy được; thêm `.editorconfig`. `global.json` dùng `rollForward: latestMajor` và runner Microsoft.Testing.Platform.
- **Đã có:** `HoSoSo.slnx`, `global.json`, `Directory.Build.props`, `Directory.Packages.props`, 7 tệp `.csproj`.
- **Làm:**
  1. Cài .NET SDK 10.0.x.
  2. Chạy `dotnet restore` rồi `dotnet build HoSoSo.slnx`; sửa lỗi biên dịch nếu có.
  3. Thêm `.editorconfig` (C# 13, `var` khi rõ kiểu, namespace dạng file).
- **Kiểm tra:** `dotnet build` không lỗi; `dotnet test` chạy 3 project test.

### BE-02 · Cấu hình có kiểm tra ✅ · 0,5 ngày
- **Kết quả:** Tùy chọn Auth, Limits, ErrorTracking, Storage được kiểm lúc khởi động (`ValidateOnStart`): OIDC thiếu `Authority`, giới hạn hoặc DSN sai, thiếu chuỗi kết nối đều dừng với thông báo tiếng Việt chỉ đúng khóa cấu hình. Test: `HardeningTests`.
- **Đã có:** `appsettings.json`, `appsettings.Development.json`; `StorageOptions` dùng `ValidateOnStart`.
- **Làm:**
  1. Tạo `AuthOptions`, `LimitsOptions`, `ErrorTrackingOptions` với DataAnnotations.
  2. Gọi `.ValidateDataAnnotations().ValidateOnStart()`.
  3. Khi `Auth:Mode=Oidc`, `Authority` và `ClientId` bắt buộc.
  4. Bí mật đọc từ biến môi trường `HoSo__Auth__ClientSecret` hoặc user-secrets khi dev.
- **Kiểm tra:** thiếu `ConnectionStrings:HoSo` thì dừng với thông báo tiếng Việt và exit code khác 0.

### BE-03 · Log và trace ✅ · 1 ngày
- **Kết quả:** Middleware `RequestLogContextMiddleware` (sau xác thực và chọn phân công) đẩy `userSubject`, `assignment` vào `LogContext` nên mọi dòng log của request mang chúng (chỉ mã định danh). Dòng `http_request` có `method`, `path` (không chuỗi truy vấn), `status`, `elapsedMs`, `correlationId`, `userSubject`; request vượt `Observability:SlowRequestMs` (2000 ms) ghi thêm `slow_request` mức Warning (trừ luồng SSE `/events`). Sửa lỗi dòng `http_request` chưa từng được ghi (xem "Phát hiện"). Test: `LoggingTests` (3).
- **Đã có:** (bản đầu) Serilog JSON, `CorrelationIdMiddleware`, log HTTP một dòng, OpenTelemetry, GlitchTip khi có DSN.
- **Làm:**
  1. Thêm `userSubject` và `assignment` vào `LogContext` sau bước xác thực (middleware nhỏ sau `UseAuthentication`).
  2. Ghi `slow_request` mức Warning khi request vượt 2 giây.
  3. Kiểm tra log không chứa query string.
- **Kiểm tra:** một request tạo đúng một dòng `http_request` có `correlationId`, `userSubject`, `elapsedMs`.

### BE-04 · Chạy migration ✅ · 1 ngày
- **Kết quả:** `migrate`, `migrate --dry-run`, bỏ qua `*_optional.sql` ở Production hoặc theo `Database:OptionalSeeds`; script lỗi hoàn tác và không ghi nhật ký. Test: `MigrationTests`.
- **Đã có:** `Infrastructure/Migrations/DatabaseMigrator.cs`; lệnh `dotnet run -- migrate`; tệp `.sql` được chép vào bản build.
- **Làm:**
  1. Phối hợp DB-01 để có tệp `001…007` trong `database/migrations`.
  2. Thêm lệnh `migrate --dry-run` chỉ liệt kê script sẽ chạy.
  3. Bỏ qua tệp `*_optional.sql` khi môi trường là production.
- **Kiểm tra:** chạy hai lần liên tiếp, lần hai báo 0 script; script lỗi thì dừng và không ghi journal.

### BE-05 · Mapping nhóm A, B ✅ · 1,5 ngày
- **Kết quả:** Entity nhóm A, B trong `Domain/Entities`, ánh xạ ở `ModelMapping`. Test đọc 38/427/2.624. Giá trị liệt kê dùng chuỗi hằng, chưa dùng `ValueConverter`.
- **Đã có:** `HoSoDbContext`, `Organization` và cấu hình bảng.
- **Làm:**
  1. Thêm entity cho `departments`, `department_scopes`, `work_groups`, `document_types`, `field_definitions`, `retention_rules`, `users`, `roles`, `permissions`, `role_permissions`, `user_roles`, `delegations`, `document_access_grants`.
  2. Khóa ghép khai báo bằng `HasKey(x => new { … })`.
  3. Dùng `ValueConverter` cho giá trị liệt kê (`verification_status`…).
- **Kiểm tra:** test đọc 38 nhóm, 427 loại giấy tờ trên DB đã seed bằng Testcontainers.

### BE-06 · Mapping nhóm C, D, E, F ✅ · 2 ngày
- **Kết quả:** mọi bảng trong schema `hoso` do migration tạo đều có entity (62/62). 12 bảng cuối được thêm ở `Domain/Entities/Reference.cs`: `roles`, `permissions`, `sources`, `workflow_definitions`, `organization_names`, `paper_types`, `procedure_departments`, `form_template_fields`, `dossier_code_sequences`, `document_access_grants`, `access_events`, `audit_events` (cột jsonb ánh xạ chuỗi, `inet` ánh xạ `IPAddress`). Ngoại lệ có chủ ý: `schema_migrations` (chỉ có ở CSDL cài từ baseline `install.sql` cũ như `hoso_dev`; lịch sử migration nay ở `public.hoso_schema_versions`). Test `EntityMappingTests`: quét mọi bảng (thêm bảng mà quên entity thì đỏ), ghi rồi đọc lại từng bảng mới, ràng buộc CSDL từ chối dữ liệu sai, và trigger `field_definition_guard` chặn giá trị trường sai loại giấy tờ (SQLSTATE `P0001`).
- **Làm:**
  1. Entity cho thủ tục, lô quét, tệp, văn bản, phân loại, trường, tách văn bản, liên kết, chữ ký, job, trang OCR, gợi ý AI.
  2. Cột `jsonb` ánh xạ sang `JsonDocument` hoặc record với `.HasColumnType("jsonb")`.
  3. Mảng `text[]`, `int[]` ánh xạ sang `string[]`, `int[]`.
- **Kiểm tra:** ghi và đọc lại mỗi entity một lần; trigger `field_definition_guard` chặn trường sai loại giấy tờ.

### BE-07 · Mapping nhóm G, H, I, J và khóa lạc quan ✅ · 1,5 ngày
- **Kết quả:** Khóa lạc quan `xmin` cho `dossiers`, `documents`, `document_field_values` (có test 409). Mọi entity nhóm G–J đã có (xem BE-06). Bảng chỉ thêm (`workflow_events`, `audit_events`, `access_events`) đánh dấu `IAppendOnly`: `HoSoDbContext` từ chối lưu thay đổi sửa/xóa trước khi gửi đi, và trigger trong CSDL chặn nếu ai đó dùng SQL (test kiểm cả hai tầng).
- **Làm:**
  1. Entity còn lại.
  2. Cột `xmin` làm `row_version` cho `dossiers`, `documents`, `document_field_values` (`.IsRowVersion()` với Npgsql).
  3. `workflow_events`, `audit_events`, `access_events` chỉ có thêm, không có cập nhật.
- **Kiểm tra:** hai context sửa cùng hồ sơ thì context thứ hai nhận `DbUpdateConcurrencyException`, API trả 409 `concurrency_conflict`.

### BE-08 · Ghi người thao tác vào phiên DB ✅ · 0,5 ngày
- **Kết quả:** `audit_events.actor_subject` đúng người dùng (test). Chưa đo thời gian mở kết nối.
- **Đã có:** `ActorContextInterceptor` đặt `hoso.actor_subject`, `hoso.correlation_id` khi mở kết nối.
- **Làm:**
  1. Đo thêm thời gian mỗi lần mở kết nối.
  2. Nếu đáng kể, chuyển sang `SET LOCAL` trong `TransactionStarted`.
- **Kiểm tra:** sửa hồ sơ qua API thì `audit_events.actor_subject` đúng người dùng (kết hợp LOG-05).

### BE-09 · Xử lý lỗi thống nhất ✅ · 1 ngày
- **Kết quả:** Ánh xạ `HS001…HS006` và unique/foreign key/check/not-null/raise; `ErrorMappingTests` chạy 12 mã SQLSTATE qua `GlobalExceptionHandler` thật (đường dẫn chỉ có trong kiểm thử đặt cuối pipeline) và kiểm đúng mã HTTP, mã nghiệp vụ, có `errorId`/`correlationId`, và thông điệp gốc của CSDL không lộ ra người dùng; thêm test hàm SQL `transition_dossier`/`assign_dossier` ném `HS006` khi không thấy hồ sơ. Các mã đặc thù theo tên ràng buộc (`loan_conflict`, `disposal_conflict`, `duplicate_file`) có test ở các lớp nghiệp vụ.
- **Đã có:** `GlobalExceptionHandler`: `errorId`, `correlationId`, chuyển 4 thông điệp `RAISE EXCEPTION` của `transition_dossier` thành mã nghiệp vụ.
- **Làm:**
  1. Đổi `RAISE` trong DB (DB-15) sang `ERRCODE` riêng (`HS001`…) để không phải so chuỗi.
  2. Thêm ánh xạ lỗi unique violation thành `duplicate_*`.
- **Kiểm tra:** test cho từng mã lỗi trong bảng mục 6 của tài liệu 02.

### BE-10 · Kiểm tra đầu vào ✅ · 0,5 ngày
- **Kết quả:** `ValidationFilter<T>` + FluentValidation cho hồ sơ, giấy tờ trong hồ sơ, giao việc, chuyển bước. Lỗi 400 có `errors` theo khóa camelCase, thông điệp tiếng Việt.
- **Làm:**
  1. Endpoint filter `ValidationFilter<T>` gọi `IValidator<T>`.
  2. Lỗi trả `ValidationProblem` với khóa theo tên trường camelCase.
  3. Thông điệp tiếng Việt.
- **Kiểm tra:** gửi thiếu `title` khi tạo hồ sơ thì 400, có `errors.title`.

### BE-11 · OpenAPI ✅ · 0,5 ngày
- **Kết quả:** `/openapi/v1.json` có 101 đường dẫn; transformer khai báo lỗi chung cho mọi thao tác trừ đăng nhập (test `OpenAPI_khai_bao_loi_chung_cho_moi_thao_tac_tru_dang_nhap`); `backend/scripts/export-openapi.sh` xuất ra `frontend/src/api/openapi.json`. Chưa chạy `npm run gen:api` ở frontend để xem kiểu sinh ra có lỗi không.
- **Đã có:** `AddOpenApi`, `/openapi/v1.json`, Scalar ở `/docs` (chỉ dev).
- **Làm:**
  1. Thêm mô tả lỗi chung (401, 403, 404, 409, 422) cho mọi endpoint bằng transformer.
  2. Xuất `openapi.json` vào `frontend/src/api/` khi build (target MSBuild hoặc script).
- **Kiểm tra:** `npm run gen:api` ở frontend sinh kiểu không lỗi.

### BE-12 · Đăng nhập OIDC và phiên ✅ · 1 ngày (+ SEC-02)
- **Kết quả:** Dev: đăng nhập bằng người dùng giả lập trong CSDL, ghi `last_login_at` và `access_events(login)`. OIDC: `OnTokenValidated` tra `external_auth_subject`, từ chối tài khoản khóa/không có. **`OidcLoginTests` (12) chạy luồng code + PKCE thật qua một nhà cung cấp OIDC giả theo giao thức** (`Support/FakeOidcProvider.cs`: discovery, JWKS, authorize, token có kiểm PKCE S256 và bí mật client, end_session): đăng nhập thành công cho người dùng đã cấp (có phiên, `last_login_at`, `access_events(login)`; gửi đúng S256/state/nonce, không lộ bí mật client); `sub` lạ hoặc tài khoản khóa bị từ chối, không có phiên và không ghi mốc đăng nhập; id_token sai nonce/đối tượng/người phát hành/hết hạn/ký bằng khóa khác/thiếu `sub` bị từ chối; sửa `state`, dùng lại callback hoặc sai bí mật client bị từ chối; `dev-login` tắt ở chế độ OIDC; đăng xuất xóa phiên và đi qua `end_session` của IdP. Test lộ lỗi 302 thay vì 401 (đã sửa). **Chưa chạy với Keycloak thật** (cấu hình realm/client, mapper `sub`, thời hạn token); đây là việc còn lại duy nhất của task, không phải việc lập trình.
- **Phiên lưu trong CSDL (migration 027, `PostgresTicketStore`):** cookie chỉ mang khóa phiên 256 bit (đã mã hóa bằng Data Protection), vé xác thực nằm ở `auth_sessions` (chỉ có mã người dùng, tên và id_token; không có access/refresh token; role chỉ-đọc không đọc được bảng). Thu hồi ngay: đăng xuất, khóa tài khoản, hoặc `POST /admin/users/{id}/revoke-sessions` (buộc đăng xuất mọi phiên của một người); cookie cũ nhận 401 ở request kế tiếp, kể cả khi còn hạn. Vé không trả về nếu người dùng bị khóa bằng đường khác. Gia hạn trượt ghi lại thời hạn; `SessionCleanupService` mỗi giờ xóa phiên hết hạn quá 1 ngày hoặc thu hồi quá 7 ngày. Đăng xuất OIDC thu hồi phiên rồi chuyển sang `end_session` của IdP **kèm `id_token_hint`** (lấy từ vé phía máy chủ), nên Keycloak không hỏi xác nhận. Khóa Data Protection: đặt `Auth:DataProtectionKeysPath` (thư mục dùng chung) khi chạy container hoặc nhiều instance, nếu không thì mỗi lần mất khóa mọi người phải đăng nhập lại. Test: `SessionTests` (5) và các ca mới ở `OidcLoginTests` (13 test).
- **Hành vi đổi:** mở khóa tài khoản không làm sống lại phiên đã thu hồi (trước đây có).
- **Đã có:**
  - cookie `__Host-hoso` và OpenIdConnect (code + PKCE, callback `/api/v1/auth/callback`);
  - `/auth/login`, `/auth/logout`;
  - `/auth/dev-login` chỉ ở Development;
  - từ chối khởi động nếu bật Dev ngoài Development.
- **Làm:**
  1. Trong `OnTokenValidated`: tìm `users` theo `external_auth_subject`; không có hoặc `active=false` thì `context.Fail`.
  2. Cập nhật `last_login_at`; ghi `access_events(action='login')`.
  3. Thay claim của tài khoản dev bằng `UserId` thật.
- **Kiểm tra:** Keycloak dev, đăng nhập `demo_head_kt` thành công; tài khoản bị khóa nhận trang lỗi rõ ràng.

### BE-13 · Phân công đang dùng ✅ · 1,5 ngày
- **Kết quả:** Header `X-Assignment-Id`, phân công của người khác/hết hạn 403, ủy quyền chỉ lấy phần quyền được giao, cache 60 giây. Test: `IdentityTests`.
- **Đã có:** `AssignmentClaimsTransformation` (bản khung lấy quyền theo vai trò của tài khoản dev).
- **Làm:**
  1. Đọc header `X-Assignment-Id`. Next đặt header này từ cookie `hoso_assignment`.
  2. Kiểm tra phân công thuộc người dùng, còn hiệu lực, hoặc là ủy quyền còn hiệu lực.
  3. Nạp quyền từ `role_permissions`; ủy quyền chỉ lấy quyền được ủy.
  4. Cache 60 giây theo `(user, assignment)`.
  5. Không có header thì dùng phân công đầu tiên.
- **Kiểm tra:** gửi id phân công của người khác thì 403; ủy quyền hết hạn thì 403.

### BE-14 · Policy quyền ✅ · 1 ngày
- **Kết quả:** `PermissionCoverageTests` quét mọi endpoint: thiếu `RequirePermission` thì đỏ; mỗi quyền có ít nhất một vai trò được và một vai trò bị chặn.
- **Đã có:** `PermissionPolicyProvider`, `PermissionHandler`, `.RequirePermission(...)` trên mọi endpoint.
- **Làm:** test sinh tự động từ `DefaultRolePermissions` × danh sách endpoint (đọc `EndpointDataSource`): mỗi endpoint có ít nhất một vai trò được phép và một vai trò bị chặn.
- **Kiểm tra:** thêm endpoint mà quên `RequirePermission` thì test đỏ (trừ danh sách cho phép: `/me`, `/events`, `/workspace/*`, `/notifications/*`, `/procedures/*`, `/catalog/*` GET).

### BE-15 · Lọc theo phạm vi ✅ · 2 ngày
- **Kết quả:** `ScopeFilter` gọi `hoso.scope_matches` (một nguồn quy tắc). Test: ma trận 9 vai trò, khớp hàm SQL, 404 ngoài phạm vi, hồ sơ hạn chế, giấy tờ theo hồ sơ.
- **Làm:**
  1. `IScopeFilter.Dossiers(IQueryable<Dossier>)` và `.Documents(...)` dịch đúng quy tắc của `scope_matches`:
     - tổ chức, đơn vị, người được giao;
     - Chủ tịch chỉ khối `tl-ubnd`, HĐND chỉ khối `tl-hdnd`;
     - `restricted` cần cấp quyền riêng.
  2. Giấy tờ thấy được khi thuộc ít nhất một hồ sơ thấy được, hoặc là PDF mình nạp còn trong hộp tiếp nhận.
- **Kiểm tra:** ma trận 6 vai trò × 4 hồ sơ mẫu; kết quả khớp `SELECT hoso.scope_matches(...)`.

### BE-16 · Nhật ký truy cập ✅ · 1 ngày (= LOG-06)
- **Kết quả:** `AccessEventQueue` + ghi lô 100 dòng/2 giây; ghi `view` hồ sơ/giấy tờ/tệp/trang cỡ đọc, `download`, `export`, `search`, `login`. Có test mất CSDL lúc ghi: request vẫn thành công, ghi Warning và đếm số dòng mất (`Mat_CSDL_khi_ghi_nhat_ky_truy_cap_thi_khong_nem_loi_va_dem_so_dong_mat`).
- **Làm:**
  1. `IAccessLog.Record(action, objectType, objectId)` đẩy vào `Channel<T>`.
  2. `BackgroundService` ghi lô 100 dòng hoặc mỗi 2 giây.
- **Kiểm tra:** tải tệp ghi 1 dòng; DB tạm mất thì request vẫn thành công, log Warning.

### BE-17 · Hạ tầng test tích hợp ✅ · 1,5 ngày
- **Kết quả:** `DbApiFactory` + `TestDatabase`: CSDL mẫu một lần, mỗi lớp test một CSDL qua `TEMPLATE`; dùng `HOSO_TEST_PG` hoặc Testcontainers; không có cả hai thì skip. Không dùng Respawn vì mỗi lớp có CSDL riêng.
- **Đã có:** `ApiFactory` (không cần DB), `SecurityTests` (401, 403, CSRF, open redirect, quyền theo vai trò).
- **Làm:**
  1. `DbApiFactory` dùng `Testcontainers.PostgreSql`, chạy migration một lần cho cả lớp test.
  2. Dùng Respawn dọn dữ liệu giữa các test.
  3. Helper `LoginAs("mau.tp.ht")`.
- **Kiểm tra:** viết một test endpoint mới chỉ cần khoảng 10 dòng chuẩn bị.

### BE-18 · Health ✅ · 0,5 ngày
- **Kết quả:** `/health/ready` kiểm tra CSDL, kho tệp ghi được, hàng đợi AI (Degraded khi việc chờ >10 phút mà không có worker báo nhịp). Test: 503 khi mất CSDL; Degraded.
- **Đã có:** `/health/live`, `/health/ready` (kiểm tra DB).
- **Làm:**
  1. Thêm kiểm tra kho tệp ghi được.
  2. Thêm kiểm tra hàng đợi AI không treo; trả `Degraded` khi treo.
- **Kiểm tra:** dừng Postgres thì `/health/ready` trả 503.

### BE-19 · Bảo vệ HTTP ✅ · 0,5 ngày
- **Kết quả:** Mặc định 1 MB, tải PDF theo `Limits:UploadMaxBytes`, 413 được test trên TestServer và Kestrel thật; `KnownProxies`/`KnownNetworks` lấy từ cấu hình và không còn tin mặc định khi đã khai báo (`Proxy_tin_cay_lay_tu_cau_hinh...`); quá số lần gọi trong một phút trả 429 (`Qua_so_lan_goi_trong_mot_phut_thi_429`).
- **Đã có:** rate limit toàn cục và theo tải lên, header bảo mật, `no-store`, không bật CORS, `ForwardedHeaders`.
- **Làm:**
  1. Khai báo `KnownProxies` từ cấu hình.
  2. Đặt `MaxRequestBodySize` của Kestrel bằng `Limits:UploadMaxBytes`; các endpoint khác giới hạn 1 MB.
- **Kiểm tra:** tệp 201 MB trả 413; 301 request trong 1 phút trả 429.

### BE-20 · Outbox ✅ · 1,5 ngày
- **Kết quả:** `OutboxDispatcher`: `FOR UPDATE SKIP LOCKED`, savepoint từng thông điệp, thử lại 5s/30s/5 phút, quá 10 lần ghi Error và hoãn 1 ngày. Chưa thử giết tiến trình giữa chừng.
- **Làm:**
  1. `IOutbox.Add(type, payload)` ghi cùng transaction.
  2. `OutboxDispatcher` lấy bằng `FOR UPDATE SKIP LOCKED`; thử lại với giãn cách 5 giây, 30 giây, 5 phút; quá 10 lần thì ghi Error.
- **Kiểm tra:** dừng API giữa chừng, khởi động lại vẫn xử lý đúng một lần.

### BE-21 · Kho tệp ✅ · 1,5 ngày
- **Kết quả:** Đọc theo khoảng byte (206) có test; `StorageMaintenanceService` mỗi giờ dọn `tmp/*.part` cũ hơn 1 ngày và không động tới tệp chính thức (có test); thêm `IFileStorage.DeleteAsync` (chỉ dùng khi hủy hồ sơ BE-87 và gói xuất hết hạn BE-86). **`S3FileStorage`** (AWSSDK.S3, chọn bằng `Storage:Provider=S3`; xem bảng cấu hình ở `backend/README.md`): cùng quy ước khóa `blobs/ab/cd/<sha256>` với kho ổ đĩa (chuyển kho chỉ là chép tệp), ghi tạm xuống ổ đĩa để tính SHA-256 rồi gửi (multipart khi lớn), ghi trùng trả `AlreadyExisted`, khóa lạ bị từ chối, thiếu tệp ném `FileNotFoundException` như kho ổ đĩa, luồng đọc tua được bằng HTTP Range từng đoạn 1 MiB (cần cho `Results.File(enableRangeProcessing)`, PDF và ZIP), tiền tố khóa, mã hóa phía máy chủ tùy chọn, `/health/ready` kiểm ghi được vào bucket. Test `S3FileStorageTests` (12) và `S3EndToEndTests` (3: API chạy trên S3, tải lên, tải xuống toàn tệp và theo Range, trùng 409, gói xuất, bucket không có thì 503). **Mới chạy trên emulator `moto`, chưa chạy với MinIO hay AWS S3 thật.** Gói xuất cũng đã chạy trên S3 từ đầu đến cuối (đóng gói từ kho S3, tải toàn bộ và theo Range, hết hạn thì xóa khỏi bucket). Test `S3EndToEndTests` (3).
- **Đã có:** `LocalFileStorage`: ghi tệp tạm, tính SHA-256 khi ghi, đổi tên; chặn khóa sai dạng.
- **Làm:**
  1. Thêm `S3FileStorage` (AWSSDK.S3, hỗ trợ MinIO); chọn bằng `Storage:Provider`.
  2. `OpenReadAsync` hỗ trợ đọc theo khoảng byte.
  3. Dọn tệp `tmp/*.part` cũ hơn 1 ngày.
- **Kiểm tra:** ghi cùng nội dung hai lần thì lần hai `AlreadyExisted=true`; khóa `../../etc/passwd` bị từ chối.

### BE-22 · Nghe sự kiện PostgreSQL ✅ · 1 ngày
- **Kết quả:** `PgNotificationListener`: LISTEN `job_progress`, `notification_created`, `dossier_changed`, tự nối lại 1→30 giây, báo `resync`. Chưa test ngắt kết nối 30 giây.
- **Làm:**
  1. `PgNotificationListener` (BackgroundService) giữ một kết nối `LISTEN job_progress, job_queued, notification_created`; tự kết nối lại.
  2. Phát sự kiện vào `IEventBus` trong bộ nhớ, theo người dùng.
- **Kiểm tra:** ngắt kết nối 30 giây vẫn nhận lại sự kiện sau đó.

### BE-23 · Luồng sự kiện SSE ✅ · 1 ngày
- **Kết quả:** SSE `/events`: `job.progress|completed|failed|cancelled`, `notification.created`, `dossier.changed` (chỉ người có hồ sơ trong phạm vi), `resync`; `Last-Event-ID` nhận bù 50 sự kiện; cô lập theo người dùng.
- **Đã có:** `GET /api/v1/events` gửi `retry` và nhịp 25 giây.
- **Làm:**
  1. Đăng ký `IEventBus` theo người dùng.
  2. Gửi `event: job.progress`, `job.completed`, `notification.created`, `dossier.changed` với `data` JSON nhỏ (id, trạng thái).
  3. Hỗ trợ `Last-Event-ID`.
- **Kiểm tra:** hai người cùng mở; người A chỉ nhận sự kiện của A.

---

## P3a · Danh mục, thủ tục, người dùng

### BE-30 · `GET /me` ✅ · 0,5 ngày
- **Kết quả:** `/me` đọc người dùng, phân công, ủy quyền từ CSDL; 403 `no_assignment` khi không có phân công.
- **Đã có:** trả `MeResponse` khớp kiểu `Session` của frontend, lấy từ claim.
- **Làm:** đọc `users`, `user_roles` còn hiệu lực, `delegations` nhận được, tên đơn vị; `activeAssignment` theo BE-13.
- **Kiểm tra:** người hai phân công nhận 2 phần tử `assignments`.

### BE-31 · Đọc danh mục ✅ (đường dẫn) · 1 ngày
- **Kết quả:** `/catalog/organizations|departments|work-groups|work-groups/{code}/document-types`.
- **Làm:**
  1. 4 endpoint đọc; cache bộ nhớ 10 phút, xóa cache khi BE-32 sửa.
  2. `ETag` theo phiên bản danh mục; trả 304 khi khớp.
- **Kiểm tra:** 38 nhóm, 427 loại, 2.624 trường; request lặp lại trả 304.

### BE-32 · Sửa danh mục ✅ · 1,5 ngày
- **Kết quả:** Thêm nhóm, loại giấy tờ, trường (mã tự cấp, chặn dữ liệu sai); mục đã có giấy tờ không xóa được mà chỉ ngừng dùng (ẩn khỏi lựa chọn, giữ dữ liệu); mọi thay đổi có audit. Test: `CatalogAdminTests`.
- **Làm:**
  1. Thêm và sửa nhóm, loại, trường; đánh dấu `confirmed`; ngừng dùng thay cho xóa khi đã có giấy tờ.
  2. Mọi thay đổi ghi audit.
- **Kiểm tra:** xóa loại đã có giấy tờ trả 409 kèm hướng dẫn “ngừng dùng”.

### BE-33 · Thủ tục hành chính ✅ · 1,5 ngày
- **Kết quả:** `ProceduresHandler`: tìm không dấu theo tên/mã, lọc lĩnh vực và hiệu lực, chi tiết kèm thành phần và mẫu, cảnh báo thủ tục đã bãi bỏ, tải mẫu từ kho tệp (ghi nhật ký; mẫu rỗng báo rõ). Dữ liệu nạp bằng `scripts/import_procedures.py`; trên `hoso_dev` hiện có 861 thủ tục, 5.596 thành phần, 1.570 mẫu. Test: `ProceduresTests`.
- **Làm:**
  1. Tìm kiếm không dấu (`unaccent` + `pg_trgm`), lọc lĩnh vực, trạng thái hiệu lực.
  2. Chi tiết kèm thành phần và mẫu.
  3. Tải mẫu từ kho tệp.
- **Kiểm tra:** “khai sinh” ra thủ tục khai sinh; thủ tục bãi bỏ có `lifecycleStatus=repealed`.

### BE-34 · Quản trị người dùng ✅ · 2 ngày
- **Kết quả:** Quản trị người dùng (tạo, khóa/mở, sửa), phân công có thời hạn kèm căn cứ (kiểm hình dạng theo vai trò), ủy quyền (tối đa 90 ngày, chỉ phần quyền vai trò gốc có, thu hồi được). Có hiệu lực ngay (xóa bộ nhớ phân công). Chốt chặn: không tự khóa mình, không khóa hay kết thúc phân công quản trị cuối cùng. Ghi vết bằng trigger (migration 022 thêm bảng users). Test: `AdminTests`, `AdminSafetyTests`.
- **Làm:**
  1. CRUD người dùng (không có mật khẩu).
  2. Phân công có `valid_from`, `valid_until`, `assignment_basis`.
  3. Ủy quyền có thời hạn và danh sách quyền ủy; thu hồi.
  4. Khóa tài khoản thì thu hồi phiên (SEC-02).
- **Kiểm tra:** phân công vi phạm CHECK của DB trả 422 với thông điệp rõ.

### BE-35 · Thời hạn bảo quản ✅ · 0,5 ngày
- **Kết quả:** Quy tắc bảo quản chỉ thành `confirmed` khi có người xác nhận và căn cứ pháp lý từ 5 ký tự (CSDL cũng chặn bằng CHECK); chỉ `catalog.manage`. BE-87 chỉ tin quy tắc đã xác nhận. Test: `Thoi_han_bao_quan_chi_co_hieu_luc_khi_xac_nhan_kem_can_cu_phap_ly`.
- **Làm:** đề xuất, xác nhận có căn cứ; chỉ `catalog.manage`.
- **Kiểm tra:** xác nhận thiếu căn cứ trả 400.

---

## P3b · Tiếp nhận, AI, đối chiếu

### BE-40 · Lô quét ✅ · 1 ngày
- **Kết quả:** Tạo, liệt kê, xem, đóng lô quét (mã `LQ-2026-0001`); đóng bị chặn khi còn lỗi ảnh mở. Chưa có API tạo/giải quyết lỗi ảnh (BE-53).
- **Làm:**
  1. Tạo lô với mã `LQ-2026-0001` (sinh bằng sequence), đơn vị giao, hộp, số tờ dự kiến.
  2. Đếm trang đã quét.
  3. Đóng lô: còn lỗi ảnh mở thì trả cảnh báo trong phản hồi nhưng vẫn cho đóng.
- **Kiểm tra:** đóng lô có lỗi mở thì response có `warnings`.

### BE-41 · Tải PDF lên ✅ · 2 ngày
- **Kết quả:** `POST /intake/files`: kiểm `%PDF-`, SHA-256, lưu theo `blobs/ab/cd/<sha>`, chống trùng (409 kèm giấy tờ cũ), tạo giấy tờ + job ưu tiên 3, giới hạn kích thước.
- **Làm:**
  1. Đọc multipart bằng `MultipartReader`, không dùng `IFormFile` để không đệm cả tệp vào RAM.
  2. Kiểm tra 5 byte đầu là `%PDF-`.
  3. `IFileStorage.SaveAsync`; trùng SHA-256 với tệp quét đã có thì 409 `duplicate_file` kèm `documentId`.
  4. Đếm trang bằng PdfPig; vượt giới hạn trang thì 422.
  5. Một transaction tạo `documents(intake_status='inbox')`, `files`, `ocr_jobs(queued)` rồi `NOTIFY job_queued`.
  6. Trả `{ documentId, jobId, queuePosition }`.
- **Kiểm tra:**
  - tệp 100 MB, bộ nhớ tiến trình tăng dưới 50 MB;
  - tệp không phải PDF trả 415;
  - tệp trùng trả 409.

### BE-42 · Hộp tiếp nhận ✅ · 1 ngày
- **Kết quả:** Hộp tiếp nhận (queued/reading/ready/failed), bỏ và hoàn tác trong 30 ngày.
- **Làm:**
  1. Danh sách theo `intake_status`, người nạp, lô; kèm tiến độ job và số trường cần xem.
  2. Bỏ và hoàn tác (30 ngày); giấy tờ đã xếp không bỏ được.
- **Kiểm tra:** bỏ giấy tờ đã xếp trả 409.

### BE-43 · Xem tệp ✅ · 1,5 ngày
- **Kết quả:** `content`, `download` (Range, ghi nhật ký truy cập) và `pages/{n}/preview?w=` (WebP, rộng 120–1600, mặc định 800). `PreviewHandler` + `PdfiumPreviewRenderer` (PDFtoImage 5.4.0: PDFium dựng trang, SkiaSharp mã hóa WebP; gói kèm sẵn thư viện gốc cho Windows, Linux, macOS). Chỉ bản 800 px được lưu vào kho (khóa là mã băm nội dung) và ghi ở `page_images.preview_storage_key`; bề rộng khác dựng theo yêu cầu, không lưu. ETag là mã băm nội dung nên hỏi lại nhận 304. Cùng phạm vi như tải tệp (PDF trong hộp tiếp nhận của người khác: 404); trang không có: 404; tệp hỏng: 422 `preview_failed`; tệp đã hủy nội dung: 404. Nhật ký truy cập chỉ ghi khi xem trang cỡ đọc (≥ 600 px), không ghi từng thumbnail. Tối đa 2 trang dựng đồng thời mỗi instance.
- **Đã kiểm:** test `PreviewTests` với PDF thật 2 trang: ảnh đúng bề rộng, có chữ đen (không trắng trơn), cache, 304, kẹp bề rộng.
- **Rủi ro cần quyết định:** PDFium là mã gốc (C++) xử lý PDF do người dùng tải lên. Đã có giới hạn dung lượng, số trang, số trang đồng thời; chưa cách ly bằng tiến trình riêng hay thời hạn dựng. Nếu cơ quan yêu cầu cao hơn thì chuyển bước dựng sang tiến trình/container riêng (xem `docs/05-bao-mat.md`). Chưa thử PDF lớn (hàng trăm trang, khổ A0) hay PDF cố ý hỏng/độc hại.
- **Làm:**
  1. `content` trả `Results.Stream` với `enableRangeProcessing: true`, `Content-Disposition: inline`.
  2. `download` trả kèm `attachment`.
  3. `preview` dùng PDFium (PDFtoImage) tạo WebP; cache vào kho tệp theo `sha256-page-width`.
  4. Kiểm tra phạm vi trước khi trả; ghi `access_events`.
- **Kiểm tra:** request `Range: bytes=0-1023` trả 206.

### BE-44 · API job ✅ · 1 ngày
- **Kết quả:** Xem tiến độ kèm vị trí hàng đợi, hủy (điều kiện nguyên tử), đọc lại một trang.
- **Làm:**
  1. Trạng thái, `processed_pages/page_count`, vị trí trong hàng (đếm job `queued` có ưu tiên cao hơn hoặc tạo trước).
  2. Hủy: đặt `cancelled`.
  3. Đọc lại một trang: tạo job `reread_page`.
- **Kiểm tra:** vị trí hàng đợi giảm dần khi các job trước xong.

### BE-45 · Đẩy tiến độ ✅ · 0,5 ngày
- **Kết quả:** Tiến độ job qua SSE (`PgNotificationListener`).
- **Làm:** nối `PgNotificationListener` → SSE (`job.progress`, `job.completed`) cho người nạp tệp.
- **Kiểm tra:** tiến độ hiện ở trình duyệt chậm không quá 1 giây.

### BE-46 · Thu hồi job treo ✅ · 0,5 ngày
- **Kết quả:** `StaleJobReaper` mỗi phút gọi `requeue_stale_jobs()` (tối đa 3 lần rồi failed).
- **Làm:** HostedService mỗi phút: job `running` có `heartbeat_at` cũ hơn 5 phút chuyển về `queued` (tăng `attempt`); quá 3 lần thì `failed`.
- **Kiểm tra:** giả lập heartbeat cũ thì job về `queued`.

### BE-47 · Dữ liệu đối chiếu ✅ · 1,5 ngày
- **Kết quả:** `GET /documents/{id}`, `/review`: gợi ý AI, trường kèm trích dẫn và trang nguồn, lý do cần chú ý, trạng thái khóa.
- **Làm:**
  1. Trả gợi ý AI và danh sách trường của loại giấy tờ, gồm giá trị gợi ý, giá trị đã lưu, trang/vùng nguồn.
  2. Gắn cờ `attention`: trống, `quote_verified=false`, trường quan trọng, mâu thuẫn `source_observations`.
  3. Sắp trường cần chú ý lên đầu.
- **Kiểm tra:** văn bản 26/KH-UBND mẫu có cờ ở “Ngày ban hành”.

### BE-48 · Phân loại ✅ · 1 ngày
- **Kết quả:** `PUT /classification`: chấp nhận hoặc đổi loại, ghi quyết định vào `ai_suggestions`, sao giá trị AI sang bảng chính với `needs_review=true`.
- **Làm:**
  1. Chấp nhận hoặc đổi nhóm, loại giấy tờ; ghi `ai_suggestions.decision`.
  2. Đổi loại thì giữ giá trị trùng nhãn, các trường khác đánh dấu cần đối chiếu.
- **Kiểm tra:** đổi loại không mất giá trị “Số, ký hiệu”.

### BE-49 · Sửa trường ✅ · 1,5 ngày
- **Kết quả:** `PATCH /fields`: sửa và xác nhận từng trường, nguồn `ocr`/`manual`, chuẩn hóa ngày ISO; sửa sau khi đã xác nhận thì phải xác nhận lại.
- **Làm:**
  1. PATCH nhiều trường, gửi kèm `rowVersion`.
  2. Chuẩn hóa:
     - ngày `dd/mm/yyyy` → ISO;
     - số dùng dấu phẩy thập phân → dấu chấm;
     - giữ nguyên `value_text`.
  3. Xác nhận thì `needs_review=false`, `verified_by`, `verified_at`.
- **Kiểm tra:** “20/01/2026” → `2026-01-20`; “80,5” → `80.5`; ngày sai trả lỗi đúng trường.

### BE-50 · Xác nhận giấy tờ ✅ · 0,5 ngày
- **Kết quả:** `POST /verify`: chỉ khi mọi trường đã đối chiếu; trả `review_incomplete` kèm danh sách.
- **Làm:** kiểm tra không còn `needs_review`, `metadata_status ≠ needs_review`; đặt `data_review_status=verified`.
- **Kiểm tra:** còn trường chưa xác nhận trả 422 kèm danh sách trường.

### BE-51 · Tách văn bản ✅ · 2 ngày
- **Kết quả:** Đề xuất dải trang (không chồng, không hở, phủ đủ số trang); xác nhận thì cắt trang bằng PdfPig thành các tệp dẫn xuất (mở được bằng pdfium), tạo văn bản con và xếp vào hàng đợi AI; tệp không phải PDF đọc được báo 422 và không tạo gì. Test: `SplitAndSignatureTests` (PDF 8 trang tách 3 văn bản).
- **Làm:**
  1. Nhận danh sách dải trang; kiểm tra không chồng, không hở, phủ đủ số trang.
  2. Xác nhận thì tạo văn bản con, mỗi văn bản một tệp dẫn xuất (PdfPig cắt trang), một dòng `document_segments`; văn bản nguồn chuyển `split`.
- **Kiểm tra:** PDF 12 trang tách 4 phần, tổng trang bằng 12.

### BE-52 · Liên kết văn bản ✅ · 0,5 ngày
- **Kết quả:** Thêm và gỡ liên kết; chặn vòng phụ lục kể cả gián tiếp và liên kết trùng; chỉ người sửa được giấy tờ mới liên kết. Test: `Lien_ket_van_ban_chan_vong_phu_luc_ke_ca_gian_tiep_va_chan_trung`.
- **Làm:** thêm và gỡ liên kết; chặn vòng `appendix_of`.
- **Kiểm tra:** A phụ lục của B, rồi B phụ lục của A thì 422.

### BE-53 · Lỗi chất lượng ảnh ✅ · 1 ngày
- **Kết quả:** `/quality-issues` (liệt kê kèm trang AI gắn cờ đáng ngờ, tạo, xử lý: sửa hoặc chấp nhận bỏ qua có lý do) và `PUT /files/{id}/pages/{n}/quality` (rescan_required mở lỗi, rescanned/ok tự đóng). Lô quét không đóng được khi còn lỗi mở. Chỉ văn thư cùng cơ quan thấy và xử lý. Test: `QualityTests`.
- **Làm:** CRUD lỗi; tự tạo từ `page_images.quality_flags` khi worker ghi; lọc theo lô.
- **Kiểm tra:** trang trắng tạo lỗi mức thấp.

### BE-54 · Spike chữ ký số ✅ · 2 ngày
- **Kết quả:** `SignaturesHandler` + `PdfTools.ReadSignatures` (BouncyCastle đọc CMS theo `/ByteRange`), ghi `file_signatures`. PDF mẫu `public-016` cho ra người ký "HỘI ĐỒNG NHÂN DÂN PHƯỜNG TỪ LIÊM", số sê-ri 262A5667A181730E, trạng thái `valid`. **Giới hạn:** chỉ kiểm tra kỹ thuật chữ ký; chưa kiểm chuỗi tin cậy và thu hồi chứng thư nên không kết luận hiệu lực pháp lý; trong 3 PDF mẫu chỉ 1 tệp có chữ ký. Test: `Doc_chu_ky_so_trong_PDF_mau_va_noi_ro_chua_kiem_chuoi_tin_cay`.
- **Làm:** đọc chữ ký PDF bằng BouncyCastle (CMS trong `/ByteRange`); ghi `file_signatures`; báo cáo khả thi.
- **Kiểm tra:** 3 PDF mẫu có chữ ký trong `database/samples`.

---

## P3c · Hồ sơ và quy trình

### BE-60 · Danh sách hồ sơ ✅ · 1,5 ngày
- **Kết quả:** Danh sách keyset (cập nhật, id), lọc trạng thái/đơn vị/nhóm/của tôi, tìm không dấu; chi tiết kèm giấy tờ và mức đủ thành phần.
- **Làm:**
  1. Lọc trạng thái, nhóm, đầu mối, năm, hạn, người được giao, từ khóa (trigram).
  2. Phân trang keyset theo `(updated_at, id)`.
  3. Trả số đã đối chiếu trên tổng giấy tờ.
- **Kiểm tra:** 20.000 hồ sơ, p95 dưới 200 ms; chuyên viên chỉ thấy hồ sơ được giao.

### BE-61 · Tạo, sửa hồ sơ ✅ · 1,5 ngày
- **Kết quả:** Tạo hồ sơ (mã `UBND-2026-000001`, phân công người tạo), sửa bằng `version`, chỉ ở bước draft/returned.
- **Làm:**
  1. Kiểm tra bộ ba tổ chức, đầu mối, nhóm khớp `work_groups`.
  2. Mã sinh bằng `next_dossier_code`; sửa cần `rowVersion`.
  3. Đổi nhóm không xóa giấy tờ, trả danh sách cần đối chiếu lại.
- **Kiểm tra:** tạo 50 hồ sơ đồng thời không trùng mã.

### BE-62 · Giấy tờ trong hồ sơ ✅ · 1,5 ngày
- **Kết quả:** Thêm, sắp xếp, gỡ giấy tờ; PDF gỡ ra quay về hộp tiếp nhận.
- **Làm:**
  1. Thêm từ hộp tiếp nhận, trong một transaction đổi `intake_status=filed`.
  2. Sắp xếp, đổi chiều, gán thành phần thủ tục, gỡ.
  3. Chỉ cho sửa khi trạng thái `draft` hoặc `returned`.
- **Kiểm tra:** thêm khi hồ sơ đang chờ kiểm tra trả 409.

### BE-63 · Hồ sơ gợi ý ✅ · 0,5 ngày
- **Kết quả:** `GET /dossiers/suggestions?documentId=`: cùng nhóm với gợi ý AI, đang soạn, trong phạm vi, tối đa 10, không gợi ý hồ sơ đã lưu trữ hay đã chứa giấy tờ này. Test: `Hoso_goi_y_cung_nhom_dang_soan_trong_pham_vi_toi_da_10_khong_goi_y_ho_so_da_xep`.
- **Làm:** cùng nhóm với gợi ý AI, đang chuẩn bị, trong phạm vi; sắp theo lần cập nhật; tối đa 10.
- **Kiểm tra:** không gợi ý hồ sơ đã lưu trữ.

### BE-64 · Danh sách kiểm tra ✅ · 1 ngày
- **Kết quả:** Hai lớp. (1) Theo giấy tờ trong hồ sơ (đã đối chiếu / chờ đối chiếu / chưa phân loại), như trước. (2) Theo thủ tục: hồ sơ có thể gắn `procedureId` khi tạo hoặc sửa (chặn thủ tục không có hoặc đã bãi bỏ/thay thế), giấy tờ được gán vào một thành phần (`procedureComponentId` khi thêm, hoặc khi sắp xếp; chặn thành phần không thuộc thủ tục của hồ sơ); đổi hoặc bỏ thủ tục thì các giấy tờ đã gán được gỡ gán (giấy tờ vẫn ở trong hồ sơ). `GET /dossiers/{id}/checklist` trả từng thành phần của thủ tục với `state` (`ok`, `pending`, `missing`), `required` (theo bản công bố), số lượng bản chính/sao, danh sách giấy tờ, `todo` (việc cần làm) và tóm tắt `procedure` (đủ, chờ đối chiếu, thiếu của các mục bắt buộc, cảnh báo). `GET /actions` thêm `warning` cho nút cần giấy tờ đã đối chiếu.
- **Khóa cứng do cơ quan bật (migration 026):** mặc định thành phần thủ tục **chỉ cảnh báo**, vì `required_as_published` lấy từ bản công bố và có mục chỉ là điều kiện hay hướng dẫn, chưa chắc là giấy phải nộp. Khi cơ quan đã rà danh mục, quản trị bật cài đặt `dossier.enforce_procedure_components` = `true` (`PATCH /admin/settings`; chỉ nhận boolean, chuỗi `"true"` bị từ chối): từ đó `transition_dossier` chặn (HS004 → 422 `dossier_incomplete`) các bước cần giấy tờ đã đối chiếu khi hồ sơ theo thủ tục mà còn thành phần bắt buộc chưa có giấy tờ hoặc chưa đối chiếu xong; nút bị khóa kèm lý do, `procedure.enforced` báo cho giao diện. Hồ sơ không gắn thủ tục không bị ảnh hưởng. Tắt lại thì quay về chỉ cảnh báo. Test: `ProcedureChecklistTests` (7).
- **Làm:** từ `v_dossier_completeness`; mỗi dòng có `state` (`ok`, `pending`, `missing`) và việc cần làm.
- **Kiểm tra:** khớp hồ sơ mẫu `DEMO-2026-0002`.

### BE-65 · Phân công hồ sơ ✅ · 1 ngày
- **Kết quả:** `assign_dossier` (SQL): người nhận phải là chuyên viên còn hiệu lực của đúng đơn vị; ghi vết phân công.
- **Làm:** giao người chủ trì, người phối hợp, hạn; cập nhật `dossiers.assignee_id` cùng transaction; outbox `DossierAssigned`.
- **Kiểm tra:** chỉ trưởng phòng của đơn vị làm được; người được giao nhận thông báo.

### BE-66 · Thao tác được phép ✅ · 1 ngày
- **Kết quả:** `GET /actions`: nút theo vai trò và quyền, `enabled` + `disabledReason`, bước đích.
- **Làm:** đọc `workflow_transitions` theo `workflow_code`, trạng thái, vai trò đang dùng; kèm `requiresNote` và `blockedReason` (từ danh sách kiểm tra).
- **Kiểm tra:** khớp `WorkflowRules` ở Domain cho 6 vai trò × 6 trạng thái.

### BE-67 · Chuyển bước ✅ · 1,5 ngày
- **Kết quả:** `POST /transitions` qua `hoso.transition_dossier` với phiên bản; mọi mã lỗi ánh xạ.
- **Làm:**
  1. Một transaction: kiểm tra `rowVersion`, gọi `hoso.transition_dossier`, ghi outbox (`DossierSubmitted`, `Returned`, `Escalated`, `Decided`, `Archived`).
  2. Trả trạng thái mới.
- **Kiểm tra:** hai người bấm cùng lúc thì một thành công, một nhận 409.

### BE-68 · Nhật ký hồ sơ ✅ · 1 ngày
- **Kết quả:** `GET /history`.
- **Làm:** gộp `workflow_events`, thay đổi phân công, thêm/gỡ giấy tờ (từ `audit_events`); có tên người và vai trò.
- **Kiểm tra:** thứ tự thời gian giảm dần, phân trang.

### BE-69 · Việc của tôi ✅ · 1 ngày
- **Kết quả:** `/workspace/queue` và `/summary` qua `hoso.my_queue`.
- **Làm:** `summary` (số cho menu: PDF chờ xếp, hồ sơ chờ mình, quá hạn) và `queue` (danh sách ưu tiên) từ `my_queue`.
- **Kiểm tra:** mỗi vai trò thấy đúng hàng việc như khung frontend.

### BE-70 · Thông báo ✅ · 1,5 ngày
- **Kết quả:** Thông báo từ outbox cho trưởng phòng/lãnh đạo/văn thư/người soạn; `GET`, đánh dấu đã đọc, đọc tất cả.
- **Làm:** outbox → `notifications` → SSE `notification.created`; đánh dấu đã đọc; dọn thông báo đã đọc sau 90 ngày.
- **Kiểm tra:** không gửi trùng khi dispatcher chạy lại.

### BE-71 · Nhắc hạn ✅ · 0,5 ngày
- **Kết quả:** `DueReminderService` chạy 7:30 giờ Việt Nam; hồ sơ còn tối đa 2 ngày tới hạn nội bộ hoặc đã quá hạn; tối đa một nhắc mỗi hồ sơ mỗi ngày (kiểm trong CSDL nên chạy lại hoặc nhiều instance vẫn không trùng); bỏ qua hồ sơ đã lưu trữ. Test đồng hồ giả qua 3 ngày ra đúng 3 nhắc.
- **Làm:** chạy hằng ngày lúc 7:30; hồ sơ còn 2 ngày hoặc đã quá hạn; tối đa 1 nhắc mỗi hồ sơ mỗi ngày.
- **Kiểm tra:** đồng hồ giả (`IClock`) chạy qua 3 ngày, có đúng 3 nhắc.

---

## P3d · Tra cứu, kho, nộp lưu, xuất

### BE-80 · Tra cứu ✅ · 2 ngày
- **Kết quả:** `/search`: tìm không dấu, khớp tiền tố trong số ký hiệu, tiêu đề, toàn văn OCR (kèm trang và đoạn trích giữ dấu) và hồ sơ; từ khóa chỉ là chữ (không nhận toán tử tsquery/SQL). **Số ký hiệu xếp hạng: khớp đúng > chứa chuỗi > gần đúng theo pg_trgm** (gõ "17 NQ HDND" tìm ra "17/NQ-HĐND"; có chỉ mục trigram ở migration `025`). **Bộ lọc:** `documentType`, `workGroup`, `department` (theo phân loại giấy tờ; hồ sơ theo nhóm và đơn vị), `form`, `issuedFrom`, `issuedTo` (ngày ban hành; giấy tờ không có ngày không lọt qua bộ lọc ngày; khoảng ngày ngược trả 400). Bộ lọc chỉ có nghĩa với giấy tờ thì bỏ phần hồ sơ. **Phạm vi được áp trước khi cắt `limit` và khi đếm** (`totalDocuments`, `totalDossiers` không cộng gì ngoài phạm vi; 30 giấy tờ ngoài phạm vi xếp cao hơn không đẩy giấy tờ trong phạm vi ra). Nhật ký `search` chỉ ghi ai tìm và lúc nào, **không ghi từ khóa** (chặt hơn yêu cầu ban đầu là ghi độ dài từ khóa và số kết quả; bảng `access_events` không có cột cho chúng). Test: `SearchTests` (7).
- **Làm:**
  1. Gọi `search_documents` (số ký hiệu trigram, trích yếu, toàn văn OCR không dấu); lọc theo phạm vi.
  2. Trả đoạn trích (`ts_headline`) và số trang trúng.
  3. Ghi `access_events(action='search')`: chỉ độ dài từ khóa và số kết quả.
- **Kiểm tra:** kết quả ngoài phạm vi không xuất hiện, kể cả trong tổng số.

### BE-81 · Kho bản giấy ✅ · 1,5 ngày
- **Kết quả:** `StorageHandler`. Cây vị trí bằng CTE đệ quy (cha trước con, kèm đường dẫn "Kho › Phòng › Tủ › Kệ › Hộp"), thêm/sửa/ngừng dùng (không ngừng dùng được vị trí còn hồ sơ hoặc còn vị trí con đang dùng), vị trí thuộc về cơ quan (văn thư cơ quan khác nhận 404). `GET /storage-locations/{id}/qr` trả SVG, `/by-qr?payload=` quét ra vị trí, `/labels?ids=` in nhãn A4 (3 × 8 nhãn mỗi trang, PDF có chữ tiếng Việt nhúng font Be Vietnam Pro OFL). Mã QR mang `HOSO-LOC:{mã}`, không phụ thuộc tên miền nên đổi địa chỉ hệ thống không làm hỏng nhãn đã dán.
- **Đã kiểm:** test `StorageAndLoanTests`; thêm một bước kiểm độc lập: giải mã QR trong SVG và trong PDF nhãn bằng OpenCV cho đúng `HOSO-LOC:…`.
- **Làm:** cây vị trí (CTE đệ quy), mã QR (QRCoder, SVG), in nhãn A4 hàng loạt (PDF).
- **Kiểm tra:** QR chứa `qr_payload`; quét QR mở đúng vị trí.

### BE-82 · Vị trí hồ sơ ✅ · 0,5 ngày
- **Kết quả:** `PUT /dossiers/{id}/location` (chỉ cấp hộp hoặc kệ; vị trí ngừng dùng bị từ chối). Trigger `record_dossier_move` ghi người, thời điểm, từ đâu đến đâu và ghi chú; lịch sử này nằm chung dòng thời gian `GET /dossiers/{id}/history` (hành động `location.moved`).
- **Làm:** đặt và chuyển vị trí; trigger ghi lịch sử.
- **Kiểm tra:** nhật ký hồ sơ có dòng chuyển vị trí.

### BE-83 · Mượn trả ✅ · 1,5 ngày
- **Kết quả:** `LoansHandler`: đề nghị → duyệt (hạn mặc định 14 ngày, tối đa 90) → giao → trả (ghi tình trạng), hoặc từ chối kèm lý do. Chỉ mục duy nhất trong CSDL bảo đảm một khoản hiệu lực mỗi hồ sơ nên hai người cùng đề nghị chỉ một người được duyệt; vi phạm trả 409 `loan_conflict`. Thông báo qua outbox (văn thư khi có đề nghị; người mượn khi duyệt, từ chối, giao). `DueReminderService` hằng ngày chuyển khoản đang mượn quá hạn sang `overdue` đúng một lần và báo người mượn cùng văn thư. Người mượn chỉ thấy khoản của mình; người duyệt thấy của cơ quan.
- **Làm:** đề nghị → duyệt → giao → trả; quá hạn chuyển `overdue` hằng ngày; thông báo.
- **Kiểm tra:** mượn hồ sơ đang được mượn trả 409.

### BE-84 · Nộp lưu theo đợt ✅ · 2 ngày
- **Kết quả:** `ArchiveHandler`: tạo đợt từ hồ sơ `ready_archive` (khóa các hồ sơ trước khi kiểm để hai văn thư không cùng gom một hồ sơ), nộp, xóa đợt đang soạn, tiếp nhận, trả lại. Tiếp nhận là một giao dịch: mỗi hồ sơ chuyển bước `archive` trong một savepoint, có hồ sơ lỗi thì hoàn tác cả đợt (không hồ sơ nào đổi trạng thái, kiểm bằng SQL trong test), lỗi từng hồ sơ ghi vào đợt và trả 422 `archive_issues` kèm danh sách; sửa xong tiếp nhận lại được. Trả lại cần lý do và có thể kèm lỗi từng hồ sơ; hồ sơ được giải phóng để gom lại.
- **Làm:** tạo đợt từ hồ sơ `ready_archive`; nộp; tiếp nhận (một transaction gọi `archive` cho từng hồ sơ); trả lại kèm lỗi.
- **Kiểm tra:** một hồ sơ lỗi thì không hồ sơ nào đổi trạng thái.

### BE-85 · Biên bản nộp lưu ✅ · 1 ngày
- **Kết quả:** `IDocumentRenderer.ArchiveMinutes` dựng bằng PdfPig đã có sẵn trong dự án (không thêm thư viện, không cần Chromium; nếu sau này cần bố cục phức tạp hơn thì cân nhắc QuestPDF và xem lại điều khoản giấy phép của nó), có mã đợt, danh mục hồ sơ, số trang, vị trí lưu, người nộp, người nhận. Sinh ngay sau khi tiếp nhận rồi lưu thành `documents` (`minutes_document_id`); nếu lần sinh đầu bị lỡ thì lần tải đầu tiên sinh bù, có khóa nên không tạo hai biên bản. Tải lại trả đúng tệp đã lưu.
- **Làm:** sinh PDF (QuestPDF bản cộng đồng, hoặc mẫu HTML in qua Chromium headless); lưu thành `documents`.
- **Kiểm tra:** có mã đợt, danh mục hồ sơ, số trang, vị trí, người nộp, người nhận.

### BE-86 · Xuất gói bàn giao ✅ · 2 ngày
- **Kết quả:** `ExportHandler` + `ExportWorker` (HostedService). Danh sách hồ sơ được chốt lúc yêu cầu theo phạm vi của người yêu cầu (hồ sơ ngoài phạm vi: 404). Worker lấy việc bằng `FOR UPDATE SKIP LOCKED`, đóng ZIP theo luồng (bộ đệm 80 KB, băm SHA-256 ngay khi chép, đối chiếu với mã băm đã ghi: lệch hoặc mất tệp thì gói `failed` kèm lý do, không giao gói thiếu) gồm PDF, `metadata.json`, `danh-muc.csv` (có BOM cho Excel), `manifest.sha256`. Tiến độ qua trigger → `pg_notify('export_progress')` → SSE `export.progress|ready|failed` chỉ tới người yêu cầu. Gói giữ 7 ngày rồi xóa nội dung (410 `export_expired`); việc "running" mất nhịp sống 10 phút được xếp lại hàng đợi. Chỉ người yêu cầu xem và tải được; yêu cầu và tải đều ghi `access_events(action='export')`. Giấy tờ chỉ có siêu dữ liệu (chưa có tệp số) được ghi vào metadata với ghi chú, không làm hỏng gói.
- **Đã kiểm:** gói thật được giải nén bằng `unzip` và `shasum -a 256 -c manifest.sha256` báo OK cả 3 tệp.
- **Chưa kiểm:** gói 1 GB. Thiết kế dùng bộ nhớ không đổi theo dung lượng và chạy nền nên không chặn API, nhưng chưa đo thực tế với tệp lớn. Gói đóng xong còn được chép một lần nữa vào kho (hai lần ghi đĩa); tối ưu được khi cần.
- **Làm:**
  1. HostedService đóng ZIP theo luồng: PDF, `metadata.json`, `danh-muc.csv`, `manifest.sha256`.
  2. Báo tiến độ qua SSE; hết hạn sau 7 ngày.
- **Kiểm tra:** gói 1 GB không làm API chậm; `sha256sum -c manifest.sha256` đạt.

### BE-87 · Đề nghị hủy ✅ · 1,5 ngày
- **Kết quả:** `DisposalHandler`: đề nghị (`DisposalRequest`: văn thư) → phê duyệt kèm văn bản quyết định (`DisposalApprove`: Chủ tịch/lãnh đạo HĐND, phải khác người đề nghị) → thực hiện (`POST /disposals/{id}/execute`, văn thư). Điều kiện đề nghị: hồ sơ đã lưu trữ; có quy tắc bảo quản **đã xác nhận** (người xác nhận + căn cứ pháp lý — quy tắc mới chỉ "đề xuất" không được tính, hệ thống không tự đặt thời hạn) và đã đủ số năm kể từ ngày lưu trữ; không có khoản mượn hiệu lực; chưa có đề nghị đang mở. Hồ sơ chưa gán quy tắc thì dùng quy tắc đã xác nhận **duy nhất** của nhóm công việc, có nhiều hơn một thì không đoán (422 `retention_missing`). `GET /disposals/eligible` liệt kê hồ sơ đã đến hạn. Văn bản quyết định phải là giấy tờ đã có trong hệ thống, người duyệt xem được và nằm ngoài hồ sơ bị hủy.
  - Thực hiện xóa nội dung (tệp trên kho, ảnh trang, chữ OCR, trích dẫn trong gợi ý AI) của các giấy tờ nội bộ **chỉ thuộc hồ sơ này**; giữ dòng metadata (`files.disposed_at`, `sha256`, `byte_size`), giấy tờ công khai, giấy tờ dùng chung với hồ sơ khác, văn bản quyết định và biên bản nộp lưu; bỏ vị trí lưu kho (lịch sử vị trí vẫn còn kèm lý do). Nội dung dùng chung với bản ghi khác (cùng mã băm) không bị xóa. Thực hiện khi chưa duyệt hoặc đã thực hiện: 409. Tệp trên kho xóa trước khi xác nhận giao dịch nên nếu bước xác nhận hỏng thì thực hiện lại là an toàn.
  - Thông báo qua outbox: lãnh đạo khi có đề nghị; người đề nghị khi duyệt hoặc từ chối.
- **Cần cơ quan xác nhận:** (1) các giá trị trường đã trích (họ tên, số định danh…) hiện được **giữ** như metadata; nếu quy định yêu cầu xóa cả dữ liệu cá nhân thì cần thêm bước xóa các giá trị đó. (2) Quy tắc "người phê duyệt khác người đề nghị" hiện chỉ chặn được khi một người có cả hai quyền (qua phân công kiêm nhiệm hoặc ủy quyền).
- **Làm:** tạo, duyệt kèm văn bản quyết định, thực hiện (xóa tệp, giữ metadata và nhật ký). Đây là đường duy nhất được xóa tệp.
- **Kiểm tra:** gọi thực hiện khi chưa duyệt trả 409.

### BE-88 · Quản trị vận hành ✅ · 1,5 ngày
- **Kết quả:** `/admin/ai/status` (hàng đợi, worker còn sống, lỗi gần đây, mô hình, thông lượng), `/admin/audit` (truy cập và thay đổi, chỉ tên cột, không lộ giá trị), `/admin/settings` (từ chối khóa kiểu bí mật). Chưa có kết nối/đo từ hệ thống giám sát ngoài.
- **Làm:** trạng thái AI (hàng đợi, worker, heartbeat, mô hình), cài đặt hệ thống, xem nhật ký có lọc theo mã tương quan và mã lỗi.
- **Kiểm tra:** chỉ `technical_admin`.

### BE-89 · Ghi nhận sao lưu ✅ · 0,5 ngày
- **Kết quả:** (1) **Khóa máy cho script:** `POST /api/v1/ops/backups` (ghi một lần sao lưu) và `PATCH /api/v1/ops/backups/{id}` (báo kết thúc, dung lượng, nơi lưu, diễn tập khôi phục) xác thực bằng header `X-Backup-Token` so với `Backup:IngestToken` (từ 32 ký tự, đặt bằng biến môi trường; so sánh thời gian cố định; chưa cấu hình thì 404). Không dùng cookie nên miễn CSRF, giới hạn 20 lần/phút mỗi địa chỉ (429), ghi log `backup_token_rejected` khi sai khóa; kết quả đã chốt không đổi lại được (409). (2) **Tình trạng:** `GET /admin/backups/status` cho từng loại (cơ sở dữ liệu, kho tệp bắt buộc; cấu hình tham khảo): bản thành công gần nhất, tuổi, quá hạn (mặc định 26 giờ theo docs/06), lần chạy gần nhất lỗi hoặc treo (12 giờ), chưa diễn tập khôi phục quá 100 ngày (hệ thống mới chạy chưa đủ lâu thì chưa nhắc). `POST /admin/backups/{id}/restore-test` ghi nhận diễn tập. (3) **Cảnh báo:** `BackupWatchdogService` (15 phút một lần) báo các quản trị kỹ thuật đang có hiệu lực qua thông báo `backup.alert` (cùng nội dung chỉ báo lại sau 24 giờ), và xuất chỉ số OpenTelemetry `hoso.backup.last_success_age_hours{kind}`, `hoso.backup.healthy` để Grafana cảnh báo. Tắt ở Development (`Backup:WatchdogMinutes=0`). Test `BackupMonitoringTests` (9).
- **Script sao lưu và diễn tập khôi phục** (OPS-03/04) ở `ops/backup/`, đã chạy thật với API và CSDL tạm (xem `ops/backup/README.md`). **Chưa làm:** màn Vận hành hiển thị (FE-44); sao lưu WAL; chạy dưới systemd/cron thật.
- **Làm:** endpoint cho script sao lưu (xác thực bằng khóa máy, không bằng cookie); danh sách `backup_runs`.
- **Kiểm tra:** lần sao lưu thành công gần nhất hiện ở màn Vận hành.

---

## P4 · Bảo mật sau rà soát (16/11/2026)

Kiểm lại bản rà soát bảo mật bên ngoài trên mã hiện tại. Bốn điểm được xác nhận bằng chạy thật (test thăm dò tạm thời trên PostgreSQL thật, đã xóa sau khi ghi kết quả); một điểm đã xử lý từ trước; một điểm xác nhận bằng đọc mã.
**Đã làm xong BE-90…BE-96 (xem từng task bên dưới).** Còn lại ngoài backend: SEC-01 (cấu hình MFA ở Keycloak), mã hóa kho tệp và bản sao lưu ở mức hệ thống, và các việc triển khai ở mục cuối.

| # | Phát hiện | Kiểm lại | Task |
|---|---|---|---|
| 1 | Quyền của phân công đang chọn ghép với phạm vi của phân công khác | **Đã xử lý (BE-90). Xác nhận ban đầu, nặng hơn mô tả:** (a) được ủy quyền chỉ `dossier.read` từ trưởng phòng KT, nhưng dùng phân công trưởng phòng HT của chính mình vẫn **giao việc** hồ sơ phòng KT (200); (b) kiêm nhiệm trưởng phòng hai đơn vị, đang chọn phân công HT vẫn đọc hồ sơ đơn vị VP (trước khi kiêm nhiệm: 404) | BE-90 |
| 2 | Tải gói xuất không kiểm lại quyền | **Đã xử lý (BE-91). Xác nhận ban đầu:** hồ sơ chuyển sang hạn chế, văn thư xem hồ sơ bị 404 nhưng vẫn tải gói ZIP cũ (200) | BE-91 |
| 3 | Chưa thu hồi phiên phía máy chủ | **Đã xử lý** ở BE-12 (sau thời điểm bản rà soát đọc mã): phiên trong `auth_sessions`, vé trả về `null` khi đã thu hồi (tương đương kiểm qua `ValidatePrincipal`), khóa tài khoản thu hồi ngay, mở khóa không làm sống lại phiên; test `SessionTests`, `AdminSafetyTests`, `OidcLoginTests` | — |
| 4 | Xử lý PDF chưa cách ly, chưa có timeout thật | **Đã xử lý (BE-93, AI-08).** Xác nhận ban đầu: quét ClamAV trước khi lưu đã có (SEC-05) nhưng **tắt mặc định**; dựng ảnh trang (PDFium) và đếm trang (PdfPig) chạy **trong tiến trình API**, dựng ảnh không có giới hạn thời gian; ở worker, `read()` của OCR bỏ qua `timeout_seconds` (TODO AI-08) và hạn của job chỉ được ghi chứ không ai cưỡng chế, trong khi luồng heartbeat vẫn báo sống nên `StaleJobReaper` không thu hồi job treo | BE-93, AI-08 |
| 5 | Tải trùng lộ metadata của tài liệu ngoài phạm vi | **Đã xử lý (BE-92). Xác nhận ban đầu:** chuyên viên phòng KT tải lại đúng PDF đang nằm trong hộp tiếp nhận riêng của chuyên viên phòng HT, nhận 409 kèm `documentId`, `fileId`, tên tệp gốc ("Don-xin-ly-hon-Nguyen-Van-A.pdf") và giờ tải | BE-92 |
| 6 | Nhật ký truy cập có thể mất | **Đã xử lý (BE-94). Xác nhận ban đầu, kèm lỗi thêm:** hàng đợi `DropOldest` làm `TryWrite` luôn thành công nên bộ đếm `Dropped` **không bao giờ tăng** (xếp 10.050 dòng vào hàng đợi 10.000: `Dropped=0`); lỗi ghi CSDL bỏ cả lô; cột `access_events.user_role_id` không bao giờ được ghi (không biết dùng phân công nào khi xem/tải) | BE-94 |
| — | Cấu hình triển khai: MFA, khóa Data Protection, mã hóa kho/bản sao lưu, cổng dịch vụ dev mở mọi giao diện | Đúng: `docker-compose.dev.yml` publish `5432`, `8080`, `9000/9001`… trên mọi giao diện (đã đổi sang `127.0.0.1`); khóa Data Protection lưu thô nếu đặt `Auth:DataProtectionKeysPath` (nay có thể mã hóa bằng chứng thư và Production bắt buộc) | BE-95, BE-96, OPS |

### BE-90 · Phạm vi theo đúng phân công đang chọn ✅ · 2 ngày
- **Kết quả (migration 029):** `assignment_scope(user, mã phân công)` trả đúng một dòng (vai trò, cơ quan, đơn vị) nếu phân công còn hiệu lực và thuộc về người dùng (riêng: `user_roles.id`; ủy quyền: `d:<delegations.id>`; cả hai bên còn hoạt động, chưa thu hồi, chưa hết hạn). `scope_matches(user, dossier, mã phân công)`, `transition_dossier`, `assign_dossier` (nay tự kiểm phạm vi người giao, trước đây tin hoàn toàn vào API) và `my_queue` đều nhận **mã phân công** thay cho vai trò; **các hàm cũ nhận vai trò bị xóa hẳn**: lời gọi cũ truyền "manager" không khớp gì (an toàn khi lỗi) thay vì khớp nhầm. API: `ICurrentUser.RequireAssignment()`, `ScopeFilter`, `DossierCommands`, `DossierQueries`, `ArchiveHandler` truyền phân công đang dùng. SSE `dossier.changed` cũng theo phân công: kết nối của cùng một người chọn đơn vị khác không nhận (`IEventBus.Publish(..., assignment)`; nhận bù theo Last-Event-ID cũng lọc).
- **Test `AssignmentScopeTests` (4)** biến hai ca tái hiện được thành hồi quy: ủy quyền chỉ xem + phân công riêng đủ quyền → giao việc hồ sơ đơn vị kia **404** (trước đây 200), dùng chính ủy quyền thì đọc được nhưng giao việc 403, mở rộng ủy quyền thì giao được, thu hồi thì dừng; kiêm nhiệm hai đơn vị → chọn đơn vị nào thấy đúng hồ sơ đơn vị đó ở chi tiết, danh sách, tra cứu (trước đây chọn HT vẫn thấy hồ sơ VP); mã sai dạng, của người khác, hết hạn, người ủy quyền bị khóa đều không khớp ở tầng CSDL; chuyển bước/giao việc ở tầng CSDL bằng mã của người khác → HS001; SSE. Script kiểm `verify_after_020.sql` và các test cũ đã chuyển sang mã phân công.
- **Hành vi đổi:** mọi lời gọi SQL trực tiếp tới các hàm trên (script, báo cáo) phải truyền mã phân công thay cho vai trò.

### BE-91 · Kiểm lại quyền khi tải gói xuất ✅ · 0,5 ngày
- **Kết quả (migration 030):** gói ghi `requested_assignment`; mỗi lần tải kiểm: còn quyền tải tài liệu, đang dùng đúng phân công đã tạo (khác → 403 `export_wrong_assignment`, chọn lại là tải được, không thu hồi), và mọi hồ sơ trong gói còn trong phạm vi (mất → 403 `export_scope_changed`, gói chuyển `revoked`, các lần sau 410 `export_revoked`, nội dung bị xóa như gói hết hạn). `revoke_exports` được gọi khi kết thúc phân công, thu hồi ủy quyền, khóa tài khoản; gói đang đóng dở bị thu hồi thì worker không đưa về `ready` và xóa nội dung vừa ghi. Test `ExportRevocationTests` (4): ca thăm dò (hồ sơ sang hạn chế, vẫn tải được gói cũ) nay bị chặn.

### BE-92 · Tải trùng không lộ thông tin ngoài phạm vi ✅ · 0,5 ngày
- **Kết quả:** trùng với giấy tờ người tải **thấy được** thì giữ phản hồi cũ (mã giấy tờ, tên tệp, giờ tải để mở lại); ngoài phạm vi thì 409 `duplicate_file` **không có `details`** và ghi cảnh báo `duplicate_outside_scope`. Test `DuplicateUploadPrivacyTests` (2). **Rủi ro còn lại, chủ động giữ:** vẫn biết được "đúng tệp này đã có trong hệ thống" (phải có chính tệp đó trong tay); nếu cơ quan không chấp nhận thì đổi sang chống trùng theo đơn vị (bỏ `files_scan_sha256_uq` toàn cục).

### BE-93 · Cách ly xử lý PDF khỏi tiến trình API ✅ · 2 ngày
- **Kết quả:** đếm trang, cắt trang, đọc chữ ký, dựng ảnh (PdfPig, PDFium) chạy trong **tiến trình con** `HoSoSo.Api pdf-sandbox <lệnh>` (`PdfSandboxHost`; API chỉ là máy khách `PdfSandboxRunner`): PDF vào qua stdin, kết quả ra qua stdout. Cưỡng chế: hạn giờ (`PdfSandbox:TimeoutSeconds`, 30 giây), bộ nhớ làm việc (`MaxMemoryMb`, 1.536 MB, kiểm mỗi 100 ms, kèm giới hạn heap .NET), dung lượng kết quả (`MaxOutputMb`), số tiến trình đồng thời (`MaxConcurrency`, 2; vượt thì 503 `pdf_sandbox_busy`); quá giới hạn thì giết cả cây tiến trình và trả 422 (`pdf_too_large`). Môi trường của con được lọc: **không thừa hưởng** chuỗi kết nối, bí mật OIDC, khóa S3, khóa máy sao lưu (test kiểm). Không khởi động được con thì 503 `pdf_sandbox_unavailable`. `PdfSandbox:Mode=InProcess` chỉ để phát triển (test mặc định dùng cho nhanh); **Production bắt buộc `Process`** (BE-96). `PdfSandbox:Command` cho phép bọc thêm cgroup/systemd-run.
- **Test `PdfSandboxTests` (13):** chức năng thật qua tiến trình con (đếm, cắt, dựng WebP, chữ ký); phân biệt tệp hỏng và vượt giới hạn; tiến trình con **treo** bị giết sau 1 giây và hệ thống chạy tiếp; **ngốn RAM** bị giết; **xả dữ liệu vô hạn** bị giết; không rò bí mật; không khởi động được → 503; qua API: tải lên ghi số trang, xem trang trả WebP, giới hạn trang, PDF làm treo → 422 nhanh và API vẫn trả `/health/live`. Chi phí: mỗi lệnh khởi động một tiến trình (khoảng 0,2 giây); ảnh trang mặc định đã được nhớ nên chỉ trả lần đầu.
- **Chưa làm:** giới hạn bộ nhớ ở mức hệ điều hành (kiểm 100 ms là rào chắn thô; Production nên thêm `MemoryMax` qua `PdfSandbox:Command` hoặc cgroup), chạy tiến trình con bằng người dùng riêng không có quyền ghi kho tệp, seccomp/sandbox hệ điều hành; một PDF thật sự khai thác được PDFium vẫn chạy với quyền của người dùng chạy API.
- **AI-08 (worker, đã làm):** `runtime/watchdog.py`: OCR, dựng ảnh PDFium, đọc cấu trúc, phân loại chạy trong khối `guard(hạn)`; quá hạn thì ghi log `operation_stuck` rồi **thoát tiến trình (mã 75)**; launchd/systemd chạy lại, job dở mất heartbeat nên `requeue_stale_jobs` trả về hàng đợi sau 5 phút, tối đa 3 lần rồi `failed`. Trước đây tham số `timeout_seconds` của OCR bị bỏ qua và heartbeat vẫn báo sống nên job treo mãi. Test `test_watchdog.py` (4, gồm một tiến trình thật kẹt phải thoát mã 75 đúng hạn) và `test_pipeline.py`; 30/30 test worker qua, kể cả hợp đồng PostgreSQL.

### BE-94 · Nhật ký truy cập không mất dòng ✅ · 1,5 ngày
- **Kết quả (migration 031):** (1) thao tác đưa nội dung ra ngoài (xem/tải tệp, xem trang ở độ phân giải đọc, tạo và tải gói xuất, hồ sơ hạn chế) ghi **đồng bộ** trước khi trả nội dung (`IAccessLog.RecordDurableAsync`); không ghi được thì 503 `audit_unavailable`, không trả nội dung. (2) Dòng còn lại đi qua hàng đợi nhưng: `itemDropped` đếm **đúng** số dòng bị bỏ (trước đây `Dropped` luôn 0), thử lại theo `AccessLog:RetryDelaysMs` (1, 2, 4, 8, 15 giây), hết lượt mới tính là mất (`Failed`) và ghi nhận `LastLossAt`; chỉ số `hoso.access_log.dropped_total`, `failed_total`, `pending`; `/health/ready` báo Degraded trong 1 giờ sau lần mất; quản trị kỹ thuật nhận thông báo `accesslog.loss` (tối đa mỗi giờ một lần). (3) Mọi dòng ghi cột mới `assignment` (mã phân công đang dùng) và `user_role_id` (với phân công riêng). Test `AccessLogDurabilityTests` (5) mô phỏng CSDL hỏng bằng trigger.
- **Rủi ro còn lại:** dòng không nhạy cảm (tìm kiếm, xem danh sách) chỉ nằm trong bộ nhớ trong khoảng thử lại; tắt máy đột ngột mất phần đang chờ. Nếu cần bền tuyệt đối cho cả loại này thì dùng bảng outbox (đổi lấy một lần ghi CSDL mỗi request).

### BE-95 · Bắt buộc MFA cho phân công đặc quyền ✅ · 1 ngày
- **Kết quả:** `Auth:MfaRequiredRoles` (mặc định `technical_admin,chair,council,clerk`; để trống thì tắt), `Auth:MfaAmrValues` (otp, hwk, mfa...), `Auth:MfaAcrValues`, `Auth:MfaAcrRequest`. Đăng nhập OIDC đọc `amr`/`acr` của id_token và ghi claim `hoso_mfa` vào vé phiên. Phiên chưa qua MFA mà đang chọn phân công cần MFA: **quyền của phân công không được gắn**, mọi API trả 403 `mfa_required` kèm `stepUp: /api/v1/auth/login?mfa=true`, trừ `/me` (kèm `mfaRequired: true`) và `/auth/*`; phân công thường của cùng người vẫn dùng được. `/auth/login?mfa=true` gửi `acr_values` cho nhà cung cấp danh tính để nâng mức. `dev-login` mặc định coi như đã qua MFA (thử bằng `?mfa=false`). Test `MfaTests` (8) và 3 ca trong `OidcLoginTests` (id_token không `amr`, chỉ `pwd`, có `otp`, `acr` theo cấu hình, bước nâng mức).
- **Cần làm ở Keycloak (SEC-01):** bắt buộc OTP cho nhóm này và cấu hình để id_token có `amr`/`acr` (hoặc đặt `Auth:MfaAcrValues` theo mức LoA đang dùng). **Chưa thử với Keycloak thật.** Chưa bật MFA ở Keycloak mà để mặc định thì các phân công đó không dùng được: đặt `Auth:MfaRequiredRoles=` tạm trong giai đoạn chuyển tiếp nếu chấp nhận rủi ro.

### BE-96 · Kiểm cấu hình an toàn khi chạy Production ✅ · 0,5 ngày
- **Kết quả:** `ProductionSafety` chạy lúc khởi động ở Production: **lỗi (không khởi động)** khi `PdfSandbox:Mode=InProcess`; thiếu `Auth:DataProtectionKeysPath`; khóa Data Protection chưa được bảo vệ (thiếu `Auth:DataProtectionCertificatePath` mà không xác nhận bằng `Auth:AllowUnprotectedDataProtectionKeys=true`) hoặc tệp chứng thư không có; `Storage:S3:ServiceUrl` dùng `http://` tới máy ngoài mạng nội bộ (loopback, dải riêng, tên không dấu chấm hoặc đuôi `.local/.internal/.lan/.intranet` là nội bộ); `Antivirus:RequiredInProduction=true` mà `Antivirus:Enabled=false`. **Cảnh báo:** tắt chống virus, `FailOpen=true`, `Backup:IngestToken` ngắn hơn 32 ký tự (endpoint tắt âm thầm). Khóa Data Protection nay lưu mã hóa bằng chứng thư (`ProtectKeysWithCertificate`; mật khẩu `Auth__DataProtectionCertificatePassword`); test kiểm tệp khóa có `encryptedKey` và không có `<masterKey`, cookie vẫn dùng được. Test `ProductionSafetyTests` (19).
- **Chưa làm (ngoài backend):** mã hóa kho tệp và bản sao lưu ở mức hệ điều hành (mã hóa ổ đĩa/đối tượng), ghi vào sổ tay vận hành OPS-06.

**Ngoài backend (ghi để không sót):** SEC-01 (cấu hình MFA phía Keycloak, xem BE-95); OPS-06 (sổ tay: mã hóa đĩa kho tệp và bản sao lưu, bảo vệ thư mục khóa Data Protection, giới hạn bộ nhớ ở mức hệ điều hành cho tiến trình PDF). Đã làm: AI-08 (xem BE-93); `docker-compose.dev.yml` nay bind mọi cổng về `127.0.0.1`.

## P5 · Đấu nối AI: khay nền và ưu tiên (17/11/2026)

Phương án tốc độ và thiết kế mức ưu tiên ở `docs/tasks/ai.md`. Tóm tắt các mức:
- **1 · Làm ngay:** người dùng chỉ định hồ sơ hoặc giấy tờ.
- **3 · Tương tác:** đọc lại trang, tách văn bản, phân loại lại.
- **7 · Khay nền:** PDF mới tải lên.

Worker chỉ chạy khay nền khi không còn việc mức 1–3. Job nền đang đọc sẽ nhường chỗ sau trang hiện tại (AI-15).

**Trạng thái 17/11/2026:** BE-97, BE-98, BE-99, BE-100 đã xong và đã kiểm trên PostgreSQL thật: 314 test (299 qua, 15 bỏ qua vì cần S3 cục bộ, 0 lỗi). Thêm 26 test so với trước đợt này (288 → 314), ở `AiQueuePriorityTests`, `AiExtractTests`, `AiExtractLimitTests`, `AiQueueEtaTests`, `AiQueueEtaShareTests` và `AdminOpsTests`. Migration 032 và 033 đã áp vào `hoso_dev` (có sao lưu `data/db-backups/hoso_dev-truoc-032-033-*.dump`). Test `PdfSandboxTests+ApiTests` từng đỏ một lần khi chạy cả bộ trên máy đang thiếu RAM, chạy riêng và chạy lại cả bộ đều qua.

### BE-97 · Khay nền cho PDF mới tải ✅ · 0,5 ngày
- **Tệp:**
  - `database/migrations/032_ai_queue_priority.sql`;
  - `Application/Intake/IntakeHandler.cs`, `Domain/Entities/Processing.cs`, `Infrastructure/Persistence/ModelMapping.cs`;
  - `appsettings.json` (`Ai:BackgroundPriority`).
- **Làm:**
  1. Migration 032:
     - `ocr_jobs` thêm `prioritized_at timestamptz`, `prioritized_by uuid REFERENCES users(id)`, `preempted_count integer NOT NULL DEFAULT 0`;
     - chỉ mục hàng đợi đổi thành `(priority, coalesce(prioritized_at, created_at)) WHERE status = 'queued'`;
     - trigger `ocr_jobs_notify` báo `job_queued` cả khi đổi `priority`, không chỉ khi đổi `status`.
  2. Tải lên tạo job mức `Ai:BackgroundPriority` (mặc định 7) thay vì 3. Đọc lại trang và tách văn bản giữ mức 3.
  3. `QueuePositionAsync` xếp theo cùng thứ tự với worker: `priority`, rồi `coalesce(prioritized_at, created_at)`.
  4. Hộp tiếp nhận và `GET /jobs/{id}` trả thêm `queueKind` (`priority` | `interactive` | `background`).
- **Kiểm tra:**
  - tải PDF thì job ở mức 7;
  - có job mức 1 chen vào thì vị trí trong hàng của job nền tăng đúng;
  - đổi mức một job đang chờ thì có `NOTIFY job_queued`;
  - worker cũ chưa có AI-15 vẫn lấy được việc.

### BE-98 · Trích xuất ngay theo hồ sơ hoặc giấy tờ chỉ định ✅ · 1,5 ngày
- **Endpoint:**
  - `POST /api/v1/dossiers/{id}/ai/extract`: quyền `dossier.prepare`; hồ sơ ngoài phạm vi trả 404.
  - `POST /api/v1/documents/{id}/ai/extract`: quyền `intake.upload` **hoặc** `dossier.prepare` (người chuẩn bị hồ sơ cũng cần bấm được ở màn đối chiếu); giấy tờ ngoài phạm vi trả 404.
  - Body `{ "force": false }`; ở hồ sơ thêm `documentIds` (tùy chọn) để chọn một phần giấy tờ, giấy tờ không thuộc hồ sơ trả 400 `validation_failed`.
- **Tệp:** `Application/Intake/AiExtractHandler.cs` (mới), `Api/Endpoints/DossierEndpoints.cs`, `DocumentEndpoints.cs`.
- **Làm:**
  1. Với tệp quét chính của từng giấy tờ, xử lý theo trạng thái job:
     - **đang chờ:** đặt `priority = 1`, `prioritized_at = now`, `prioritized_by = người bấm`;
     - **đang chạy:** đặt `priority = 1` để job không bị nhường nữa;
     - **đã xong, không `force`:** giữ kết quả, trả `alreadyDone`;
     - **đã xong, có `force`:** tạo job `reclassify` mức 1, không OCR lại;
     - **lỗi, đã hủy hoặc chưa có job:** tạo job `read_classify` mức 1.
  2. Cập nhật bằng một câu lệnh có điều kiện trạng thái, như `JobsHandler.CancelAsync`, để không đè lên job vừa xong.
  3. Gọi hai lần không tạo job trùng: đã có job mức 1 đang chờ hoặc đang chạy thì trả lại job đó.
  4. Giới hạn:
     - tối đa `Ai:ExtractMaxDocuments` (50) giấy tờ mỗi lần, vượt thì 400 `validation_failed` (quy ước của API: lỗi dữ liệu vào là 400);
     - rate limit theo người dùng;
     - ghi nhật ký: `access_events.action` chỉ nhận các hành động xem/tải nên dùng log có cấu trúc `ai_extract` (kèm người và phân công do nhật ký yêu cầu gắn sẵn); người nâng mức lưu ở `ocr_jobs.prioritized_by`.
  5. Trả danh sách `{ documentId, jobId, outcome, queuePosition, etaSeconds }`. `outcome` là `raised`, `running`, `alreadyDone` hoặc `created`. Tiến độ dùng sự kiện SSE của job đã có.
- **Kiểm tra (tích hợp):**
  - hồ sơ có 4 giấy tờ (đang chờ mức 7, đang chạy, đã xong, lỗi) cho lần lượt `raised`, `running`, `alreadyDone`, `created`;
  - có `force` thì giấy tờ đã xong tạo job `reclassify`;
  - ngoài phạm vi trả 404, thiếu quyền trả 403, quá 50 giấy tờ trả 400;
  - gọi hai lần cho cùng hồ sơ không thêm job.

### BE-99 · Hàng đợi AI theo mức và ước tính thời gian chờ ✅ · 0,5 ngày
- **Tệp:** `Application/Admin/AdminOpsHandler.cs`, `Application/Intake/AiQueueEstimator.cs` (mới).
- **Làm:**
  1. Màn vận hành (`AiStatus`) đếm job đang chờ theo mức (làm ngay, tương tác, khay nền), tổng số lần nhường chỗ 24 giờ qua, và tuổi job nền lâu nhất.
  2. Ước tính thời gian chờ của một job đang chờ:
     - lấy tổng số trang chưa đọc của các job đứng trước, nhân giây/trang = trung vị giây/trang OCR 24 giờ qua (`ocr_pages.elapsed_seconds`, `method = 'ocr'`, cần ít nhất 3 trang) × tỉ lệ trang phải OCR (trang có lớp chữ gần như không tốn thời gian);
     - việc nền đang chạy chỉ chắn một trang nếu job cần ước tính là việc ưu tiên (worker nhường chỗ, AI-15);
     - cộng thời gian gợi ý trung bình;
     - chưa có số liệu thì trả `null`, không đoán.
  3. Dùng ước tính này ở BE-98, ở hộp tiếp nhận và ở `GET /jobs/{id}`.
- **Kiểm tra:** dữ liệu mẫu có 3 job đứng trước (2, 3, 1 trang chưa đọc) và trung vị 12 giây/trang thì ước tính khoảng 72 giây cộng thời gian gợi ý; không có số liệu thì `etaSeconds = null`.

### BE-100 · Trang vận hành cho biết mô hình đang chạy thật ✅ · 0,5 ngày
- **Vì sao:** mô hình đổi bằng cấu hình của worker (AI-13, AI-17), còn bảng `ai_models` chỉ là ghi nhận. Cần thấy ngay khi worker chạy khác với điều đã ghi.
- **Tệp:** `Application/Admin/AdminOpsHandler.cs`.
- **Làm:**
  1. `AiStatus` thêm `RunningModels`: các giá trị `ocr_jobs.model_version` của job hoàn tất trong 24 giờ, kèm số job và lần gần nhất.
  2. Cảnh báo `model_mismatch` khi mô hình phân loại đang chạy khác dòng `classifier` trong `ai_models`.
  3. Trang vận hành (FE-44) hiện mục này cạnh "Hàng đợi AI theo khay".
- **Kết quả:** `AiStatus.RunningModels` (mô hình thật của job hoàn tất 24 giờ qua, kèm số job) và `ModelMismatch` (so job gần nhất với dòng `classifier` trong `ai_models`; job chưa ghi mô hình thì bỏ qua). Test `AdminOpsTests`: worker còn chạy 4B trong khi `ai_models` ghi 1.7B thì có cảnh báo nêu cả hai tên; có job mới hơn chạy 1.7B thì hết cảnh báo mà 4B vẫn nằm trong lịch sử. **Chưa có chỗ hiện trên giao diện:** phần `runningModels`/`modelMismatch` chưa được đưa vào `AiQueuePanel` (FE-44).


## P6 · Sửa lỗi luồng tổng thể (17/11/2026)

Căn cứ: `artifacts/backend-review-2026-11-17/REPORT.md`. Mỗi task phải có test hồi quy kiểm hành vi đúng trước khi đánh dấu hoàn tất.

| Task | Phạm vi | Tiêu chí hoàn tất | Trạng thái |
|---|---|---|---|
| BE-101 | Hủy tệp có thể phục hồi | Commit metadata và hàng đợi trước khi xóa blob; lỗi kho/tiến trình được thử lại; không phục hồi tham chiếu tệp đã xóa | Hoàn tất |
| BE-102 | Sửa giấy tờ và chuyển bước đồng thời | Sửa/phân loại/xác nhận và thêm/gỡ giấy tờ dùng khóa thống nhất; không ghi sau khi đã trình | Hoàn tất |
| BE-103 | Đối chiếu metadata | Có bước xác nhận metadata có dấu vết; checklist/actions khớp SQL; không tự xác nhận dữ liệu cũ | Hoàn tất |
| BE-104 | Mượn trả và hủy | Chặn mượn hồ sơ đang/đã hủy; quyết định đối nghịch chỉ một bên thành công | Hoàn tất |
| BE-105 | Tìm kiếm trong phạm vi | Lọc quyền/bộ lọc trước LIMIT; không bỏ sót vì 5.000 kết quả ngoài phạm vi | Hoàn tất |
| BE-106 | Vòng đời preview | Ảnh khác kích thước cache không ghi blob mồ côi | Hoàn tất |
| BE-107 | Phân trang inbox | Cursor ổn định, lấy đủ trên 200 mục; cập nhật hợp đồng API và nơi dùng | Hoàn tất |
| BE-108 | Giảm truy vấn dư | Truy vấn riêng một lô, tính thứ hạng hàng đợi một lần, gom kiểm quyền SSE; kiểm đo trước/sau thích hợp | Hoàn tất |
| BE-109 | Kiểm thử và tài liệu | Test tích hợp PostgreSQL, build, hợp đồng frontend, hướng dẫn migration và trạng thái cuối | Hoàn tất |


**Kết quả triển khai:**

- **BE-101:** migration 034, `IDisposalProcessor` và worker xóa sau commit. Có kiểm thử lỗi commit ở cả bước chuẩn bị và bước hoàn tất, lỗi kho/thử lại, nội dung dùng chung. Hủy đồng thời dừng job OCR; chặn tạo job/đọc lại trang và gắn giấy tờ đã hủy vào hồ sơ khác. Trạng thái `executing` là đang xử lý, chưa báo hoàn tất.
- **BE-102:** `MutationLocks` giữ khóa giấy tờ rồi khóa hồ sơ theo thứ tự thống nhất; có kiểm thử cả sửa trước trình và trình trước sửa. Thêm/gỡ giấy tờ cũng tuân thủ khóa này.
- **BE-103:** `PUT /documents/{id}/metadata` với `version`; migration 035 lưu người/thời điểm/ghi chú, nhật ký ghi cả thay đổi. Checklist, danh sách, thành phần thủ tục và actions phản ánh `needs_review`. Sửa giá trị làm review về `pending`; dữ liệu cũ giữ nguyên trạng thái.
- **BE-104:** các thao tác mượn khóa cùng hồ sơ với hủy; chặn `executing`/`executed`; xmin bảo vệ quyết định mượn, đề nghị hủy và đợt nộp lưu. Kiểm thử approve/reject đồng thời chỉ tạo một quyết định/thông báo.
- **BE-105:** bỏ LIMIT toàn cục trong CTE tìm kiếm; kết quả và tổng được tính sau lọc phạm vi/bộ lọc. Kiểm thử một giấy tờ nhìn thấy được sau 5.001 kết quả xếp hạng cao ngoài phạm vi.
- **BE-106:** preview ngoài 800 px chỉ trả nội dung/ETag, không ghi kho. Cache 800 px khóa và kiểm lại tệp chưa hủy trước khi lưu tham chiếu.
- **BE-107:** inbox trả `Page<InboxItem>`, cursor theo thời điểm tải + ID tệp, mặc định 50/tối đa 200. Kiểm thử lấy đủ 201 tệp trùng thời điểm, không lặp, cursor sai trả 400; cập nhật nơi dùng trong test và OpenAPI. Frontend tiếp nhận hiện là dữ liệu mẫu; ghi rõ hợp đồng tích hợp trong task frontend.
- **BE-108:** đọc/tạo/đóng một lô chỉ truy vấn lô đó; hàng đợi sắp xếp một lần, cộng dồn số trang và tìm nhị phân; SSE dùng một truy vấn kiểm phạm vi cho mọi phân công đang nghe. Thử nghiệm cục bộ 10.000 job/1.000 lượt tra cứu: quét lại 115,47 ms, dựng chỉ mục + tra cứu 3,62 ms, kết quả giống nhau; đây là phép đo thuật toán, chưa phải benchmark tải production. Các test SSE/phân công và lô quét hiện có đạt.
- **BE-109:** build, kiểm thử PostgreSQL thật và hợp đồng OpenAPI; hướng dẫn áp dụng migration/vận hành được bổ sung ở `backend/README.md`. Migration chỉ chạy trên CSDL kiểm thử riêng, chưa áp dụng lên `hoso_dev`/production. Không tự xác nhận metadata cho dữ liệu đang có.

**Kiểm chứng:** `BackendReliabilityTests` có 12 ca hồi quy; `AiQueueModelTests` có 2 ca tính đúng/giới hạn. Lệnh kiểm toàn bộ: chạy từ `backend/`, đặt `HOSO_TEST_PG` trỏ PostgreSQL kiểm thử và `DOTNET_ROLL_FORWARD=Major`, rồi `dotnet test --solution HoSoSo.slnx --no-restore`. Lần chạy toàn bộ ngày 17/11/2026: **328 test, 313 đạt, 0 lỗi, 15 S3 bỏ qua** vì cần môi trường S3/MinIO riêng.

## P7 · API còn thiếu cho các màn frontend (rà soát 17/11/2026)

Tìm ra khi đối chiếu từng màn frontend với `openapi.json`. Màn nào ghi trong cột "Chặn" chưa làm trọn được nếu thiếu task này.

| Task | Việc | Tiêu chí hoàn tất | Chặn | Trạng thái |
|---|---|---|---|---|
| BE-110 | Danh sách người có thể giao cho một hồ sơ: chuyên viên trong đơn vị của hồ sơ (kể cả ủy quyền còn hạn), số hồ sơ mỗi người đang giữ và số quá hạn. Ví dụ `GET /dossiers/{id}/assignees` | Trưởng phòng gọi được (không cần `admin.users`); không lộ người ngoài đơn vị; ngoài phạm vi trả 404 | FE-31 | ✅ |
| BE-111 | Mở rộng `GET /dossiers`: lọc năm, người chủ trì, quá hạn, vị trí kho (`locationId`, gồm vị trí con); sắp xếp theo cột (mã, tên, hạn, cập nhật) mà vẫn phân trang keyset; xuất CSV theo cùng bộ lọc | Gửi đường dẫn có bộ lọc ra đúng kết quả; CSV không vượt phạm vi; 20.000 hồ sơ < 200 ms | FE-26, FE-36 | ✅ |
| BE-112 | `GET /search`: phân trang bằng cursor, lọc cơ quan ban hành | Trang 2 không lặp trang 1; tổng số vẫn chỉ tính trong phạm vi | FE-34 | ✅ |
| BE-113 | Phiên bản tệp của giấy tờ (bản quét, bản dẫn xuất, bản thay thế) và ghi nhật ký **in** (`access_events.action = print`), ví dụ `GET /files/{id}/download?purpose=print` | Chi tiết giấy tờ liệt kê đủ phiên bản; in ghi đúng một dòng nhật ký | FE-33 | ✅ |
| BE-114 | Trả vùng nguồn của trường AI (`source_region`: trang, khung toạ độ) trong `GET /documents/{id}/review`. Từ 18/11/2026 worker đã ghi `ai_field_suggestions.source_region` và `confidence` (hình dạng ở docs/03 mục giao kèo worker; hiện chỉ AI giả ghi, `scripts/dev-up.sh ai fake`), nên làm được ngay: thêm thuộc tính vào entity `AiFieldSuggestion`, sao sang `document_field_values.source_region` khi chấp nhận, trả trong `ReviewField` | Bấm trường làm nổi đúng vùng trên trang | FE-22, FE-23 | ✅ |
| BE-115 | Số liệu tổng hợp cho lãnh đạo: Chủ tịch UBND theo phòng (đang chuẩn bị, chờ kiểm tra, chờ ý kiến, quá hạn); lãnh đạo HĐND theo hoạt động (kỳ họp và nghị quyết, thẩm tra, giám sát và kiến nghị) | Mỗi con số chỉ đếm hồ sơ trong phạm vi phân công đang dùng | FE-47 | ✅ |
| BE-116 | Trả tên người đã xác nhận đầu văn bản (hiện chỉ có `metadataReviewedBy` là mã) | Màn đối chiếu hiện "Đã xác nhận bởi … lúc …" | FE-23 | ✅ |
| BE-117 | Tra nhật ký theo Mã lỗi người dùng gửi (`errorId` → mã tương quan → request) | Nhập Mã lỗi ra đúng request và người | LOG-08 | ✅ |
| BE-118 | (Đề xuất, cần rà bảo mật) `ActiveAssignmentMiddleware` nhận phân công từ cookie `hoso_assignment` khi thiếu header `X-Assignment-Id`, hoặc Caddy chuyển cookie thành header | `<img>`, `EventSource` và tải tệp trực tiếp dùng đúng phân công; frontend bỏ được đường vòng bằng `fetch` | FE-08, FE-22, FE-33 | ✅ |
| BE-119 | Trường dữ liệu đã đối chiếu của giấy tờ cho người chỉ có `document.view` (hiện `GET /documents/{id}/review` cần `document.edit`). Ví dụ `GET /documents/{id}/fields` chỉ đọc, kèm cờ "đã sửa so với AI" | Trưởng phòng, lãnh đạo mở Chi tiết giấy tờ thấy trường đã đối chiếu; không lộ trường của giấy tờ ngoài phạm vi | FE-33 | ✅ |
| BE-120 | Quản trị kỹ thuật (`processing.manage`) gỡ hàng đợi AI mà không cần phạm vi giấy tờ: danh sách việc, hủy việc đang chờ/chạy, chạy lại việc lỗi/đã hủy. `GET /admin/ai/jobs`, `POST /admin/ai/jobs/{id}/cancel`, `POST /admin/ai/jobs/{id}/retry` (rà soát 18/11: `/jobs/{id}` lọc theo phạm vi giấy tờ nên quản trị luôn nhận 404) | Hủy, chạy lại được; không chạy lại khi tệp đã hủy, đang có việc khác hoặc đã có lần đọc mới hơn; người không có quyền 403 | FE-44 | ✅ |
| BE-121 | Danh sách người dùng cho quản trị kèm số phân công sắp hết hạn (≤ 7 ngày) và ngày hết sớm nhất; `expiring=true` chỉ lấy những người đó; từng phân công có `endsSoon` | Chip vàng đúng người, đúng phân công | FE-42 | ✅ |
| BE-122 | Lọc thủ tục theo cấp thực hiện (`level`, không phân biệt hoa thường) và `GET /procedures/levels` (gộp cách ghi "Cấp xã"/"Cấp Xã" của nguồn) | Lọc ra đúng thủ tục; danh sách cấp không trùng | FE-35 | ✅ |
| BE-123 | `GET /me/logins`: các lần đăng nhập gần đây của chính mình (thời điểm, IP) | Chỉ thấy của mình, mới nhất trước | FE-42 | ✅ |
| BE-124 | Thông báo phân trang bằng con trỏ (`cursor` → `nextCursor`) | Đi hết các trang không sót, không trùng; lọc chưa đọc vẫn đúng | FE-40 | ✅ |
| BE-125 | Đóng lô quét khi còn lỗi ảnh: gửi `acceptOpenIssuesNote` (từ 10 ký tự) thì mọi lỗi đang mở thành "chấp nhận bỏ qua" kèm lý do và lô đóng, cùng một giao dịch; không gửi thì vẫn 409 kèm số lỗi để giao diện cảnh báo | Khớp yêu cầu FE-41 "cảnh báo nhưng vẫn cho đóng" mà không bỏ dấu vết | FE-41 | ✅ |
| BE-126 | Tải bản quét thay thế cho giấy tờ (phiên bản 2, 3…): `POST /documents/{id}/files` (multipart `file` + `reason` 10–500 ký tự), cần `document.edit` | Bản cũ giữ nguyên; bản mới là phiên bản kế tiếp, xếp việc đọc; cùng luật khóa với sửa dữ liệu; hộp tiếp nhận, lô quét, tìm kiếm vẫn đúng một bản hiện hành | FE-33 | ✅ |
| BE-128 | Ghi "Trích xuất ngay" vào nhật ký truy cập: một dòng `access_events` (`action = ai_extract`, `object_type = document`) cho mỗi giấy tờ mà lần bấm làm AI đọc sớm hơn (nâng mức hoặc tạo việc mới); migration 040 thêm hành động vào ràng buộc | Chỉ giấy tờ thật sự đổi mới có dòng (đang chạy, đã xong, bỏ qua thì không); dòng ghi người, phân công, giấy tờ | AI-21 | ✅ |
| BE-129 | Hộp tiếp nhận lọc trên toàn hộp: `GET /intake/inbox?read=&batch=&group=&type=` (tình trạng đọc, lô quét, nhóm và loại của gợi ý AI mới nhất) và `GET /intake/inbox/summary` (số theo tình trạng đọc, cùng lô/nhóm/loại) | Trang sau không lặp và không thiếu khi đang lọc; số đếm không bị `read` làm lệch; giá trị `read` sai trả lỗi theo trường | FE-21 | ✅ |
| BE-130 | `DossierDetail.retention`: thời hạn bảo quản áp cho hồ sơ (`confirmed`, `proposed`, `ambiguous`, `none`), kèm ngày đủ hạn khi đã lưu trữ; dùng chung luật chọn quy tắc với đề nghị hủy | Đề xuất chưa xác nhận không có hiệu lực; nhiều quy tắc chưa gán thì không đoán | FE-28 | ✅ |
| BE-131 | LOG-05: `audit_events.correlation_id` (migration 041). Bộ chặn EF đặt `hoso.correlation_id` cho từng kết nối từ mã tương quan của request, trigger `audit_change()` đọc vào cột mới (chỉ mục từng phần); `GET /admin/logs/changes?correlationId=` lọc theo mã và mỗi dòng trả `correlation_id` | Từ một dòng thay đổi tra ngược ra request gây ra nó và từ request ra mọi thay đổi; thay đổi ngoài request (job, script) để trống | LOG-08 | ✅ 19/11/2026 |
| BE-132 | AI-10: view `v_ai_accuracy` (migration 042): theo mô hình, nhóm, loại giấy tờ, trường, đếm số gợi ý đã **chấp nhận nguyên**, **sửa**, **xóa trắng**, **bỏ sót** (AI không đoán mà cán bộ điền) và `accepted_rate`; chỉ tính trường đã đối chiếu (`verified`); cấp `SELECT` cho `hoso_api`, `hoso_readonly` | So gợi ý AI mới nhất với giá trị cán bộ đã xác nhận; trường chưa đối chiếu không lọt vào | AI-10 | ✅ 19/11/2026 |
| BE-133 | AI-24: trạng thái máy AI. Entity `AiWorker` (bảng `ai_workers`, migration 044, worker tự ghi; API chỉ có quyền đọc). `AiAvailabilityQuery`: `ok` · `engine_down` (worker sống nhưng máy chạy mô hình không trả lời, kèm lúc bắt đầu) · `no_worker` (không worker nào báo nhịp trong 2 phút, kèm lần cuối thấy); worker bản cũ đang giữ việc có heartbeat mới vẫn tính là hoạt động. `GET /api/v1/ai/availability` (chỉ cần đăng nhập, không trả chi tiết kỹ thuật); `GET /admin/ai/status` thêm `availability` và `machines` (từng worker, lỗi cụ thể). `PgNotificationListener` nghe `ai_worker_status` → SSE `ai.availability` tới mọi người đang mở (không kèm chi tiết). `AiQueueHealthCheck` dựa trên `ai_workers`: Degraded khi có việc chờ mà mọi worker sống báo máy AI hỏng quá 2 phút, hoặc việc chờ quá 10 phút mà không worker nào sống (trước đây bật tắt theo lần gọi). Kèm: EF ghi `CommandError`, `SaveChangesFailed`, `QueryIterationFailed` ở Warning (lỗi nghiệp vụ đã thành 409/422 không còn là Error giả; lỗi thật vẫn có một dòng Error từ `GlobalExceptionHandler`); migration 043 tắt `qwen_vl` trong `ai_models` | Người dùng thường không thấy địa chỉ máy hay thông điệp lỗi; quản trị thấy đủ | AI-24, FE-49 | ✅ 19/11/2026 (`AiAvailabilityTests` 5 ca: không worker, worker im lặng, máy AI hỏng + health Degraded + chi tiết chỉ ở admin, một worker còn tốt, worker bản cũ, SSE tới hai người, chưa đăng nhập 401) |

### Kết quả P7 (18/11/2026)

**Bổ sung 18/11/2026 (rà soát tổng thể lần 2):** BE-120…126 và sửa ca chậm nhất của BE-111. Test mới: `AdminJobsTests`, `AccountAndNotificationTests`, `ScopePrefilterTests`, `ScanReplacementTests`, thêm ca trong `QualityTests`, `AdminTests`, `ProceduresTests`. Chạy lại toàn bộ: **381 test, 366 đạt, 0 lỗi, 15 bỏ qua** (cần S3 cục bộ). OpenAPI và `frontend/src/api/schema.d.ts` đã sinh lại (119 đường dẫn), `tsc` frontend sạch. Migration mới `039` (bản quét thay thế, BE-126) đã áp lên `hoso_dev` (sao lưu `data/db-backups/hoso_dev-truoc-039-*.dump`).

Mỗi task có test tích hợp riêng trong `backend/tests/HoSoSo.Api.IntegrationTests/`. Toàn bộ bộ test backend chạy một lượt (367 test): **351 đạt, 15 bỏ qua** (cần S3 cục bộ), 1 lỗi là ngưỡng hiệu năng của ca "xấu nhất" đặt quá chặt khi chạy song song; đã nới lên 3 giây và chạy lại riêng lớp đó (3/3 đạt), chưa chạy lại cả bộ sau chỉnh này. Lần chạy đầu bắt được thiếu entity `ErrorEvent` (test "mọi bảng có entity"), đã sửa. Hợp đồng OpenAPI và `frontend/src/api/schema.d.ts` đã sinh lại. Migration mới `037`, `038` đã áp lên `hoso_dev` (có sao lưu `data/db-backups/hoso_dev-truoc-036-038-*.dump`; `036` là migration IFStruct có từ trước nhưng chưa áp).

- **BE-110 · `GET /dossiers/{id}/assignees`** (`dossier.assign`): khớp ĐÚNG quy tắc hàm SQL `assign_dossier` (nơi quyết định cuối): người dùng còn hoạt động có phân công **riêng** "chuyên viên" còn hiệu lực ở đúng cơ quan và phòng của hồ sơ. **Ủy quyền không được tính**: đề bài ghi "kể cả ủy quyền còn hạn" nhưng `assign_dossier` từ chối người chỉ có ủy quyền, nên đưa họ vào danh sách là mời chọn người mà lúc giao bị từ chối. `holding` = hồ sơ họ chủ trì chưa lưu trữ (đếm trên cả phòng: số liệu, không phải nội dung); `overdue` = hạn nội bộ trước hôm nay giờ Việt Nam (`VietnamTime.Today`). Ngoài phạm vi: 404; chuyên viên: 403; không lộ email hay tên đăng nhập. Test có kiểm: mọi người trong danh sách đều giao được, người ngoài danh sách bị từ chối.
- **BE-111 · danh sách hồ sơ**: bộ lọc `Year`, `Assignee`, `Overdue`, `LocationId` (gồm vị trí con), `Sort` (`updated|code|title|due`) + `Dir`; phân trang keyset theo cột (`SortCursor`: con trỏ của cột/chiều khác thì 400; hồ sơ chưa có hạn luôn xếp cuối ở cả hai chiều). `Status` và `WorkGroup` nhận nhiều giá trị cách nhau dấu phẩy (tối đa 12) để bảng tổng hợp (BE-115) liên kết ra đúng con số. **`GET /dossiers/export.csv`** cùng bộ lọc và thứ tự: cần `export.create`; UTF-8 BOM; RFC 4180; chống CSV injection (ô bắt đầu bằng `= + - @` được đặt dấu `'`); ghi nhật ký **đồng bộ** (`export`, `dossier_list`) trước khi trả; quá 10.000 dòng thì 422 `export_too_large` thay vì cắt âm thầm. Migration `038` thêm chỉ mục sắp theo tên và hạn.
  - **Hiệu năng đã đo (20.000 hồ sơ, trung vị 5 lần, `DossierListPerformanceTests`):** mọi trường hợp người dùng thấy phần lớn hồ sơ đều **3–8 ms** (mặc định, theo mã, theo tên, theo hạn giảm dần, lọc năm, người chủ trì, quá hạn, kết hợp, từ khóa, trang sâu ở dòng ~15.000). Trước khi có chỉ mục, sắp theo tên và theo hạn giảm dần mất **~355 ms**.
  - **Trường hợp xấu nhất đã sửa (18/11/2026):** người gần như không thấy hồ sơ nào trong 20.000 (ví dụ trưởng phòng Kinh tế khi mọi hồ sơ thuộc Hạ tầng) trước mất **~350 ms** (~1,1 giây khi chạy song song) vì PostgreSQL gọi `scope_matches` cho từng dòng đi qua chỉ mục sắp xếp. `ScopeFilter.Dossiers` giờ đặt trước hàm một **điều kiện cần** so với tham số lấy từ chính phân công đang dùng (cơ quan, phòng; quản trị kỹ thuật không thấy gì; chuyên viên chỉ hồ sơ mình chủ trì hoặc đang phối hợp), nên PostgreSQL loại sớm theo chi phí. Đo lại: **2–4 ms** ở cả ba kiểu sắp xếp; test đã chặn ở 200 ms (tiêu chí). Quyết định vẫn là `scope_matches` (luôn AND), nên điều kiện này không thể làm lộ hồ sơ; nếu sau này NỚI quy tắc trong SQL mà quên nới ở đây thì người dùng **thiếu** hồ sơ (không thừa). `ScopePrefilterTests` so danh sách API với `scope_matches` cho **mọi** phân công mẫu, kể cả ủy quyền chéo phòng, phối hợp đang hiệu lực và đã kết thúc. Lưu ý: cách thử đầu (nối với hàm bảng `assignment_scope`) **không** có tác dụng vì PostgreSQL vẫn đẩy `scope_matches` xuống tầng quét trước phép nối.
- **BE-112 · `GET /search`**: thêm `Cursor` và `Issuer`. Giữ nguyên hình dạng phản hồi (một mục giấy tờ xếp theo độ khớp, một mục hồ sơ xếp theo mới cập nhật) với **một** con trỏ mang vị trí của cả hai dòng (`SearchCursor`); `nextCursor` null khi hết; tổng số không đổi giữa các trang và chỉ tính trong phạm vi. `Issuer`: khớp đúng mã cơ quan hoặc tên cơ quan có chứa chuỗi (không dấu); chỉ áp cho giấy tờ nên bỏ phần hồ sơ.
- **BE-113 · phiên bản tệp và in**: `DocumentDetail.files` (`FileVersionDto`: loại `original|replacement|derivative|signed`, `isCurrent`, `disposed`, người nạp; không lộ khóa kho). `GET /files/{id}/download?purpose=print` cần `document.print` (quyền riêng, tách khỏi tải), mở tại chỗ và **không hỗ trợ Range** để một lần in là đúng một dòng nhật ký `print` (ghi đồng bộ trước khi trả); điểm vào nhận cả hai quyền nên kiểm lại đúng quyền theo mục đích (người chỉ có quyền in không tải về được). API chưa có thao tác tạo phiên bản thay thế (cột `version_no` đã sẵn).
- **BE-114 · vùng nguồn**: `AiFieldSuggestion.SourceRegion` và `DocumentFieldValue.SourceRegion` (jsonb, sao sang khi chấp nhận gợi ý đúng loại); `ReviewField.sourceRegion` (`SourceRegionDto`: trang, x, y, width, height theo tỉ lệ trang, `approximate`) và `confidence`. Vùng sai hình dạng bị bỏ (trường vẫn dùng được), khung vượt mép được cắt về mép. Hiện chỉ AI giả ghi (AI-21 cho bản MLX).
- **BE-115 · `GET /workspace/leadership`** (`dossier.decide`): một truy vấn gom nhóm trên `scope.Dossiers`; Chủ tịch UBND nhận `departments` (mọi phòng của cơ quan, kể cả phòng chưa có hồ sơ), lãnh đạo HĐND nhận `activities`. **Cần chủ nghiệp vụ xác nhận** (bảng `HdndActivities` trong `LeadershipSummary.cs`): kỳ họp và nghị quyết = H01–H02; thẩm tra của các Ban = H03–H04; giám sát và kiến nghị = H05–H08 (giám sát, chất vấn, kiến nghị cử tri, đơn thư); còn lại (H09, H10 và nhóm mới thêm) vào "other". "Đang chuẩn bị" = nháp + yêu cầu bổ sung; "Quá hạn" nằm TRONG "Đang xử lý", không cộng thêm.
- **BE-116**: `DocumentDetail.metadataReviewedByName`.
- **BE-117 · `GET /admin/errors`** (`admin.settings`): bảng `error_events` (migration `037`) ghi nền mỗi Mã lỗi đã trả (mã tương quan, trạng thái, phương thức, đường dẫn **không kèm chuỗi truy vấn**, người, phân công; không có thân request hay thông điệp ngoại lệ); giữ 90 ngày (`SessionCleanupService` dọn). Tra theo Mã lỗi (không phân biệt hoa thường, kiểm đúng 8 ký tự hex), mã tương quan, người, thời gian; kèm các lần truy cập cùng mã tương quan. Mất dòng là chấp nhận được vì log máy chủ vẫn có cùng Mã lỗi.
- **BE-118 · phân công từ cookie** (đã rà bảo mật, `ActiveAssignmentMiddleware`): chỉ **GET** và chỉ khi thiếu header; **header luôn thắng và sai vẫn 403**; cookie sai, cũ, của người khác hoặc đã thu hồi bị **bỏ qua** (dùng phân công mặc định, không 403, tránh lặp lỗi FE-46) vì phép kiểm giống hệt header nên cookie giả không nâng được quyền; request ghi không bao giờ lấy phân công từ cookie. Phản hồi `/api` đều `no-store` nên không có rủi ro cache lẫn phân công. Rủi ro còn lại: kẻ chèn được cookie vào miền (cookie tossing) chỉ chọn được phân công khác **của chính nạn nhân** cho request đọc.
- **BE-119 · `GET /documents/{id}/fields`** (`document.view`): theo loại ĐÃ xác nhận, không kèm giá trị AI gợi ý hay trích dẫn thô; `editedFromAi` chỉ đúng khi AI đã có giá trị mà người dùng đổi hoặc xóa (AI để trống rồi người dùng tự điền thì `origin = manual`, không tính là sửa).
- **BE-120 · việc AI cho quản trị** (`AdminJobsHandler`): danh sách mới nhất trước, lọc `status=active|queued|running|failed|cancelled|completed`, phân trang con trỏ; mỗi dòng chỉ có **tên tệp** (không tiêu đề, không nội dung giấy tờ), số lần thử thật (`attempt − preempted_count`), mức hàng đợi, người yêu cầu, `retryOf`, `canCancel`, `canRetry` và `retryBlockedReason` để giao diện khóa nút kèm lý do. **Chạy lại tạo việc MỚI** (việc lỗi giữ nguyên làm lịch sử) cùng tệp, cùng loại, chép tùy chọn (giữ `target_job_id` của đọc lại trang/phân loại lại), thêm `retry_of`, mức tương tác; khóa giấy tờ rồi khóa tệp theo đúng thứ tự của "Trích xuất ngay". 409 khi tệp đã hủy nội dung, tệp đang có việc chờ/chạy, hoặc đã có việc cùng loại mới hơn (chạy lại việc cũ sẽ ghi đè kết quả mới). `/jobs/{id}` của người dùng giữ nguyên (lọc phạm vi).
- **BE-121**: `AdminUserListItem.expiringAssignments`, `nextAssignmentEndsAt`; `AdminAssignmentDto.endsSoon`; `GET /admin/users?expiring=true`. Ngưỡng 7 ngày ở `AdminHandler.ExpiringWithinDays`.
- **BE-122**: dữ liệu nguồn có 436 thủ tục không ghi cấp, "Cấp xã" và "Cấp Xã" lẫn nhau; nhãn mỗi nhóm là cách ghi phổ biến nhất. Lọc khớp nguyên cụm (chọn "Cấp xã" không ra "Cấp tỉnh, cấp xã").
- **BE-123**: lấy từ `access_events` (`login`); chưa có trình duyệt/thiết bị vì bảng không lưu user-agent.
- **BE-124**: `NotificationList.nextCursor`; con trỏ theo (thời điểm tạo, id) như các danh sách khác.
- **BE-125**: `POST /intake/batches/{id}/close` nhận thân tùy chọn `{ acceptOpenIssuesNote }`; khóa dòng lô (`FOR UPDATE`) để hai người cùng đóng hoặc vừa mở lỗi mới thì xử lý tuần tự; mô tả lỗi ghi thêm "Chấp nhận khi đóng lô: …", người và thời điểm xử lý.
- **BE-126 · bản quét thay thế** (migration `039`; `IntakeHandler.ReplaceScanAsync`, `DocumentFiles`): `files.replaces_file_id` (khóa ngoại hai cột nên chỉ trỏ tới tệp CÙNG giấy tờ; mỗi bản chỉ bị thay một lần, chuỗi thẳng) và `files.replacement_reason` (bắt buộc 10–500 ký tự, có CHECK trong CSDL). **Bản hiện hành = bản quét chưa bị bản nào thay** (`DocumentFiles.CurrentScans`); chi tiết giấy tờ, tách văn bản, hộp tiếp nhận (một dòng mỗi giấy tờ), lô quét (số tệp, số trang) đều dùng định nghĩa này. Bản cũ **không bị xóa hay sửa**: vẫn mở/tải được, và các trường đã đối chiếu vẫn trỏ vùng nguồn trên bản cũ (`source_file_id`); `ReviewField.sourceFileId` và `DocumentFieldView.sourceFileId` cho biết vùng thuộc bản nào để giao diện mở đúng bản (khác `file.id` khi giấy tờ đã được thay).
  - **Ba quyết định đã chốt (theo đề xuất 18/11/2026; người dùng chưa phản đối, cần xác nhận lại nếu muốn khác):** (1) AI chỉ phân loại/trích lại khi giấy tờ còn ở **hộp tiếp nhận**; đã vào hồ sơ thì chỉ OCR để tìm kiếm (`options.classify=false`) để không đè gợi ý đã đối chiếu. (2) Trường đã đối chiếu giữ vùng trên bản cũ, không tự dời sang bản mới; muốn vùng mới thì sửa trường hoặc để AI đọc lại khi còn ở hộp tiếp nhận. (3) Lý do bắt buộc, lưu ở `replacement_reason`.
  - Luật: cùng khóa `MutationLocks.DocumentAndDossiersAsync` và cùng điều kiện khóa sửa với dữ liệu giấy tờ (`DocumentEditRules.LockReasonAsync`: không phải văn bản công khai, không bị bỏ/tách, hồ sơ chứa nó chỉ ở nháp hoặc bị trả lại). 409 khi giấy tờ chưa có bản quét, nội dung đã hủy, hoặc **trùng SHA-256** một bản đã có (trùng chính giấy tờ này: "không cần thay"; trùng giấy tờ khác thì theo BE-92, chỉ chỉ đường khi người tải thấy được nó). Cùng giới hạn tải lên (kích thước, số trang, quét virus, rate limit) như tải PDF mới.
  - Kèm theo trong cùng giao dịch: hủy việc đọc còn chờ/đang chạy của bản cũ; đóng các lỗi ảnh đang mở của bản cũ (ghi "Đã thay bằng bản quét phiên bản N: lý do") và đặt trang nghi ngờ thành `rescanned` để lô không bị chặn đóng; giấy tờ đã xác nhận dữ liệu thì về `pending` (người dùng phải đối chiếu lại); bản mới cùng lô quét với bản cũ, lô đã đóng thì cập nhật số trang theo bản hiện hành. Tìm kiếm toàn văn bỏ trang của bản bị thay **khi bản mới đã đọc xong** (chưa xong thì tạm dùng chữ bản cũ để giấy tờ không "biến mất" khỏi tìm kiếm).
  - Chưa làm: xóa/hoàn tác một lần thay (đã thay thì bản mới là hiện hành; muốn quay về cần thay lại bằng chính tệp cũ, nhưng bị chặn trùng SHA-256 — nếu cần, làm thao tác "khôi phục bản trước" riêng); thay thành phần phụ (`component_key` khác `main`) chưa có đường vào.

- **BE-128 · nhật ký "Trích xuất ngay"** (migration `040`, `AiExtractHandler`): trước đây chỉ có log có cấu trúc và `ocr_jobs.prioritized_by` (mất khi việc được tạo mới hay nâng lại) nên không truy được "ai bấm cho giấy tờ nào". Nay mỗi giấy tờ có kết quả `raised` hoặc `created` ghi một dòng qua `IAccessLog.Record` (hàng đợi nền có thử lại, không chặn request; đây không phải nội dung rời khỏi hệ thống nên không cần ghi đồng bộ). Bấm lại nhiều lần thì mỗi lần một dòng: mỗi lần bấm là một hành động. Test `AiExtractTests` (thêm 1 ca).

- **BE-129 · lọc hộp tiếp nhận** (`IntakeHandler.InboxAsync`, `InboxSummaryAsync`, `InboxFilter`): trước đây giao diện chỉ lọc "tình trạng đọc" trong phần đã tải nên với vài trăm PDF lọc sai. Nay lọc trong truy vấn, TRƯỚC khi phân trang: `read` (một hoặc nhiều giá trị cách nhau dấu phẩy: queued | reading | ready | failed | cancelled, theo việc đọc MỚI NHẤT của tệp; chưa có việc thì tính là queued), `batch` (lô quét của tệp), `group` và `type` (nhóm, loại của gợi ý AI MỚI NHẤT). `summary` đếm theo tình trạng đọc cùng lô/nhóm/loại nhưng không áp `read` để các nút lọc luôn hiện đủ số. Hộp vẫn chỉ của người tải (người khác thấy 0). `read` sai trả `validation_failed` theo trường. Test `InboxFilterTests` (6 ca, mỗi ca dùng lô riêng vì cả lớp dùng chung CSDL).
- **BE-130 · thời hạn bảo quản trong chi tiết hồ sơ** (`DossierQueries.RetentionOfAsync`, dùng lại `DisposalHandler.Resolve`): quy tắc đã gán cho hồ sơ, nếu chưa thì quy tắc đã xác nhận duy nhất của nhóm; quy tắc không ghi số năm bị bỏ như ở đề nghị hủy. `EligibleSince` = ngày lưu trữ + số năm, chỉ khi đã lưu trữ. Test `DossierRetentionTests` (5 ca).
