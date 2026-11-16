# Backend · HoSoSo API (.NET 10)

ASP.NET Core trên .NET 10 LTS, EF Core 10 + Npgsql, PostgreSQL 16.

- Kiến trúc: [docs/02-kien-truc-server.md](../docs/02-kien-truc-server.md)
- Cơ sở dữ liệu: [docs/03-thiet-ke-csdl.md](../docs/03-thiet-ke-csdl.md)
- Task: [docs/tasks/backend.md](../docs/tasks/backend.md)
- Bảo mật: [docs/05-bao-mat.md](../docs/05-bao-mat.md)
- Log: [docs/06-log-va-giam-sat.md](../docs/06-log-va-giam-sat.md)

> **Đã build và kiểm thử** với SDK 11.0.100 nhắm `net10.0`: 288 test qua trên PostgreSQL 16 thật (15 trong số đó cần một máy chủ tương thích S3 cục bộ, xem mục "Kho tệp S3"; không có thì được bỏ qua) (xem [docs/tasks/backend.md](../docs/tasks/backend.md) mục "Kết quả kiểm chứng").

## .NET SDK

Dự án nhắm **.NET 10 LTS** (`net10.0`) vì Npgsql chưa có bản ổn định cho EF Core 11. Máy dev có SDK 11 vẫn build được:
`global.json` đặt `rollForward: latestMajor`. Máy chỉ có runtime 11 (chưa cài runtime 10) thì khi chạy hay test cần
`DOTNET_ROLL_FORWARD=Major`; máy chủ thật dùng runtime 10 nên không cần. `dotnet test` dùng Microsoft.Testing.Platform (cấu hình trong `global.json`).

```sh
export PATH=/usr/local/share/dotnet:$PATH      # nếu shell chưa thấy dotnet
```

## Chạy khi dev

```sh
docker compose -f ../docker-compose.dev.yml up -d postgres   # PostgreSQL 16 (hoặc PostgreSQL cài sẵn)
dotnet run --project src/HoSoSo.Api -- migrate --dry-run     # chỉ liệt kê script sẽ chạy
dotnet run --project src/HoSoSo.Api -- migrate               # chạy migration trong database/migrations
dotnet run --project src/HoSoSo.Api                          # http://localhost:5080, tài liệu API: /docs
```

Migration `*_optional.sql` (dữ liệu mẫu 004, 007, 021) mặc định chạy ngoài Production; đặt `Database:OptionalSeeds=["004"]` để chọn đúng tệp.
**Với CSDL dev có sẵn dữ liệu (như `hoso_dev`) đừng chạy `migrate` trần**: nó nạp luôn mọi tệp `*_optional.sql` chưa có trong nhật ký (kể cả 004: người dùng và hồ sơ GIẢ LẬP). Dùng `scripts/migrate-hoso-dev.sh` (mặc định chỉ liệt kê; thêm `--apply` để chạy thật) rồi sao lưu trước bằng `pg_dump -Fc -n hoso -n public`. **Muốn khôi phục bản dump đó phải tạo extension trước và bỏ mục `CREATE SCHEMA public`** (xem [ops/backup/README.md](../ops/backup/README.md)).

## Đăng nhập thử khi dev

Môi trường Development dùng `Auth:Mode=Dev`: mở `/api/v1/auth/login` để chọn người dùng GIẢ LẬP (cột `users.is_demo`), hoặc gọi thẳng
`/api/v1/auth/dev-login?username=<tên>`. Tài khoản quản trị dev là `dev_admin` (xem migration `021_dev_admin_optional.sql`); có 18 phân công để thử mọi vai trò.
`technical_admin` quản trị người dùng/cấu hình nhưng **không đọc nội dung hồ sơ** theo thiết kế; đổi sang phân công khác để xem hồ sơ.

CSDL dev đã cài từ trước bằng `database/install.sql` (chưa có nhật ký DbUp) thì đánh dấu baseline một lần rồi nâng cấp:

```sh
dotnet run --project src/HoSoSo.Api -- migrate --baseline 000,001,002,003,007   # đúng những script đã thật sự chạy
dotnet run --project src/HoSoSo.Api -- migrate --dry-run
dotnet run --project src/HoSoSo.Api -- migrate
```

## Chạy test

Test tích hợp cần PostgreSQL thật. Hai cách:

```sh
# 1) PostgreSQL có sẵn (không cần Docker): mỗi lớp test tạo CSDL riêng bằng CREATE DATABASE ... TEMPLATE
HOSO_TEST_PG="Host=127.0.0.1;Port=5432;Username=postgres" dotnet test --solution HoSoSo.slnx
# 2) Docker: bỏ trống HOSO_TEST_PG, Testcontainers tự dựng postgres:16-alpine
dotnet test --solution HoSoSo.slnx
```

Không có PostgreSQL lẫn Docker thì các test cần CSDL được **bỏ qua** (skip) kèm lý do, không báo đỏ giả.

