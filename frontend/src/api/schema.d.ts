/* Tệp sinh tự động bởi `npm run gen:api` từ src/api/openapi.json. Không sửa tay. */

export interface paths {
    "/api/v1/auth/login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Bắt đầu đăng nhập, quay lại returnUrl sau khi xong; mfa=true để nâng mức xác thực */
        get: {
            parameters: {
                query?: {
                    returnUrl?: string;
                    mfa?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/logout": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đăng xuất: thu hồi phiên và kết thúc phiên ở nhà cung cấp danh tính */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/auth/dev-login": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** CHỈ DEV: đăng nhập bằng người dùng giả lập trong CSDL */
        get: {
            parameters: {
                query: {
                    username: string;
                    returnUrl?: string;
                    mfa?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Người dùng hiện tại, các phân công còn hiệu lực và quyền của phân công đang dùng */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["MeResponse"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/me/logins": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Các lần đăng nhập gần đây của tôi (thời điểm, địa chỉ IP), mới nhất trước */
        get: {
            parameters: {
                query?: {
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoginEventDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/events": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Luồng SSE: job.progress, job.completed, job.failed, notification.created, dossier.changed, resync */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/form-templates/{id}/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tải mẫu biểu */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Tải bản quét thay thế (phiên bản kế tiếp) kèm lý do 10–500 ký tự; bản cũ giữ nguyên. Trùng bản đã có trả 409 duplicate_file */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        file: components["schemas"]["IFormFile"];
                    } & {
                        reason?: string;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReplacementResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/files/{fileId}/pages/{page}/quality": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Đặt chất lượng một trang; rescan_required sẽ mở lỗi và chặn đóng lô */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    fileId: string;
                    page: number;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PageQualityRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SuspectPage"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/segments/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Xác nhận tách: cắt trang, tạo văn bản con và đưa vào hàng đợi AI */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["ConfirmSplitRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SplitResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/search": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tìm số ký hiệu (gần đúng), trích yếu, mã hồ sơ, toàn văn OCR (không dấu); lọc theo loại giấy tờ, nhóm, đơn vị, hình thức, ngày ban hành */
        get: {
            parameters: {
                query?: {
                    Q?: string;
                    Kind?: string;
                    Limit?: number;
                    DocumentType?: string;
                    WorkGroup?: string;
                    Department?: string;
                    Form?: string;
                    IssuedFrom?: string;
                    IssuedTo?: string;
                    Issuer?: string;
                    Cursor?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SearchResult"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/organizations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cơ quan (UBND, HĐND) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["OrganizationDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/departments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Phòng, Ban, đầu mối */
        get: {
            parameters: {
                query?: {
                    organization?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DepartmentDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/work-groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Nhóm hồ sơ, lọc theo cơ quan và đầu mối (mục ngừng dùng chỉ hiện cho người quản lý danh mục) */
        get: {
            parameters: {
                query?: {
                    organization?: string;
                    department?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkGroupDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/catalog/work-groups/{code}/document-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Loại giấy tờ và trường dữ liệu của một nhóm */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DocumentTypeDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/catalog/work-groups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thêm nhóm hồ sơ */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateWorkGroupRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkGroupDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/catalog/work-groups/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Xóa nhóm chưa có dữ liệu (đã dùng thì 409 in_use: hãy ngừng dùng) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Sửa, xác nhận, ngừng dùng nhóm hồ sơ */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateWorkGroupRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkGroupDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/catalog/document-types": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thêm loại giấy tờ (mã tự cấp) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateDocumentTypeRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DocumentTypeDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/catalog/document-types/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Xóa loại chưa có dữ liệu (đã dùng thì 409 in_use: hãy ngừng dùng) */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Sửa loại giấy tờ, đặt thành phần bắt buộc, ngừng dùng */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateDocumentTypeRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DocumentTypeDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/catalog/field-definitions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thêm trường dữ liệu (mã và thứ tự tự cấp) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateFieldRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FieldDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/catalog/field-definitions/{code}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Xóa trường chưa có dữ liệu */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        /** Sửa trường dữ liệu, đánh dấu trường quan trọng */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    code: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateFieldRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["FieldDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/catalog/retention-rules": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Thời hạn bảo quản */
        get: {
            parameters: {
                query?: {
                    workGroup?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RetentionRuleDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Đề xuất thời hạn bảo quản (chưa có hiệu lực cho tới khi xác nhận) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateRetentionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RetentionRuleDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/catalog/retention-rules/{id}/confirm": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Xác nhận kèm căn cứ pháp lý */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ConfirmRetentionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RetentionRuleDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/catalog/retention-rules/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Xóa đề xuất chưa xác nhận */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/procedures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tìm thủ tục theo tên (không dấu), mã, lĩnh vực, cấp thực hiện (không phân biệt hoa thường), tình trạng hiệu lực */
        get: {
            parameters: {
                query?: {
                    q?: string;
                    domain?: string;
                    status?: string;
                    level?: string;
                    page?: number;
                    pageSize?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ProcedurePage"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/procedures/domains": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lĩnh vực và số thủ tục */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DomainCount"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/procedures/levels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cấp thực hiện và số thủ tục (gộp cách ghi hoa/thường khác nhau) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LevelCount"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/procedures/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết thủ tục, thành phần hồ sơ, mẫu biểu, lịch sử hiệu lực */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ProcedureDetail"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/batches": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Danh sách lô quét */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BatchSummary"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Tạo lô quét */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateBatchRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BatchSummary"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/batches/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết lô quét */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BatchDetail"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/batches/{id}/close": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đóng lô quét. Còn lỗi ảnh mở: 409 kèm số lỗi; gửi acceptOpenIssuesNote (từ 10 ký tự) để chấp nhận bỏ qua tất cả và đóng luôn */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["CloseBatchRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BatchSummary"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/files": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Tải PDF lên: tính SHA-256, chống trùng, xếp hàng đọc. Trùng trả 409 duplicate_file kèm id giấy tờ cũ */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "multipart/form-data": {
                        file: components["schemas"]["IFormFile"];
                    } & {
                        /** Format: uuid */
                        batchId?: string;
                    };
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["UploadResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/inbox": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Hộp tiếp nhận theo trạng thái inbox | filed | discarded; lọc trên toàn hộp theo tình trạng đọc (read, nhiều giá trị cách nhau dấu phẩy), lô quét (batch), nhóm (group), loại giấy tờ (type) của gợi ý AI mới nhất */
        get: {
            parameters: {
                query?: {
                    status?: string;
                    cursor?: string;
                    limit?: number;
                    read?: string;
                    batch?: string;
                    group?: string;
                    type?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PageOfInboxItem"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/inbox/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Số PDF theo tình trạng đọc của một thẻ hộp tiếp nhận (cùng lô/nhóm/loại), cho các nút lọc */
        get: {
            parameters: {
                query?: {
                    status?: string;
                    batch?: string;
                    group?: string;
                    type?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["InboxSummary"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/documents/{id}/discard": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Bỏ PDF (hoàn tác được trong 30 ngày) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/intake/documents/{id}/restore": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Hoàn tác bỏ PDF */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality-issues": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Lỗi ảnh theo lô, kèm các trang AI đã gắn cờ đáng ngờ */
        get: {
            parameters: {
                query?: {
                    batchId?: string;
                    status?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QualityOverview"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Ghi một lỗi ảnh (trống, mờ, nghiêng, thiếu trang...) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateIssueRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QualityIssueDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/quality-issues/{id}/resolve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đánh dấu đã sửa hoặc chấp nhận bỏ qua (cần lý do) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ResolveIssueRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["QualityIssueDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tiến độ, vị trí trong hàng đợi, kết quả */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobDto"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Hủy đọc (dừng sau trang hiện tại) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/jobs/{id}/pages/{page}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đọc lại một trang */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    page: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["JobDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ai/availability": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Máy AI có đang đọc được không: ok, engine_down (máy chạy mô hình không trả lời), no_worker (không worker nào hoạt động), từ lúc nào */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiAvailability"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết giấy tờ */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DocumentDetail"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/fields": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Trường dữ liệu đã đối chiếu (chỉ đọc), kèm cờ đã sửa so với AI; theo loại đã xác nhận */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DocumentFieldsData"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Sửa, chuẩn hóa, xác nhận nhiều trường */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["EditFieldsRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReviewData"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/documents/{id}/review": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Dữ liệu đối chiếu: gợi ý AI, trường, trang/vùng nguồn, trường cần chú ý */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReviewData"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/classification": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Chấp nhận hoặc đổi nhóm, loại giấy tờ */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ClassifyRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReviewData"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/metadata": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Xác nhận thông tin đầu văn bản và ghi nhận người đối chiếu */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ReviewMetadataRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReviewData"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đánh dấu giấy tờ đã đối chiếu */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ReviewData"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/ai/extract": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trích xuất ngay: đưa giấy tờ lên đầu hàng đợi AI (hoặc tạo việc mới); body tùy chọn { force } */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["AiExtractRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiExtractResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/segments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Đề xuất tách văn bản và số trang của tệp */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SegmentList"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Đặt dải trang cho từng văn bản (không chồng, không hở, phủ đủ) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ProposeSegmentsRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SegmentList"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/relations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Liên kết của văn bản (đi và đến) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RelationDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Liên kết phụ lục, thay thế, sửa đổi, trả lời (chặn vòng) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AddRelationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RelationDto"][];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/documents/{id}/relations/{toId}/{relation}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Gỡ liên kết */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    toId: string;
                    relation: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/files/{id}/signatures": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Kết quả kiểm tra kỹ thuật chữ ký số (không kết luận hiệu lực pháp lý) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SignatureDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/files/{id}/signatures/verify": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đọc và kiểm tra chữ ký số trong PDF */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SignatureDto"][];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/files/{id}/content": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Nội dung tệp, hỗ trợ Range cho trình xem PDF */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/files/{id}/pages/{page}/preview": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Ảnh xem trước một trang (WebP, w = bề rộng 120–1600, mặc định 800 và được lưu cache) */
        get: {
            parameters: {
                query?: {
                    w?: number;
                };
                header?: never;
                path: {
                    id: string;
                    page: number;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/files/{id}/download": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tải tệp gốc (mặc định, cần document.download) hoặc ?purpose=print để in (cần document.print, mở tại chỗ); mỗi lần ghi một dòng nhật ký truy cập */
        get: {
            parameters: {
                query?: {
                    purpose?: string;
                };
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Danh sách hồ sơ trong phạm vi, lọc và phân trang keyset */
        get: {
            parameters: {
                query?: {
                    Status?: string;
                    Q?: string;
                    Department?: string;
                    WorkGroup?: string;
                    Mine?: boolean;
                    Cursor?: string;
                    Limit?: number;
                    Year?: number;
                    Assignee?: string;
                    Overdue?: boolean;
                    LocationId?: string;
                    Sort?: string;
                    Dir?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PageOfDossierListItem"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Tạo hồ sơ, mã do hệ thống cấp */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateDossierRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierDetail"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/export.csv": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Xuất danh sách hồ sơ dạng CSV theo cùng bộ lọc và thứ tự với danh sách (tối đa 10.000 dòng) */
        get: {
            parameters: {
                query?: {
                    Status?: string;
                    Q?: string;
                    Department?: string;
                    WorkGroup?: string;
                    Mine?: boolean;
                    Cursor?: string;
                    Limit?: number;
                    Year?: number;
                    Assignee?: string;
                    Overdue?: boolean;
                    LocationId?: string;
                    Sort?: string;
                    Dir?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/suggestions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Hồ sơ gợi ý khi xếp một giấy tờ */
        get: {
            parameters: {
                query: {
                    documentId: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierListItem"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết hồ sơ */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierDetail"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Sửa thông tin (gửi kèm phiên bản) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateDossierRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierDetail"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/dossiers/{id}/documents": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thêm giấy tờ (từ hộp tiếp nhận hoặc có sẵn) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AddDocumentRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierDocumentItem"][];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        /** Sắp xếp, đổi chiều luân chuyển, gán thành phần thủ tục */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["DocumentPlacement"][];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierDocumentItem"][];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/dossiers/{id}/documents/{documentId}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        /** Gỡ giấy tờ khỏi hồ sơ */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                    documentId: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/ai/extract": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trích xuất ngay: đưa giấy tờ của hồ sơ lên đầu hàng đợi AI (hoặc tạo việc mới); body tùy chọn { force, documentIds } */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["AiExtractRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiExtractResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/checklist": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Thành phần đủ / thiếu / chưa đối chiếu */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Checklist"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/assignees": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Người có thể giao chủ trì hồ sơ này (chuyên viên của phòng), kèm số hồ sơ đang giữ và quá hạn */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AssigneeOption"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/assignment": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Giao người chủ trì, phối hợp, hạn nội bộ */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["AssignRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierDetail"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/actions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Thao tác được phép ở bước hiện tại, kèm lý do bị khóa */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AllowedAction"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/transitions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Chuyển bước qua hoso.transition_dossier (quyền cụ thể do luật chuyển bước quyết định) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["TransitionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["TransitionResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/history": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Nhật ký xử lý */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["HistoryItem"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/dossiers/{id}/location": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        /** Đặt hoặc chuyển vị trí bản giấy */
        put: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["PlaceDossierRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DossierLocationDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspace/summary": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Số liệu cho menu và màn Việc của tôi */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["WorkspaceSummary"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspace/leadership": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Số liệu tổng hợp cho lãnh đạo: Chủ tịch UBND theo phòng; lãnh đạo HĐND theo hoạt động. Chỉ đếm hồ sơ trong phạm vi phân công đang dùng */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LeadershipSummary"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/workspace/queue": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Hàng việc theo phân công đang dùng */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["Workspace"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/storage-locations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cây vị trí kho (cha trước con, kèm đường dẫn đầy đủ) */
        get: {
            parameters: {
                query?: {
                    includeInactive?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LocationNode"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Thêm vị trí (kho › phòng › tủ › kệ › hộp) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateLocationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LocationNode"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/storage-locations/by-qr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Quét mã QR: tìm vị trí theo nội dung mã */
        get: {
            parameters: {
                query: {
                    payload: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LocationNode"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/storage-locations/labels": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** In nhãn QR hàng loạt (PDF A4, 24 nhãn mỗi trang) */
        get: {
            parameters: {
                query: {
                    ids: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/storage-locations/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Một vị trí */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LocationNode"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Sửa, ngừng dùng vị trí */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateLocationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LocationNode"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/storage-locations/{id}/qr": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Mã QR của vị trí (SVG) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Đề nghị mượn theo trạng thái (người mượn thấy của mình, người duyệt thấy của cơ quan) */
        get: {
            parameters: {
                query?: {
                    status?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoanDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Đề nghị mượn */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RequestLoanRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoanDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Duyệt mượn (hạn trả mặc định 14 ngày, tối đa 90) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["ApproveLoanRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoanDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans/{id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Từ chối kèm lý do */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RejectLoanRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoanDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans/{id}/lend": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Giao hồ sơ */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoanDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/loans/{id}/return": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Nhận trả hồ sơ (ghi tình trạng) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["ReturnLoanRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["LoanDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archive-submissions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Các đợt nộp lưu của cơ quan */
        get: {
            parameters: {
                query?: {
                    status?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ArchiveSubmissionDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Tạo đợt từ hồ sơ chờ nộp lưu */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateSubmissionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ArchiveSubmissionDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archive-submissions/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Một đợt kèm danh mục hồ sơ */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ArchiveSubmissionDto"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        /** Xóa đợt đang soạn */
        delete: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archive-submissions/{id}/submit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Nộp đợt */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ArchiveSubmissionDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archive-submissions/{id}/receive": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Tiếp nhận cả đợt (một giao dịch, hoặc không hồ sơ nào đổi) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ArchiveSubmissionDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archive-submissions/{id}/return": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Trả lại đợt kèm danh sách lỗi */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ReturnSubmissionRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ArchiveSubmissionDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/archive-submissions/{id}/minutes": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Biên bản nộp lưu (PDF) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Các gói xuất gần đây của tôi */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExportDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Tạo gói xuất (chạy nền; theo dõi qua SSE export.progress hoặc GET /exports/{id}) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateExportRequest"];
                };
            };
            responses: {
                /** @description Accepted */
                202: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExportDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tiến độ gói xuất */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ExportDto"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/exports/{id}/file": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tải gói xuất (ZIP; có manifest.sha256) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/disposals": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Các đề nghị hủy của cơ quan */
        get: {
            parameters: {
                query?: {
                    status?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisposalDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Đề nghị hủy (chỉ hồ sơ đã lưu trữ, hết thời hạn bảo quản đã xác nhận) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RequestDisposalRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisposalDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/disposals/eligible": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Hồ sơ đã hết thời hạn bảo quản (theo quy tắc đã xác nhận), chưa có đề nghị hủy */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["EligibleDossierDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/disposals/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Một đề nghị hủy */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisposalDto"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/disposals/{id}/approve": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Phê duyệt kèm văn bản quyết định (khác người đề nghị) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["ApproveDisposalRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisposalDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/disposals/{id}/reject": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Từ chối kèm lý do */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RejectDisposalRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisposalDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/disposals/{id}/execute": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thực hiện hủy đã phê duyệt: xóa nội dung tệp, giữ metadata và nhật ký (đường duy nhất xóa tệp) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["DisposalResult"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Thông báo của tôi, mới nhất trước; trang cũ hơn bằng cursor = nextCursor của trang trước */
        get: {
            parameters: {
                query?: {
                    unread?: boolean;
                    limit?: number;
                    cursor?: string;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["NotificationList"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/{id}/read": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đánh dấu đã đọc */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/notifications/read-all": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Đánh dấu tất cả đã đọc */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AnonymousTypeOfint"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Người dùng; mỗi dòng kèm số phân công sắp hết hạn (≤ 7 ngày); expiring=true chỉ lấy những người đó */
        get: {
            parameters: {
                query?: {
                    q?: string;
                    active?: boolean;
                    expiring?: boolean;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminUserListItem"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Thêm người dùng */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateUserRequest"];
                };
            };
            responses: {
                /** @description Created */
                201: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminUserDetail"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/roles": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Vai trò và quyền của từng vai trò (cho màn phân công và ủy quyền) */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["RoleInfo"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/users/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Chi tiết người dùng: phân công (kể cả đã kết thúc) và ủy quyền */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminUserDetail"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Khóa, mở khóa, sửa tên */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateUserRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminUserDetail"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/users/{id}/revoke-sessions": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Buộc đăng xuất mọi phiên đang mở của một người dùng */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AnonymousTypeOfint"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/assignments": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thêm phân công có thời hạn, căn cứ */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateAssignmentRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminAssignmentDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/assignments/{id}/end": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Kết thúc phân công */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminAssignmentDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delegations": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ủy quyền có thời hạn (tối đa 90 ngày, chỉ phần quyền mình có) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["CreateDelegationRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminDelegationDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/delegations/{id}/revoke": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Thu hồi ủy quyền */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description No Content */
                204: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content?: never;
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/ai/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Hàng đợi AI, worker, mô hình */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AiStatus"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/ai/jobs": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Việc AI mới nhất trước (status=active|queued|running|failed|cancelled|completed), kèm có hủy/chạy lại được không và lý do */
        get: {
            parameters: {
                query?: {
                    status?: string;
                    cursor?: string;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["PageOfAdminJobRow"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/ai/jobs/{id}/cancel": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Hủy việc AI đang chờ hoặc đang chạy (không cần phạm vi giấy tờ) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminJobRow"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/ai/jobs/{id}/retry": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Chạy lại việc đã lỗi/đã hủy: tạo việc mới cùng tệp, cùng tùy chọn, mức tương tác */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AdminJobRow"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/settings": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Cài đặt hệ thống */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Sửa cài đặt (không nhận bí mật) */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["UpdateSettingRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["SettingDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
    "/api/v1/admin/audit": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Nhật ký truy cập (kind=access) và thay đổi (kind=change, chỉ tên cột), lọc theo người, đối tượng, mã tương quan */
        get: {
            parameters: {
                query?: {
                    kind?: string;
                    actor?: string;
                    objectType?: string;
                    objectId?: string;
                    correlationId?: string;
                    from?: string;
                    to?: string;
                    before?: number;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["AuditRow"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/errors": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Tra Mã lỗi người dùng gửi: request, người, mã tương quan và các lần truy cập cùng request */
        get: {
            parameters: {
                query?: {
                    errorId?: string;
                    correlationId?: string;
                    actor?: string;
                    from?: string;
                    to?: string;
                    before?: number;
                    limit?: number;
                };
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["ErrorEventRow"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Kết quả sao lưu */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupDto"][];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        /** Quản trị ghi tay kết quả sao lưu (script dùng /ops/backups với khóa máy) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RecordBackupRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/backups/status": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        /** Sao lưu có ổn không: bản thành công gần nhất theo loại, quá hạn, lần chạy lỗi hoặc treo, diễn tập khôi phục */
        get: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody?: never;
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupStatus"];
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/admin/backups/{id}/restore-test": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Ghi nhận đã diễn tập khôi phục từ bản sao lưu này */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody?: {
                content: {
                    "application/json": null | components["schemas"]["RestoreTestRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Phân công đang dùng không có quyền thực hiện (forbidden), hoặc thiếu X-CSRF (csrf_failed). */
                403: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ops/backups": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        /** Script ghi một lần sao lưu (đang chạy, thành công hoặc lỗi) */
        post: {
            parameters: {
                query?: never;
                header?: never;
                path?: never;
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["RecordBackupRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        delete?: never;
        options?: never;
        head?: never;
        patch?: never;
        trace?: never;
    };
    "/api/v1/ops/backups/{id}": {
        parameters: {
            query?: never;
            header?: never;
            path?: never;
            cookie?: never;
        };
        get?: never;
        put?: never;
        post?: never;
        delete?: never;
        options?: never;
        head?: never;
        /** Script báo kết thúc lần sao lưu đang chạy, hoặc bổ sung dung lượng, nơi lưu, diễn tập khôi phục */
        patch: {
            parameters: {
                query?: never;
                header?: never;
                path: {
                    id: string;
                };
                cookie?: never;
            };
            requestBody: {
                content: {
                    "application/json": components["schemas"]["FinishBackupRequest"];
                };
            };
            responses: {
                /** @description OK */
                200: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/json": components["schemas"]["BackupDto"];
                    };
                };
                /** @description Dữ liệu gửi lên chưa hợp lệ: ProblemDetails kèm errors theo từng trường (validation_failed). */
                400: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Chưa đăng nhập hoặc phiên đã hết hạn (unauthenticated). */
                401: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Không tìm thấy, hoặc bản ghi nằm ngoài phạm vi của người dùng (not_found). Không phân biệt hai trường hợp để không lộ sự tồn tại. */
                404: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Xung đột: sai bước quy trình (workflow_conflict), dữ liệu vừa bị người khác sửa (concurrency_conflict) hoặc bị trùng (duplicate_value, duplicate_file). */
                409: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Nghiệp vụ không cho phép: hồ sơ chưa đủ (dossier_incomplete), thiếu ý kiến (note_required), tham chiếu không hợp lệ. */
                422: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
                /** @description Gọi quá nhiều lần trong một phút; thử lại sau. */
                429: {
                    headers: {
                        [name: string]: unknown;
                    };
                    content: {
                        "application/problem+json": unknown;
                    };
                };
            };
        };
        trace?: never;
    };
}
export type webhooks = Record<string, never>;
export interface components {
    schemas: {
        ActivitySummary: {
            activity: string;
            label: string;
            workGroupCodes: string[];
            counts: components["schemas"]["StageCounts"];
        };
        AddDocumentRequest: {
            /** Format: uuid */
            documentId: string;
            direction: null | string;
            /** Format: uuid */
            procedureComponentId?: null | string;
        };
        AddRelationRequest: {
            /** Format: uuid */
            toDocumentId: string;
            relation: string;
            note: null | string;
        };
        AdminAssignmentDto: {
            /** Format: uuid */
            id: string;
            role: string;
            organizationCode: null | string;
            departmentCode: null | string;
            /** Format: date-time */
            validFrom: string;
            /** Format: date-time */
            validUntil: null | string;
            basis: string;
            isDeputy: boolean;
            state: string;
            /** @default false */
            endsSoon: boolean;
        };
        AdminDelegationDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            fromAssignmentId: string;
            fromRole: string;
            /** Format: uuid */
            toUserId: string;
            toUsername: string;
            permissionCodes: string[];
            /** Format: date-time */
            validFrom: string;
            /** Format: date-time */
            validUntil: string;
            basis: string;
            /** Format: date-time */
            revokedAt: null | string;
            state: string;
        };
        AdminJobRow: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            fileId: string;
            fileName: string;
            jobType: string;
            status: string;
            stage: null | string;
            /** Format: int32 */
            processedPages: number;
            /** Format: int32 */
            pageCount: null | number;
            /** Format: int32 */
            attempts: number;
            priorityKind: string;
            error: null | string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            startedAt: null | string;
            /** Format: date-time */
            finishedAt: null | string;
            requestedByName: null | string;
            /** Format: uuid */
            retryOf: null | string;
            canCancel: boolean;
            canRetry: boolean;
            retryBlockedReason: null | string;
        };
        AdminUserDetail: {
            user: components["schemas"]["AdminUserListItem"];
            externalAuthSubject: null | string;
            assignments: components["schemas"]["AdminAssignmentDto"][];
            delegations: components["schemas"]["AdminDelegationDto"][];
        };
        AdminUserListItem: {
            /** Format: uuid */
            id: string;
            username: string;
            displayName: string;
            email: null | string;
            active: boolean;
            isDemo: boolean;
            /** Format: date-time */
            lastLoginAt: null | string;
            /** Format: int32 */
            activeAssignments: number;
            roles: string[];
            /**
             * Format: int32
             * @default 0
             */
            expiringAssignments: number;
            /** Format: date-time */
            nextAssignmentEndsAt?: null | string;
        };
        AiAvailability: {
            state: string;
            /** Format: date-time */
            since: null | string;
        };
        AiExtractItem: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: null | string;
            /** Format: uuid */
            jobId: null | string;
            outcome: string;
            queueKind: null | string;
            /** Format: int32 */
            queuePosition: null | number;
            /** Format: int32 */
            etaSeconds: null | number;
            message: null | string;
        };
        AiExtractRequest: {
            /** @default false */
            force: boolean;
            documentIds?: null | string[];
        };
        AiExtractResult: {
            items: components["schemas"]["AiExtractItem"][];
            /** Format: int32 */
            raised: number;
            /** Format: int32 */
            running: number;
            /** Format: int32 */
            alreadyDone: number;
            /** Format: int32 */
            created: number;
            /** Format: int32 */
            skipped: number;
        };
        AiMachine: {
            workerId: string;
            profile: string;
            engine: null | string;
            engineOk: boolean;
            engineError: null | string;
            /** Format: date-time */
            engineDownSince: null | string;
            /** Format: uuid */
            currentJobId: null | string;
            /** Format: date-time */
            startedAt: string;
            /** Format: date-time */
            lastSeenAt: string;
            /** Format: int32 */
            lastSeenSecondsAgo: number;
            alive: boolean;
        };
        AiStatus: {
            queue: components["schemas"]["QueueCounts"];
            /** Format: int32 */
            oldestQueuedSeconds: null | number;
            workers: components["schemas"]["WorkerInfo"][];
            recentFailures: components["schemas"]["FailureInfo"][];
            models: components["schemas"]["ModelInfo"][];
            throughput: components["schemas"]["Throughput"];
            byKind?: null | components["schemas"]["QueueByKind"];
            runningModels?: null | components["schemas"]["RunningModel"][];
            modelMismatch?: null | string;
            availability?: null | components["schemas"]["AiAvailability"];
            machines?: null | components["schemas"]["AiMachine"][];
        };
        AllowedAction: {
            action: string;
            label: string;
            requiresNote: boolean;
            primary: boolean;
            enabled: boolean;
            disabledReason: null | string;
            toState: string;
            warning?: null | string;
        };
        AnonymousTypeOfint: {
            /** Format: int32 */
            updated: number;
        };
        ApproveDisposalRequest: {
            /** Format: uuid */
            decisionDocumentId: string;
            note: null | string;
        };
        ApproveLoanRequest: {
            /** Format: date */
            dueOn: null | string;
            note: null | string;
        };
        ArchiveItemDto: {
            /** Format: uuid */
            dossierId: string;
            code: string;
            title: string;
            /** Format: int32 */
            pageCount: number;
            location: null | string;
            checkResult: string;
            note: string;
        };
        ArchiveSubmissionDto: {
            /** Format: uuid */
            id: string;
            code: string;
            status: string;
            createdByName: string;
            /** Format: date-time */
            createdAt: string;
            submittedByName: null | string;
            /** Format: date-time */
            submittedAt: null | string;
            receivedByName: null | string;
            /** Format: date-time */
            receivedAt: null | string;
            hasMinutes: boolean;
            note: string;
            returnNote: string;
            /** Format: int32 */
            dossierCount: number;
            /** Format: int32 */
            pageCount: number;
            items: null | components["schemas"]["ArchiveItemDto"][];
        };
        AssigneeOption: {
            /** Format: uuid */
            userId: string;
            displayName: string;
            isDeputy: boolean;
            isCurrent: boolean;
            /** Format: int32 */
            holding: number;
            /** Format: int32 */
            overdue: number;
        };
        AssignmentDto: {
            id: string;
            role: string;
            roleName: string;
            organizationCode: null | string;
            organizationName: null | string;
            departmentCode: null | string;
            departmentName: null | string;
            /** Format: date-time */
            delegatedUntil: null | string;
        };
        AssignRequest: {
            /** Format: uuid */
            userId: string;
            /** Format: date */
            dueOn: null | string;
            note: null | string;
        };
        AuditRow: {
            /** Format: int64 */
            id: number;
            /** Format: date-time */
            at: string;
            kind: string;
            actor: null | string;
            action: string;
            objectType: null | string;
            objectId: null | string;
            correlationId: null | string;
            changedColumns: null | string[];
        };
        BackupDto: {
            /** Format: uuid */
            id: string;
            kind: string;
            status: string;
            /** Format: date-time */
            startedAt: string;
            /** Format: date-time */
            finishedAt: null | string;
            /** Format: int64 */
            byteSize: null | number;
            location: null | string;
            /** Format: date-time */
            restoreTestedAt: null | string;
            note: string;
        };
        BackupKindStatus: {
            kind: string;
            required: boolean;
            /** Format: date-time */
            lastSuccessAt: null | string;
            /** Format: double */
            ageHours: null | number;
            overdue: boolean;
            lastRunStatus: null | string;
            /** Format: date-time */
            lastRunAt: null | string;
        };
        BackupStatus: {
            healthy: boolean;
            kinds: components["schemas"]["BackupKindStatus"][];
            /** Format: date-time */
            lastRestoreTestedAt: null | string;
            restoreTestOverdue: boolean;
            problems: string[];
        };
        BatchDetail: {
            batch: components["schemas"]["BatchSummary"];
            files: components["schemas"]["BatchFile"][];
        };
        BatchFile: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            fileName: string;
            /** Format: int32 */
            pageCount: null | number;
            jobStatus: null | string;
            /** Format: date-time */
            uploadedAt: null | string;
        };
        BatchSummary: {
            /** Format: uuid */
            id: string;
            code: string;
            organizationCode: string;
            departmentCode: null | string;
            boxLabel: null | string;
            handedOverBy: null | string;
            /** Format: int32 */
            expectedSheetCount: null | number;
            /** Format: int32 */
            scannedPageCount: number;
            /** Format: int32 */
            fileCount: number;
            status: string;
            /** Format: date-time */
            openedAt: string;
            /** Format: date-time */
            closedAt: null | string;
            /** Format: int32 */
            openIssues: number;
        };
        Checklist: {
            summary: components["schemas"]["Completeness"];
            items: components["schemas"]["ChecklistItem"][];
            procedureId?: null | string;
            procedureName?: null | string;
            components?: null | components["schemas"]["ChecklistComponent"][];
            procedure?: null | components["schemas"]["ProcedureCompleteness"];
        };
        ChecklistComponent: {
            /** Format: uuid */
            componentId: string;
            section: string;
            /** Format: int32 */
            position: number;
            name: string;
            required: boolean;
            /** Format: int32 */
            originalQuantity: number;
            /** Format: int32 */
            copyQuantity: number;
            hasElectronicForm: boolean;
            state: string;
            documentIds: string[];
            todo: string;
        };
        ChecklistItem: {
            /** Format: uuid */
            documentId: string;
            title: string;
            state: string;
            /** Format: int32 */
            pendingFields: number;
            classified: boolean;
            /** Format: uuid */
            componentId?: null | string;
        };
        ChildDocument: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            /** Format: uuid */
            jobId: string;
            /** Format: int32 */
            pageFrom: number;
            /** Format: int32 */
            pageTo: number;
            title: string;
        };
        ClassificationDto: {
            workGroupCode: string;
            workGroupTitle: string;
            documentTypeCode: null | string;
            documentTypeName: null | string;
            status: string;
        };
        ClassifyRequest: {
            workGroupCode: string;
            documentTypeCode: string;
        };
        CloseBatchRequest: {
            acceptOpenIssuesNote: null | string;
        };
        Completeness: {
            /** Format: int32 */
            componentCount: number;
            /** Format: int32 */
            verifiedCount: number;
            /** Format: int32 */
            pendingFieldCount: number;
            ready: boolean;
            reasons: string[];
        };
        ComponentDto: {
            /** Format: uuid */
            id: string;
            section: string;
            /** Format: int32 */
            position: number;
            name: string;
            paperCode: null | string;
            /** Format: int32 */
            originalQuantity: number;
            /** Format: int32 */
            copyQuantity: number;
            requiredAsPublished: boolean;
            hasElectronicForm: boolean;
            templates: components["schemas"]["TemplateDto"][];
        };
        ConfirmRetentionRequest: {
            legalReference: string;
        };
        ConfirmSplitRequest: {
            titles: null | {
                [key: string]: string;
            };
        };
        CreateAssignmentRequest: {
            /** Format: uuid */
            userId: string;
            roleCode: string;
            organizationCode: null | string;
            departmentCode: null | string;
            /** Format: date-time */
            validFrom: null | string;
            /** Format: date-time */
            validUntil: null | string;
            basis: string;
            isDeputy: null | boolean;
        };
        CreateBatchRequest: {
            organizationCode: null | string;
            departmentCode: null | string;
            handedOverBy: null | string;
            boxLabel: null | string;
            /** Format: int32 */
            expectedSheetCount: null | number;
            note: null | string;
        };
        CreateDelegationRequest: {
            /** Format: uuid */
            fromAssignmentId: string;
            /** Format: uuid */
            toUserId: string;
            permissionCodes: string[];
            /** Format: date-time */
            validFrom: null | string;
            /** Format: date-time */
            validUntil: string;
            basis: string;
        };
        CreateDocumentTypeRequest: {
            workGroupCode: string;
            name: string;
            documentForm: null | string;
            requiredInDossier: null | boolean;
            /** Format: int16 */
            minCount: null | number;
        };
        CreateDossierRequest: {
            title: string;
            workGroupCode: string;
            workflowCode: null | string;
            accessLevel: null | string;
            notes: null | string;
            /** Format: date */
            internalDueOn: null | string;
            creatorOrganizationName: null | string;
            /** Format: int32 */
            year: null | number;
            procedureId?: null | string;
        };
        CreateExportRequest: {
            dossierIds: null | string[];
            status: null | string;
            workGroupCode: null | string;
            /** Format: date */
            archivedFrom: null | string;
            /** Format: date */
            archivedTo: null | string;
            format: null | string;
        };
        CreateFieldRequest: {
            documentTypeCode: string;
            label: string;
            valueType: null | string;
            requiredForReview: null | boolean;
            isKeyField: null | boolean;
            fieldGroup: null | string;
            validationPattern: null | string;
        };
        CreateIssueRequest: {
            /** Format: uuid */
            batchId: null | string;
            /** Format: uuid */
            documentId: null | string;
            /** Format: uuid */
            fileId: null | string;
            /** Format: int32 */
            pageNo: null | number;
            issueType: string;
            severity: null | string;
            description: null | string;
        };
        CreateLocationRequest: {
            /** Format: uuid */
            parentId: null | string;
            kind: string;
            code: string;
            name: string;
            capacityNote: null | string;
        };
        CreateRetentionRequest: {
            workGroupCode: string;
            documentTypeCode: null | string;
            retentionLabel: string;
            /** Format: int16 */
            retentionYears: null | number;
            legalReference: null | string;
        };
        CreateSubmissionRequest: {
            dossierIds: string[];
            note: null | string;
        };
        CreateUserRequest: {
            username: string;
            displayName: string;
            email: null | string;
            externalAuthSubject: null | string;
        };
        CreateWorkGroupRequest: {
            code: string;
            organizationCode: string;
            departmentCode: string;
            title: string;
            responsibility: string;
            filingRule: string;
            businessFields: string;
        };
        DepartmentDto: {
            code: string;
            name: string;
            kind: string;
            note: string;
            verificationStatus: string;
            organizationCodes: string[];
        };
        DepartmentSummary: {
            departmentCode: string;
            departmentName: string;
            counts: components["schemas"]["StageCounts"];
        };
        DisposalDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            dossierId: string;
            dossierCode: string;
            dossierTitle: string;
            reason: string;
            status: string;
            retentionLabel: string;
            /** Format: int16 */
            retentionYears: null | number;
            legalReference: null | string;
            requestedByName: string;
            /** Format: date-time */
            requestedAt: string;
            decidedByName: null | string;
            /** Format: date-time */
            decidedAt: null | string;
            /** Format: uuid */
            decisionDocumentId: null | string;
            decisionNote: string;
            executedByName: null | string;
            /** Format: date-time */
            executedAt: null | string;
        };
        DisposalResult: {
            disposal: components["schemas"]["DisposalDto"];
            /** Format: int32 */
            filesDisposed: number;
            /** Format: int32 */
            blobsDeleted: number;
            /** Format: int32 */
            documentsKept: number;
        };
        DocumentDetail: {
            /** Format: uuid */
            id: string;
            title: string;
            documentForm: string;
            documentNumber: null | string;
            /** Format: date */
            issuedOn: null | string;
            origin: string;
            intakeStatus: string;
            reviewStatus: string;
            metadataStatus: string;
            /** Format: uint32 */
            version: number;
            file: null | components["schemas"]["FileInfoDto"];
            classification: null | components["schemas"]["ClassificationDto"];
            dossiers: components["schemas"]["DossierRef"][];
            /** Format: uuid */
            metadataReviewedBy?: null | string;
            /** Format: date-time */
            metadataReviewedAt?: null | string;
            /** @default  */
            metadataReviewNote: string;
            metadataReviewedByName?: null | string;
            files?: null | components["schemas"]["FileVersionDto"][];
        };
        DocumentFieldsData: {
            /** Format: uuid */
            documentId: string;
            classification: null | components["schemas"]["ClassificationDto"];
            reviewStatus: string;
            reviewedByName: null | string;
            /** Format: date-time */
            reviewedAt: null | string;
            fields: components["schemas"]["DocumentFieldView"][];
        };
        DocumentFieldView: {
            fieldCode: string;
            label: string;
            /** Format: int32 */
            position: number;
            valueType: string;
            value: null | string;
            verified: boolean;
            origin: string;
            editedFromAi: boolean;
            verifiedByName: null | string;
            /** Format: date-time */
            verifiedAt: null | string;
            /** Format: int32 */
            sourcePage: null | number;
            sourceRegion: null | components["schemas"]["SourceRegionDto"];
            /** Format: uuid */
            sourceFileId?: null | string;
        };
        DocumentPlacement: {
            /** Format: uuid */
            documentId: string;
            /** Format: int32 */
            position: null | number;
            direction: null | string;
            relationKind: null | string;
            /** Format: uuid */
            procedureComponentId?: null | string;
            /** @default false */
            clearProcedureComponent: boolean;
        };
        DocumentTypeDto: {
            code: string;
            name: string;
            fields: components["schemas"]["FieldDto"][];
            /** @default true */
            active: boolean;
            documentForm?: null | string;
            /** @default false */
            requiredInDossier: boolean;
            /**
             * Format: int32
             * @default 1
             */
            minCount: number;
        };
        DomainCount: {
            domain: string;
            /** Format: int32 */
            count: number;
        };
        DossierDetail: {
            /** Format: uuid */
            id: string;
            code: string;
            title: string;
            status: string;
            statusLabel: string;
            workflowCode: string;
            organizationCode: string;
            departmentCode: string;
            workGroupCode: string;
            workGroupTitle: string;
            accessLevel: string;
            notes: string;
            physicalLocation: null | string;
            creatorOrganizationName: null | string;
            /** Format: uuid */
            assigneeId: null | string;
            assigneeName: null | string;
            /** Format: date */
            dueOn: null | string;
            /** Format: int32 */
            year: number;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: date-time */
            archivedAt: null | string;
            /** Format: uint32 */
            version: number;
            documents: components["schemas"]["DossierDocumentItem"][];
            completeness: components["schemas"]["Completeness"];
            procedureId?: null | string;
            procedureName?: null | string;
            retention?: null | components["schemas"]["DossierRetention"];
        };
        DossierDocumentItem: {
            /** Format: uuid */
            documentId: string;
            /** Format: int32 */
            position: number;
            title: string;
            documentForm: string;
            documentNumber: null | string;
            /** Format: date */
            issuedOn: null | string;
            direction: null | string;
            relationKind: string;
            reviewStatus: string;
            intakeStatus: string;
            /** Format: int32 */
            pendingFields: number;
            /** Format: uuid */
            procedureComponentId?: null | string;
            /** @default unverified */
            metadataStatus: string;
        };
        DossierHit: {
            /** Format: uuid */
            id: string;
            code: string;
            title: string;
        };
        DossierListItem: {
            /** Format: uuid */
            id: string;
            code: string;
            title: string;
            status: string;
            statusLabel: string;
            workGroupCode: string;
            workGroupTitle: string;
            departmentCode: string;
            assigneeName: null | string;
            /** Format: date */
            dueOn: null | string;
            /** Format: date-time */
            updatedAt: string;
            /** Format: int32 */
            documentCount: number;
            /** Format: int32 */
            verifiedCount: number;
            /** Format: uint32 */
            version: number;
        };
        DossierLocationDto: {
            /** Format: uuid */
            dossierId: string;
            /** Format: uuid */
            locationId: null | string;
            path: null | string;
        };
        DossierRef: {
            /** Format: uuid */
            id: string;
            code: string;
            title: string;
            status: string;
        };
        DossierRetention: {
            status: string;
            label: null | string;
            /** Format: int16 */
            years: null | number;
            legalReference: null | string;
            /** Format: date-time */
            eligibleSince: null | string;
            eligible: boolean;
        };
        EditFieldsRequest: {
            fields: components["schemas"]["FieldEdit"][];
        };
        EligibleDossierDto: {
            /** Format: uuid */
            dossierId: string;
            code: string;
            title: string;
            /** Format: date-time */
            archivedAt: string;
            retentionLabel: string;
            /** Format: int16 */
            retentionYears: number;
            /** Format: date-time */
            eligibleSince: string;
        };
        ErrorEventRow: {
            /** Format: int64 */
            id: number;
            errorId: string;
            /** Format: date-time */
            at: string;
            /** Format: int32 */
            status: number;
            code: string;
            method: string;
            path: string;
            correlationId: null | string;
            /** Format: uuid */
            userId: null | string;
            actor: null | string;
            assignment: null | string;
            related: components["schemas"]["AuditRow"][];
        };
        ExportDto: {
            /** Format: uuid */
            id: string;
            status: string;
            format: string;
            /** Format: int32 */
            totalItems: number;
            /** Format: int32 */
            processedItems: number;
            /** Format: int64 */
            byteSize: null | number;
            manifestSha256: null | string;
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            readyAt: null | string;
            /** Format: date-time */
            expiresAt: null | string;
            error: null | string;
        };
        FailureInfo: {
            /** Format: uuid */
            jobId: string;
            fileName: string;
            error: null | string;
            /** Format: date-time */
            finishedAt: null | string;
            /** Format: int32 */
            attempts: number;
        };
        FieldDto: {
            code: string;
            label: string;
            /** Format: int32 */
            position: number;
            valueType: string;
            requiredForReview: boolean;
            /** @default false */
            isKeyField: boolean;
            fieldGroup?: null | string;
            validationPattern?: null | string;
        };
        FieldEdit: {
            fieldCode: string;
            value: null | string;
            verify: boolean;
        };
        FileInfoDto: {
            /** Format: uuid */
            id: string;
            name: string;
            mediaType: string;
            /** Format: int64 */
            byteSize: number;
            /** Format: int32 */
            pageCount: null | number;
            sha256: string;
        };
        FileVersionDto: {
            /** Format: uuid */
            id: string;
            componentKey: string;
            /** Format: int32 */
            versionNo: number;
            role: string;
            kind: string;
            name: string;
            mediaType: string;
            /** Format: int64 */
            byteSize: number;
            /** Format: int32 */
            pageCount: null | number;
            sha256: string;
            /** Format: date-time */
            uploadedAt: null | string;
            uploadedByName: null | string;
            disposed: boolean;
            isCurrent: boolean;
            /** Format: uuid */
            replacesFileId?: null | string;
            replacementReason?: null | string;
        };
        FinishBackupRequest: {
            status: null | string;
            /** Format: date-time */
            finishedAt: null | string;
            /** Format: int64 */
            byteSize: null | number;
            location: null | string;
            /** Format: date-time */
            restoreTestedAt: null | string;
            note: null | string;
        };
        HistoryItem: {
            /** Format: int64 */
            id: number;
            action: string;
            actionLabel: string;
            fromState: null | string;
            toState: string;
            note: string;
            actorName: string;
            actorRole: string;
            /** Format: date-time */
            at: string;
        };
        /** Format: binary */
        IFormFile: string;
        InboxItem: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            fileName: string;
            /** Format: int32 */
            pageCount: null | number;
            /** Format: date-time */
            uploadedAt: string;
            stage: string;
            /** Format: int32 */
            queuePosition: null | number;
            progress: null | string;
            suggestion: null | string;
            /** Format: int32 */
            attentionCount: number;
            /** Format: uuid */
            jobId: null | string;
            error: null | string;
            intakeStatus: string;
            queueKind?: null | string;
            /** Format: int32 */
            etaSeconds?: null | number;
        };
        InboxSummary: {
            /** Format: int32 */
            total: number;
            /** Format: int32 */
            queued: number;
            /** Format: int32 */
            reading: number;
            /** Format: int32 */
            ready: number;
            /** Format: int32 */
            failed: number;
            /** Format: int32 */
            cancelled: number;
        };
        ItemIssueRequest: {
            /** Format: uuid */
            dossierId: string;
            note: string;
        };
        JobDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            jobType: string;
            status: string;
            stage: null | string;
            /** Format: int32 */
            processedPages: number;
            /** Format: int32 */
            pageCount: null | number;
            /** Format: int32 */
            attempt: number;
            /** Format: int32 */
            queuePosition: null | number;
            error: null | string;
            warnings: string[];
            /** Format: date-time */
            createdAt: string;
            /** Format: date-time */
            startedAt: null | string;
            /** Format: date-time */
            finishedAt: null | string;
            /** @default background */
            queueKind: string;
            /** Format: int32 */
            etaSeconds?: null | number;
        };
        JsonElement: unknown;
        LeadershipSummary: {
            role: string;
            organizationCode: null | string;
            /** Format: date */
            asOf: string;
            totals: components["schemas"]["StageCounts"];
            departments: components["schemas"]["DepartmentSummary"][];
            activities: components["schemas"]["ActivitySummary"][];
        };
        LevelCount: {
            level: string;
            /** Format: int32 */
            count: number;
        };
        LifecycleDto: {
            status: string;
            label: string;
            note: string;
            evidence: components["schemas"]["JsonElement"];
            /** Format: date */
            effectiveFrom: null | string;
            /** Format: date */
            reviewedOn: null | string;
        };
        LoanDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            dossierId: string;
            dossierCode: string;
            dossierTitle: string;
            /** Format: uuid */
            borrowerId: string;
            borrowerName: string;
            purpose: string;
            status: string;
            /** Format: date-time */
            requestedAt: string;
            /** Format: date */
            dueOn: null | string;
            /** Format: date-time */
            lentAt: null | string;
            /** Format: date-time */
            returnedAt: null | string;
            conditionNote: string;
            decisionNote: string;
            overdue: boolean;
        };
        LocationNode: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            parentId: null | string;
            kind: string;
            code: string;
            name: string;
            path: string;
            /** Format: int32 */
            depth: number;
            active: boolean;
            qrPayload: string;
            /** Format: int32 */
            dossierCount: number;
        };
        LoginEventDto: {
            /** Format: date-time */
            at: string;
            clientIp: null | string;
        };
        MeResponse: {
            user: components["schemas"]["SessionUserDto"];
            assignments: components["schemas"]["AssignmentDto"][];
            activeAssignment: components["schemas"]["AssignmentDto"];
            permissions: string[];
            isMock: boolean;
            /** @default false */
            mfaRequired: boolean;
        };
        ModelInfo: {
            key: string;
            repo: string;
            revision: string;
            purpose: string;
            active: boolean;
        };
        NotificationDto: {
            /** Format: uuid */
            id: string;
            kind: string;
            title: string;
            body: string;
            link: null | string;
            /** Format: uuid */
            dossierId: null | string;
            /** Format: date-time */
            createdAt: string;
            read: boolean;
        };
        NotificationList: {
            items: components["schemas"]["NotificationDto"][];
            /** Format: int32 */
            unread: number;
            nextCursor?: null | string;
        };
        OrganizationDto: {
            code: string;
            name: string;
            kind: string;
            locality: string;
        };
        PageOfAdminJobRow: {
            items: components["schemas"]["AdminJobRow"][];
            nextCursor: null | string;
        };
        PageOfDossierListItem: {
            items: components["schemas"]["DossierListItem"][];
            nextCursor: null | string;
        };
        PageOfInboxItem: {
            items: components["schemas"]["InboxItem"][];
            nextCursor: null | string;
        };
        PageQualityRequest: {
            status: string;
            note: null | string;
        };
        PermissionInfo: {
            code: string;
            description: string;
        };
        PlaceDossierRequest: {
            /** Format: uuid */
            locationId: null | string;
            note: null | string;
        };
        ProcedureCompleteness: {
            /** Format: int32 */
            requiredCount: number;
            /** Format: int32 */
            requiredOk: number;
            /** Format: int32 */
            requiredPending: number;
            /** Format: int32 */
            requiredMissing: number;
            allRequiredOk: boolean;
            warning: null | string;
            /** @default false */
            enforced: boolean;
        };
        ProcedureDetail: {
            id: string;
            procedureCode: null | string;
            name: string;
            domain: null | string;
            managingAgency: null | string;
            executionLevel: null | string;
            competentAuthority: null | string;
            fees: null | string;
            receivingLocation: null | string;
            ministryDecision: null | string;
            hanoiDecision: null | string;
            workflowDecision: null | string;
            delegationDecision: null | string;
            delegationExpiry: null | string;
            sourceUrl: null | string;
            lifecycleStatus: string;
            warning: null | string;
            components: components["schemas"]["ComponentDto"][];
            lifecycle: components["schemas"]["LifecycleDto"][];
            procedureFiles: components["schemas"]["TemplateDto"][];
        };
        ProcedureListItem: {
            id: string;
            procedureCode: null | string;
            name: string;
            domain: null | string;
            managingAgency: null | string;
            executionLevel: null | string;
            lifecycleStatus: string;
            /** Format: int32 */
            componentCount: number;
        };
        ProcedurePage: {
            items: components["schemas"]["ProcedureListItem"][];
            /** Format: int32 */
            total: number;
        };
        ProposeSegmentsRequest: {
            segments: components["schemas"]["SegmentInput"][];
        };
        QualityIssueDto: {
            /** Format: uuid */
            id: string;
            /** Format: uuid */
            batchId: null | string;
            batchCode: null | string;
            /** Format: uuid */
            documentId: null | string;
            /** Format: uuid */
            fileId: null | string;
            /** Format: int32 */
            pageNo: null | number;
            issueType: string;
            severity: string;
            description: string;
            status: string;
            /** Format: date-time */
            raisedAt: string;
            /** Format: date-time */
            resolvedAt: null | string;
        };
        QualityOverview: {
            issues: components["schemas"]["QualityIssueDto"][];
            suspectPages: components["schemas"]["SuspectPage"][];
        };
        QueueByKind: {
            /** Format: int32 */
            priority: number;
            /** Format: int32 */
            interactive: number;
            /** Format: int32 */
            background: number;
            /** Format: int32 */
            preempted24h: number;
            /** Format: int32 */
            oldestBackgroundSeconds: null | number;
            /** Format: double */
            secondsPerPage: null | number;
        };
        QueueCounts: {
            /** Format: int32 */
            queued: number;
            /** Format: int32 */
            running: number;
            /** Format: int32 */
            completed24h: number;
            /** Format: int32 */
            failed24h: number;
            /** Format: int32 */
            cancelled24h: number;
        };
        QueueItem: {
            /** Format: uuid */
            dossierId: string;
            code: string;
            title: string;
            status: string;
            statusLabel: string;
            /** Format: date */
            dueOn: null | string;
            /** Format: date-time */
            updatedAt: string;
        };
        RecordBackupRequest: {
            kind: string;
            status: string;
            /** Format: date-time */
            startedAt: null | string;
            /** Format: date-time */
            finishedAt: null | string;
            /** Format: int64 */
            byteSize: null | number;
            location: null | string;
            /** Format: date-time */
            restoreTestedAt: null | string;
            note: null | string;
        };
        RejectDisposalRequest: {
            note: string;
        };
        RejectLoanRequest: {
            note: string;
        };
        RelationDto: {
            /** Format: uuid */
            otherDocumentId: string;
            otherTitle: string;
            otherNumber: null | string;
            relation: string;
            direction: string;
            note: string;
        };
        ReplacementResult: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            /** Format: uuid */
            replacedFileId: string;
            /** Format: int32 */
            versionNo: number;
            /** Format: uuid */
            jobId: string;
            fileName: string;
            /** Format: int64 */
            byteSize: number;
            /** Format: int32 */
            pageCount: null | number;
            classify: boolean;
            /** Format: int32 */
            issuesClosed: number;
            reviewReset: boolean;
        };
        RequestDisposalRequest: {
            /** Format: uuid */
            dossierId: string;
            reason: string;
        };
        RequestLoanRequest: {
            /** Format: uuid */
            dossierId: string;
            purpose: string;
            /** Format: date */
            dueOn: null | string;
        };
        ResolveIssueRequest: {
            status: string;
            note: null | string;
        };
        RestoreTestRequest: {
            /** Format: date-time */
            testedAt: null | string;
            note: null | string;
        };
        RetentionRuleDto: {
            /** Format: uuid */
            id: string;
            workGroupCode: string;
            documentTypeCode: null | string;
            retentionLabel: string;
            /** Format: int16 */
            retentionYears: null | number;
            legalReference: null | string;
            status: string;
            /** Format: date-time */
            confirmedAt: null | string;
        };
        ReturnLoanRequest: {
            conditionNote: null | string;
        };
        ReturnSubmissionRequest: {
            note: string;
            issues: null | components["schemas"]["ItemIssueRequest"][];
        };
        ReviewData: {
            document: components["schemas"]["DocumentDetail"];
            suggestion: null | components["schemas"]["ReviewSuggestion"];
            fields: components["schemas"]["ReviewField"][];
            job: null | components["schemas"]["ReviewJob"];
            canEdit: boolean;
            lockedReason: null | string;
        };
        ReviewField: {
            fieldCode: string;
            label: string;
            /** Format: int32 */
            position: number;
            valueType: string;
            required: boolean;
            suggestedValue: null | string;
            suggestedQuote: null | string;
            sourcePages: number[];
            quoteVerified: boolean;
            value: null | string;
            needsReview: boolean;
            verified: boolean;
            attention: null | string;
            sourceRegion?: null | components["schemas"]["SourceRegionDto"];
            /** Format: double */
            confidence?: null | number;
            /** Format: uuid */
            sourceFileId?: null | string;
        };
        ReviewJob: {
            /** Format: uuid */
            id: string;
            status: string;
            stage: null | string;
            /** Format: int32 */
            processedPages: number;
            /** Format: int32 */
            pageCount: null | number;
            error: null | string;
        };
        ReviewMetadataRequest: {
            /** Format: uint32 */
            version: number;
            title: string;
            documentForm: string;
            documentNumber: null | string;
            /** Format: date */
            issuedOn: null | string;
            note: null | string;
        };
        ReviewSuggestion: {
            /** Format: int64 */
            id: number;
            workGroupCode: null | string;
            workGroupTitle: null | string;
            documentTypeCode: null | string;
            documentTypeName: null | string;
            documentForm: string;
            title: string;
            reason: string;
            quote: string;
            evidenceVerified: boolean;
            mixedDocuments: boolean;
            decision: null | string;
            modelKey: string;
        };
        RoleInfo: {
            code: string;
            name: string;
            scopeKind: string;
            permissions: components["schemas"]["PermissionInfo"][];
        };
        RunningModel: {
            modelVersion: string;
            /** Format: int32 */
            jobs: number;
            /** Format: date-time */
            lastFinishedAt: string;
        };
        SearchHit: {
            kind: string;
            /** Format: uuid */
            id: string;
            title: string;
            subtitle: null | string;
            number: null | string;
            /** Format: date */
            issuedOn: null | string;
            /** Format: int32 */
            page: null | number;
            snippet: null | string;
            dossiers: components["schemas"]["DossierHit"][];
        };
        SearchResult: {
            query: string;
            hits: components["schemas"]["SearchHit"][];
            /** Format: int32 */
            totalDocuments: number;
            /** Format: int32 */
            totalDossiers: number;
            nextCursor?: null | string;
        };
        SegmentDto: {
            /** Format: uuid */
            id: string;
            /** Format: int32 */
            pageFrom: number;
            /** Format: int32 */
            pageTo: number;
            status: string;
            proposedBy: string;
            /** Format: uuid */
            targetDocumentId: null | string;
        };
        SegmentInput: {
            /** Format: int32 */
            pageFrom: number;
            /** Format: int32 */
            pageTo: number;
        };
        SegmentList: {
            /** Format: uuid */
            fileId: string;
            /** Format: int32 */
            pageCount: number;
            segments: components["schemas"]["SegmentDto"][];
        };
        SessionUserDto: {
            id: string;
            username: string;
            displayName: string;
        };
        SettingDto: {
            key: string;
            value: components["schemas"]["JsonElement"];
            /** Format: date-time */
            updatedAt: string;
        };
        SignatureDto: {
            /** Format: uuid */
            id: string;
            signerName: null | string;
            certificateSerial: null | string;
            certificateIssuer: null | string;
            /** Format: date-time */
            signedAt: null | string;
            status: string;
            verifierVersion: string;
            /** Format: date-time */
            verifiedAt: string;
            details: components["schemas"]["JsonElement"];
        };
        SourceRegionDto: {
            /** Format: int32 */
            page: number;
            /** Format: double */
            x: number;
            /** Format: double */
            y: number;
            /** Format: double */
            width: number;
            /** Format: double */
            height: number;
            approximate: boolean;
        };
        SplitResult: {
            /** Format: uuid */
            sourceDocumentId: string;
            children: components["schemas"]["ChildDocument"][];
        };
        StageCounts: {
            /** Format: int32 */
            preparing: number;
            /** Format: int32 */
            awaitingCheck: number;
            /** Format: int32 */
            awaitingOpinion: number;
            /** Format: int32 */
            awaitingArchive: number;
            /** Format: int32 */
            overdue: number;
            /** Format: int32 */
            open: number;
        };
        SuspectPage: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            fileName: string;
            /** Format: int32 */
            pageNo: number;
            flags: string[];
            status: string;
        };
        TemplateDto: {
            /** Format: uuid */
            id: string;
            kind: string;
            filename: string;
            /** Format: int64 */
            byteSize: number;
            mediaType: string;
            downloadable: boolean;
        };
        Throughput: {
            /** Format: int32 */
            jobsLastHour: number;
            /** Format: int32 */
            pagesLastHour: number;
            /** Format: double */
            averageSecondsPerOcrPage: null | number;
        };
        TransitionRequest: {
            action: string;
            note: null | string;
            /** Format: int64 */
            version: null | number;
        };
        TransitionResult: {
            status: string;
            statusLabel: string;
        };
        UpdateDocumentTypeRequest: {
            name: null | string;
            documentForm: null | string;
            requiredInDossier: null | boolean;
            /** Format: int16 */
            minCount: null | number;
            active: null | boolean;
        };
        UpdateDossierRequest: {
            /** Format: uint32 */
            version: number;
            title: null | string;
            notes: null | string;
            /** Format: date */
            internalDueOn: null | string;
            accessLevel: null | string;
            physicalLocation: null | string;
            procedureId?: null | string;
        };
        UpdateFieldRequest: {
            label: null | string;
            valueType: null | string;
            requiredForReview: null | boolean;
            isKeyField: null | boolean;
            fieldGroup: null | string;
            validationPattern: null | string;
        };
        UpdateLocationRequest: {
            name: null | string;
            capacityNote: null | string;
            active: null | boolean;
        };
        UpdateSettingRequest: {
            key: string;
            value: components["schemas"]["JsonElement"];
        };
        UpdateUserRequest: {
            displayName: null | string;
            email: null | string;
            active: null | boolean;
            externalAuthSubject: null | string;
        };
        UpdateWorkGroupRequest: {
            title: null | string;
            responsibility: null | string;
            filingRule: null | string;
            businessFields: null | string;
            verificationStatus: null | string;
            active: null | boolean;
        };
        UploadResult: {
            /** Format: uuid */
            documentId: string;
            /** Format: uuid */
            fileId: string;
            /** Format: uuid */
            jobId: string;
            fileName: string;
            /** Format: int64 */
            byteSize: number;
        };
        WorkerInfo: {
            workerId: string;
            /** Format: uuid */
            jobId: string;
            stage: null | string;
            /** Format: int32 */
            heartbeatAgeSeconds: number;
        };
        WorkGroupDto: {
            code: string;
            organizationCode: string;
            departmentCode: string;
            title: string;
            responsibility: string;
            filingRule: string;
            verificationStatus: string;
            /** Format: int32 */
            documentTypeCount: number;
            /** @default true */
            active: boolean;
        };
        Workspace: {
            queues: {
                [key: string]: components["schemas"]["QueueItem"][];
            };
        };
        WorkspaceSummary: {
            counts: {
                [key: string]: number;
            };
            /** Format: int32 */
            inbox: number;
            /** Format: int32 */
            unreadNotifications: number;
        };
    };
    responses: never;
    parameters: never;
    requestBodies: never;
    headers: never;
    pathItems: never;
}
export type $defs = Record<string, never>;
export type operations = Record<string, never>;
