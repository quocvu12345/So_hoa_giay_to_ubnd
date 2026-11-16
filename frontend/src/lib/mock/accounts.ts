import type { Permission, RoleCode } from "@/lib/auth/permissions";
import { ROLE_NAMES } from "@/lib/auth/permissions";
import type { Assignment } from "@/lib/auth/types";

/**
 * Tài khoản GIẢ LẬP để dựng giao diện khi chưa có API (HOSO_MOCK=1).
 * Không dùng tên cán bộ thật. Khớp tinh thần database/004_seed_demo_optional.sql.
 */
export const MOCK_ROLE_PERMISSIONS: Record<RoleCode, Permission[]> = {
  employee: [
    "dossier.read", "dossier.prepare", "dossier.submit",
    "document.view", "document.download", "document.edit",
    "intake.upload", "loan.request",
  ],
  clerk: [
    "dossier.read", "dossier.prepare", "dossier.submit", "dossier.archive", "dossier.return",
    "document.view", "document.download", "document.print", "document.edit",
    "intake.upload", "intake.manage", "intake.qc",
    "storage.manage", "loan.request", "loan.approve", "export.create", "disposal.request",
  ],
  manager: [
    "dossier.read", "dossier.assign", "dossier.accept", "dossier.escalate", "dossier.return",
    "document.view", "document.download", "loan.request", "export.create",
  ],
  chair: [
    "dossier.read", "dossier.decide", "dossier.return",
    "document.view", "document.download", "document.print", "export.create", "disposal.approve",
  ],
  council: [
    "dossier.read", "dossier.decide", "dossier.return",
    "document.view", "document.download", "document.print", "export.create", "disposal.approve",
  ],
  technical_admin: ["admin.users", "admin.settings", "catalog.manage", "processing.manage"],
};

const UBND = { organizationCode: "tl-ubnd", organizationName: "UBND phường Từ Liêm" };
const HDND = { organizationCode: "tl-hdnd", organizationName: "HĐND phường Từ Liêm" };

function assignment(id: string, role: RoleCode, org: typeof UBND | null, dept?: [string, string]): Assignment {
  return {
    id,
    role,
    roleName: ROLE_NAMES[role],
    organizationCode: org?.organizationCode ?? null,
    organizationName: org?.organizationName ?? null,
    departmentCode: dept?.[0] ?? null,
    departmentName: dept?.[1] ?? null,
  };
}

const HT: [string, string] = ["ht", "Phòng Hạ tầng - Nông nghiệp và Môi trường"];

export type MockAccount = {
  username: string;
  displayName: string;
  hint: string;
  assignments: Assignment[];
};

export const MOCK_ACCOUNTS: MockAccount[] = [
  {
    username: "mau.cv01",
    displayName: "Chuyên viên mẫu 01",
    hint: "Chuyên viên Phòng Hạ tầng, kiêm văn thư UBND — thử đổi phân công",
    assignments: [assignment("a-cv01-ht", "employee", UBND, HT), assignment("a-cv01-vt", "clerk", UBND)],
  },
  {
    username: "mau.tp.ht",
    displayName: "Trưởng phòng mẫu",
    hint: "Trưởng phòng Hạ tầng: giao việc, kiểm tra, trình lãnh đạo",
    assignments: [assignment("a-tp-ht", "manager", UBND, HT)],
  },
  {
    username: "mau.vt",
    displayName: "Văn thư mẫu",
    hint: "Văn thư / lưu trữ UBND: tiếp nhận lô quét, nộp lưu, kho bản giấy",
    assignments: [assignment("a-vt-ubnd", "clerk", UBND)],
  },
  {
    username: "mau.ct",
    displayName: "Chủ tịch UBND mẫu",
    hint: "Cho ý kiến hồ sơ được trình của khối UBND",
    assignments: [assignment("a-ct-ubnd", "chair", UBND)],
  },
  {
    username: "mau.hdnd",
    displayName: "Lãnh đạo HĐND mẫu",
    hint: "Kỳ họp, thẩm tra, giám sát của khối HĐND",
    assignments: [assignment("a-ld-hdnd", "council", HDND)],
  },
  {
    username: "mau.qt",
    displayName: "Quản trị kỹ thuật mẫu",
    hint: "Người dùng, danh mục, vận hành AI; không xem nội dung hồ sơ",
    assignments: [assignment("a-qt", "technical_admin", null)],
  },
];
