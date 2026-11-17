/**
 * Dữ liệu GIẢ LẬP cho khung giao diện. Không phải hồ sơ thực tế của cơ quan.
 * Thay bằng gọi API ở các task FE-20 trở đi.
 */
export type WorkflowState = "draft" | "returned" | "department_review" | "leadership_review" | "ready_archive" | "archived";

export const WORKFLOW_LABELS: Record<WorkflowState, string> = {
  draft: "Đang chuẩn bị",
  returned: "Yêu cầu bổ sung",
  department_review: "Chờ trưởng phòng / Ban",
  leadership_review: "Chờ lãnh đạo cho ý kiến",
  ready_archive: "Chờ tiếp nhận nộp lưu",
  archived: "Đã lưu trữ",
};

export type MockDossier = {
  id: string;
  code: string;
  title: string;
  workGroup: string;
  department: string;
  status: WorkflowState;
  assignee: string;
  dueOn: string | null;
  documentCount: number;
  verifiedCount: number;
  updatedAt: string;
};

export const MOCK_DOSSIERS: MockDossier[] = [
  { id: "d-0002", code: "DEMO-2026-0002", title: "Hồ sơ kiểm tra môi trường tại cơ sở minh họa A", workGroup: "U16 · Môi trường", department: "Hạ tầng", status: "returned", assignee: "Chuyên viên mẫu 01", dueOn: "2026-11-28", documentCount: 4, verifiedCount: 2, updatedAt: "2026-11-14" },
  { id: "d-0005", code: "DEMO-2026-0005", title: "Hồ sơ cấp phép đào đường ngõ 12 (mẫu)", workGroup: "U14 · Hạ tầng giao thông", department: "Hạ tầng", status: "draft", assignee: "Chuyên viên mẫu 01", dueOn: "2026-11-20", documentCount: 2, verifiedCount: 0, updatedAt: "2026-11-15" },
  { id: "d-0003", code: "DEMO-2026-0003", title: "Hồ sơ chuyển nhượng, biến động đất đai (bộ test)", workGroup: "U15 · Đất đai", department: "Hạ tầng", status: "department_review", assignee: "Chuyên viên mẫu 01", dueOn: "2026-11-19", documentCount: 6, verifiedCount: 6, updatedAt: "2026-11-13" },
  { id: "d-0007", code: "DEMO-2026-0007", title: "Hồ sơ chương trình công tác năm 2026", workGroup: "U02 · Chỉ đạo, điều hành", department: "Văn phòng", status: "leadership_review", assignee: "Chuyên viên mẫu 02", dueOn: null, documentCount: 5, verifiedCount: 5, updatedAt: "2026-11-12" },
  { id: "d-0004", code: "DEMO-2026-0004", title: "Hồ sơ kỳ họp thường lệ cuối năm của HĐND (mẫu)", workGroup: "H01 · Kỳ họp HĐND", department: "Thường trực HĐND", status: "ready_archive", assignee: "Chuyên viên mẫu 02", dueOn: null, documentCount: 9, verifiedCount: 9, updatedAt: "2026-11-10" },
  { id: "d-0001", code: "DEMO-2026-0001", title: "Chứng từ ngân sách quý III (mẫu)", workGroup: "U05 · Ngân sách", department: "Kinh tế", status: "archived", assignee: "Chuyên viên mẫu 02", dueOn: null, documentCount: 3, verifiedCount: 3, updatedAt: "2026-11-02" },
];

export type MockInboxItem = {
  id: string;
  fileName: string;
  pages: number;
  uploadedAt: string;
  stage: "queued" | "reading" | "ready" | "failed";
  queuePosition?: number;
  /** Khay của việc đang chờ: priority (làm ngay) | interactive (có người chờ) | background (khay nền, PDF mới nạp). */
  queueKind?: "priority" | "interactive" | "background";
  /** Giây chờ ước tính từ số đo thật; thiếu thì không hiện. */
  etaSeconds?: number;
  progress?: string;
  suggestion?: string;
  attentionCount?: number;
};

export const MOCK_INBOX: MockInboxItem[] = [
  { id: "doc-26kh", fileName: "26-KH-UBND.pdf", pages: 4, uploadedAt: "08:41", stage: "ready", suggestion: "Kế hoạch · U02 Chỉ đạo, điều hành", attentionCount: 1 },
  { id: "doc-bbkt", fileName: "bien-ban-kiem-tra-hien-truong.pdf", pages: 3, uploadedAt: "08:43", stage: "reading", progress: "Đang đọc trang 2/3" },
  { id: "doc-tt12", fileName: "to-trinh-12.pdf", pages: 2, uploadedAt: "08:44", stage: "queued", queuePosition: 2, queueKind: "background", etaSeconds: 95 },
  { id: "doc-ct05", fileName: "cong-van-05.pdf", pages: 1, uploadedAt: "08:44", stage: "queued", queuePosition: 3, queueKind: "background" },
  { id: "doc-hd88", fileName: "hop-dong-88.pdf", pages: 3, uploadedAt: "08:45", stage: "queued", queuePosition: 1, queueKind: "priority", etaSeconds: 40 },
  { id: "doc-scan7", fileName: "scan_0007.pdf", pages: 12, uploadedAt: "08:45", stage: "failed", progress: "Trang 7 đọc lỗi, có thể đọc lại riêng trang này" },
];

export const MOCK_CHECKLIST = [
  { name: "Tờ trình đề nghị", state: "ok" as const, note: "Đã đối chiếu" },
  { name: "Quyết định phê duyệt", state: "ok" as const, note: "Đã đối chiếu" },
  { name: "Biên bản kiểm tra hiện trường", state: "pending" as const, note: "2 trường chưa xác nhận" },
  { name: "Báo cáo kết quả thực hiện", state: "missing" as const, note: "Còn thiếu" },
];

export const MOCK_TIMELINE = [
  { at: "14/11/2026 15:20", who: "Trưởng phòng mẫu", action: "Trả lại", note: "Thiếu báo cáo kết quả, bổ sung trước khi trình lại." },
  { at: "12/11/2026 09:05", who: "Chuyên viên mẫu 01", action: "Trình trưởng phòng", note: "" },
  { at: "10/11/2026 16:40", who: "Chuyên viên mẫu 01", action: "Tạo hồ sơ từ PDF tiếp nhận", note: "" },
];

export const MOCK_NOTIFICATIONS = [
  { id: "n1", title: "Hồ sơ DEMO-2026-0002 bị trả lại", body: "Thiếu báo cáo kết quả, bổ sung trước khi trình lại.", at: "14/11 15:20", read: false },
  { id: "n2", title: "26-KH-UBND.pdf đã đọc xong", body: "1 trường cần xác nhận.", at: "08:47", read: false },
  { id: "n3", title: "Hồ sơ DEMO-2026-0005 còn 4 ngày đến hạn", body: "Hạn nội bộ 20/11/2026.", at: "Hôm qua", read: true },
];
