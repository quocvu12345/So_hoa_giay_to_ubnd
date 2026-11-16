import type { Route } from "next";
import {
  Archive,
  BookOpen,
  Boxes,
  ClipboardList,
  FileSearch,
  FileStack,
  HandHelping,
  Inbox,
  type LucideIcon,
  PackageOpen,
  ScrollText,
  Settings2,
  ShieldCheck,
  Trash2,
  Users,
} from "lucide-react";
import type { Permission } from "@/lib/auth/permissions";
import { routes } from "./routes";

export type NavItem = {
  href: Route;
  label: string;
  /** Một câu nói rõ màn này để làm gì; hiện trong ô Đi nhanh và tooltip. */
  description: string;
  icon: LucideIcon;
  /** Hiện khi có ít nhất một quyền trong danh sách. Bỏ trống = mọi người đã đăng nhập. */
  permission?: Permission | Permission[];
  /** Từ khóa thêm cho ô Đi nhanh (không dấu). */
  keywords?: string;
};

export type NavGroup = { label: string; items: NavItem[] };

/**
 * Menu chính, MỘT nguồn duy nhất cho sidebar, ô Đi nhanh (Ctrl+K) và trang Việc của tôi.
 * Thứ tự nhóm theo tần suất dùng: việc hằng ngày → tra cứu → kho và bàn giao → quản trị.
 * Mỗi nhóm tối đa 5 mục để quét mắt nhanh.
 */
export const NAVIGATION: NavGroup[] = [
  {
    label: "Công việc",
    items: [
      { href: routes.home, label: "Việc của tôi", description: "Những việc đang chờ bạn xử lý theo phân công", icon: ClipboardList, keywords: "viec cua toi trang chu" },
      { href: routes.intake, label: "Tiếp nhận PDF", description: "Nạp bản quét, xem AI đọc, đối chiếu và xếp vào hồ sơ", icon: Inbox, permission: ["intake.upload", "intake.manage"], keywords: "tiep nhan scan quet pdf doi chieu" },
      { href: routes.dossiers, label: "Hồ sơ", description: "Danh sách hồ sơ trong phạm vi của bạn", icon: FileStack, permission: "dossier.read", keywords: "ho so danh sach" },
      { href: routes.archive, label: "Nộp lưu", description: "Hồ sơ chờ tiếp nhận nộp lưu và các đợt nộp lưu", icon: Archive, permission: "dossier.archive", keywords: "nop luu luu tru" },
    ],
  },
  {
    label: "Tra cứu",
    items: [
      { href: routes.search, label: "Tra cứu văn bản", description: "Tìm theo số ký hiệu, trích yếu hoặc nội dung đã đọc", icon: FileSearch, permission: "document.view", keywords: "tra cuu tim kiem van ban" },
      { href: routes.procedures, label: "Thủ tục hành chính", description: "Danh mục thủ tục, thành phần hồ sơ và mẫu biểu", icon: BookOpen, keywords: "thu tuc hanh chinh mau bieu" },
    ],
  },
  {
    label: "Kho & bàn giao",
    items: [
      { href: routes.storage, label: "Kho bản giấy", description: "Kho, tủ, kệ, hộp và vị trí hồ sơ giấy", icon: Boxes, permission: "storage.manage", keywords: "kho ban giay tu ke hop qr" },
      { href: routes.loans, label: "Mượn trả", description: "Đề nghị mượn, duyệt và theo dõi trả hồ sơ giấy", icon: HandHelping, permission: ["loan.request", "loan.approve"], keywords: "muon tra" },
      { href: routes.exports, label: "Xuất dữ liệu", description: "Tạo gói bàn giao gồm tệp, dữ liệu mô tả và mã băm", icon: PackageOpen, permission: "export.create", keywords: "xuat du lieu ban giao" },
      { href: routes.disposals, label: "Đề nghị hủy", description: "Đề nghị và phê duyệt hủy tài liệu hết thời hạn bảo quản", icon: Trash2, permission: ["disposal.request", "disposal.approve"], keywords: "de nghi huy" },
    ],
  },
  {
    label: "Quản trị",
    items: [
      { href: routes.adminUsers, label: "Người dùng & phân công", description: "Tài khoản, phân công có thời hạn và ủy quyền", icon: Users, permission: "admin.users", keywords: "nguoi dung phan cong uy quyen" },
      { href: routes.adminCatalog, label: "Danh mục", description: "Nhóm hồ sơ, loại giấy tờ, trường dữ liệu, thời hạn bảo quản", icon: ScrollText, permission: "catalog.manage", keywords: "danh muc loai giay to truong" },
      { href: routes.adminOperations, label: "Vận hành", description: "Hàng đợi AI, mô hình, sao lưu và cài đặt", icon: Settings2, permission: ["processing.manage", "admin.settings"], keywords: "van hanh ai sao luu" },
      { href: routes.adminAudit, label: "Nhật ký hệ thống", description: "Ai đã xem, sửa, tải, xuất gì và khi nào", icon: ShieldCheck, permission: "admin.settings", keywords: "nhat ky kiem toan audit" },
    ],
  },
];

export function visibleNavigation(granted: readonly Permission[]): NavGroup[] {
  return NAVIGATION.map((group) => ({
    ...group,
    items: group.items.filter((item) => {
      if (!item.permission) return true;
      const required = typeof item.permission === "string" ? [item.permission] : item.permission;
      return required.some((p) => granted.includes(p));
    }),
  })).filter((group) => group.items.length > 0);
}