### Kho tệp S3 và đăng nhập OIDC khi test

- **S3/MinIO:** đặt `HOSO_TEST_S3_URL` (ví dụ `http://127.0.0.1:9000`) trỏ tới một máy chủ tương thích S3 cục bộ để chạy 15 test kho S3 (cần quyền tạo bucket; khóa thử `HOSO_TEST_S3_ACCESS`/`HOSO_TEST_S3_SECRET`, mặc định `test`/`test`). Không đặt thì các test này báo "bỏ qua".
  Lần kiểm chứng gần nhất dùng emulator `moto` (`pip install 'moto[server]'`, `moto_server -p 5099`), **chưa chạy với MinIO hay AWS S3 thật**.
- **OIDC:** test `OidcLoginTests` chạy luồng đăng nhập thật qua một nhà cung cấp OIDC giả theo đúng giao thức (`Support/FakeOidcProvider.cs`), không cần Keycloak. Nó không thay việc thử trên Keycloak của cơ quan.
Kiểm tra worker Python với CSDL: xem [ai-worker/README.md](../ai-worker/README.md).

`appsettings.Development.json` đặt `Auth:Mode=Dev`:
- mở `http://localhost:3000/dang-nhap` (frontend với `HOSO_MOCK=0`), hoặc mở thẳng `http://localhost:5080/api/v1/auth/login`, để chọn tài khoản mẫu;
- API từ chối khởi động nếu bật Dev ở môi trường khác Development.

## Cấu trúc

```
backend/
├─ HoSoSo.slnx · global.json · Directory.Build.props · Directory.Packages.props
├─ database/migrations/          SQL chạy bằng DbUp theo thứ tự tên tệp (001… baseline, 008… mới)
├─ src/
│  ├─ HoSoSo.Domain/             Identity (quyền, vai trò mặc định) · Workflow · Entities (thực thể ánh xạ bảng)
│  ├─ HoSoSo.Application/        Use case theo module: Catalog, Dossiers, Intake (lô quét, tải lên, job), Documents (đối chiếu, tách, chữ ký),
│  │                             Operations (kho bản giấy, mượn trả, nộp lưu, xuất gói, hủy), Procedures, Search, Admin, Notifications
│  ├─ HoSoSo.Infrastructure/     HoSoDbContext + ModelMapping, ScopeFilter, IdentityService, DatabaseMigrator, LocalFileStorage,
│  │                             Messaging (LISTEN, outbox, bus SSE, thu hồi job treo, nhắc hạn, ExportWorker), Auditing (nhật ký truy cập), Health,
│  │                             Pdf (đếm/cắt trang, đọc chữ ký, dựng nhãn QR và biên bản; font Be Vietnam Pro OFL nhúng sẵn)
│  └─ HoSoSo.Api/
│     ├─ Program.cs              Thứ tự middleware; lệnh "migrate"
│     ├─ Endpoints/              Toàn bộ /api/v1; endpoint chưa làm trả 501 kèm mã task (hiện không còn endpoint nào như vậy)
│     ├─ Security/               Cookie + OIDC, policy quyền động "perm:…", người dùng hiện tại
│     ├─ Middleware/             Mã tương quan, CSRF, header bảo mật, phân công đang dùng (X-Assignment-Id)
│     ├─ Errors/                 GlobalExceptionHandler → ProblemDetails + errorId
│     └─ Observability/          Serilog JSON, OpenTelemetry, GlitchTip (khi có DSN)
└─ tests/
   ├─ HoSoSo.Domain.Tests/       Luật chuyển bước, quyền mặc định
   ├─ HoSoSo.Application.Tests/
   └─ HoSoSo.Api.IntegrationTests/  Migration, danh tính và phân công, phạm vi theo vai trò, quy trình hồ sơ,
                                    tải PDF → AI → đối chiếu, SSE/outbox, quét quyền mọi endpoint
```

## Cấu hình vận hành (khóa chính)

Bí mật luôn đặt bằng biến môi trường (dấu `__` thay cho `:`), không ghi vào tệp cấu hình.

