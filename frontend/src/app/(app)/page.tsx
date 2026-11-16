import { redirect } from "next/navigation";
import { routes } from "@/config/routes";

/** Trang gốc luôn mở Việc của tôi: màn đầu tiên là việc cần làm, không phải bảng tổng quan chung. */
export default function Root() {
  redirect(routes.home);
}
