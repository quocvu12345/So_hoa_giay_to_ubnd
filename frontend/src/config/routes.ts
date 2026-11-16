import type { Route } from "next";

/**
 * Bản đồ đường dẫn của ứng dụng (docs/07-khung-giao-dien.md).
 * Quy tắc: tiếng Việt không dấu, chữ thường, nối bằng gạch ngang; danh từ số ít;
 * trang con là hành động hoặc tab của trang cha. Luôn dùng các hàm này thay vì viết chuỗi tay.
 */
export const routes = {
  login: "/dang-nhap",
  home: "/viec-cua-toi",

  intake: "/tiep-nhan",
  intakeUpload: "/tiep-nhan/tai-len",
  intakeBatches: "/tiep-nhan/lo-quet",
  intakeBatch: (batchId: string) => `/tiep-nhan/lo-quet/${batchId}` as Route,
  intakeReview: (documentId: string) => `/tiep-nhan/${documentId}/doi-chieu` as Route,
  intakeFile: (documentId: string) => `/tiep-nhan/${documentId}/xep-ho-so` as Route,
  intakeSplit: (documentId: string) => `/tiep-nhan/${documentId}/tach-van-ban` as Route,

  dossiers: "/ho-so",
  dossierNew: "/ho-so/tao-moi",
  dossier: (id: string) => `/ho-so/${id}` as Route,
  dossierDocuments: (id: string) => `/ho-so/${id}/giay-to` as Route,
  dossierAssignment: (id: string) => `/ho-so/${id}/phan-cong` as Route,
  dossierHistory: (id: string) => `/ho-so/${id}/nhat-ky` as Route,
  dossierEdit: (id: string) => `/ho-so/${id}/sua` as Route,

  archive: "/nop-luu",
  archiveSubmission: (id: string) => `/nop-luu/${id}` as Route,

  search: "/tra-cuu",
  document: (id: string) => `/giay-to/${id}` as Route,
  procedures: "/thu-tuc",
  procedure: (id: string) => `/thu-tuc/${id}` as Route,

  storage: "/kho-ban-giay",
  storageLocation: (id: string) => `/kho-ban-giay/${id}` as Route,
  loans: "/muon-tra",
  exports: "/xuat-du-lieu",
  disposals: "/de-nghi-huy",

  adminUsers: "/quan-tri/nguoi-dung",
  adminUser: (id: string) => `/quan-tri/nguoi-dung/${id}` as Route,
  adminCatalog: "/quan-tri/danh-muc",
  adminOperations: "/quan-tri/van-hanh",
  adminAudit: "/quan-tri/nhat-ky",

  notifications: "/thong-bao",
  account: "/tai-khoan",
} as const satisfies Record<string, Route | ((...args: string[]) => Route)>;