| Khóa | Ý nghĩa | Mặc định |
|---|---|---|
| `Storage:Provider` | `Local` (ổ đĩa) hoặc `S3` (S3/MinIO). Khóa tệp giống nhau ở hai kho nên chuyển kho là chép tệp. | `Local` |
| `Storage:Root` | Thư mục blob (Local) hoặc thư mục tạm khi ghi/đóng gói (S3) | `/var/lib/hoso/blobs` |
| `Storage:S3:ServiceUrl`, `Region`, `Bucket`, `ForcePathStyle`, `Prefix`, `ServerSideEncryption` | Địa chỉ dịch vụ (trống = AWS), vùng, bucket, kiểu địa chỉ, tiền tố khóa, mã hóa phía máy chủ | xem `appsettings.json` |
| `Storage__S3__AccessKey`, `Storage__S3__SecretKey` | Khóa truy cập; để trống cả hai thì dùng vai trò IAM/biến `AWS_*` | trống |
| `Backup__IngestToken` | Khóa máy (từ 32 ký tự) cho script sao lưu gọi `POST /api/v1/ops/backups` bằng header `X-Backup-Token`. Trống = các endpoint `/ops` trả 404. | trống |
| `Backup:MaxAgeHours` / `RestoreTestMaxDays` / `StuckRunningHours` / `WatchdogMinutes` | Ngưỡng cảnh báo sao lưu quá hạn / chưa diễn tập khôi phục / chạy treo, và chu kỳ kiểm tra (0 = tắt) | 26 / 100 / 12 / 15 |
| `Auth:DataProtectionKeysPath` | Thư mục lưu khóa mã hóa cookie phiên; đặt (và dùng chung giữa các instance) khi chạy container, không thì mất khóa là mọi người phải đăng nhập lại | trống |
| Cài đặt `dossier.enforce_procedure_components` (bảng `system_settings`, sửa bằng `PATCH /api/v1/admin/settings`) | `true` = thiếu thành phần bắt buộc của thủ tục thì khóa các bước cần giấy tờ đã đối chiếu; mặc định `false` (chỉ cảnh báo) | `false` |
| `Limits:MaxPdfPages` | PDF nhiều trang hơn bị từ chối ngay khi tải lên (422 `pdf_too_large`) | 500 |
| `Antivirus:Enabled`, `Host`, `Port`, `TimeoutSeconds`, `FailOpen` | Quét ClamAV (clamd, TCP 3310) trước khi lưu tệp tải lên. Bị chặn: 422 `file_infected`. Máy quét lỗi: mặc định từ chối (503 `scanner_unavailable`), `FailOpen=true` thì nhận và ghi cảnh báo. Đặt `StreamMaxLength` của clamd không nhỏ hơn `Limits:UploadMaxBytes`. | tắt |
| `PdfSandbox:Mode` | `Process` (mặc định, **bắt buộc ở Production**): đếm trang/cắt/đọc chữ ký/dựng ảnh PDF chạy trong tiến trình con có hạn giờ và bộ nhớ; `InProcess` chỉ để phát triển | `Process` |
| `PdfSandbox:TimeoutSeconds` / `MaxMemoryMb` / `MaxConcurrency` / `MaxOutputMb` / `Command` | Hạn giờ, bộ nhớ làm việc, số tiến trình đồng thời, dung lượng kết quả của tiến trình con; `Command` để bọc thêm (ví dụ `systemd-run --scope -p MemoryMax=2G`) | 30 / 1536 / 2 / 64 / trống |
| `Auth:MfaRequiredRoles` | Vai trò (cách nhau bằng dấu phẩy) chỉ dùng được khi phiên đã qua MFA; trống = tắt. Cần Keycloak phát `amr`/`acr` (SEC-01) | `technical_admin,chair,council,clerk` |
| `Auth:MfaAmrValues` / `MfaAcrValues` / `MfaAcrRequest` | Giá trị `amr` và `acr` coi là MFA; `acr_values` gửi khi yêu cầu đăng nhập lại có MFA | `mfa,otp,hwk,swk,fpt,sms,face,retina,vbm` / trống / trống |
| `Auth:DataProtectionCertificatePath` + `Auth__DataProtectionCertificatePassword` | Chứng thư .pfx mã hóa khóa Data Protection khi lưu; Production bắt buộc (hoặc `Auth:AllowUnprotectedDataProtectionKeys=true` khi đã mã hóa cả ổ đĩa) | trống |
| `AccessLog:RetryDelaysMs` | Chờ giữa các lần thử lại khi CSDL lỗi lúc ghi nhật ký truy cập (hết lượt thì tính là mất, có cảnh báo) | 1000, 2000, 4000, 8000, 15000 |
| `Antivirus:RequiredInProduction` | `true` thì Production không khởi động khi tắt chống virus | `false` |
| `Limits:OpsRequestsPerMinute` | Giới hạn gọi `/api/v1/ops/*` mỗi địa chỉ mỗi phút (chống dò khóa máy) | 20 |
| `Observability:SlowRequestMs` | Request lâu hơn mức này ghi thêm dòng `slow_request` | 2000 |

## Quy tắc

- Mọi endpoint mặc định cần đăng nhập; thêm `.RequirePermission(...)` cho từng thao tác. Phạm vi từng bản ghi kiểm tra trong use case (`IScopeFilter`, BE-15).
- Chuyển bước hồ sơ chỉ qua hàm SQL `hoso.transition_dossier`, trong transaction có ghi outbox.
- Không sinh migration bằng EF Core; mọi thay đổi schema là một tệp SQL mới trong `database/migrations`.
- Lỗi nghiệp vụ ném `AppException` với mã trong `ErrorCodes`; không tự viết ProblemDetails.
- Không ghi nội dung giấy tờ, số định danh cá nhân, cookie, token vào log.
