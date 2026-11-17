"use client";

import { LogOut } from "lucide-react";
import { clearAssignment } from "@/app/actions/session";

/**
 * Đăng xuất do API .NET xử lý (form POST, xóa phiên và kết thúc phiên ở Keycloak).
 * Trước khi gửi, xóa cookie phân công của Next để người đăng nhập sau trên cùng máy không mang phân công cũ.
 * Không có JavaScript thì form vẫn gửi bình thường (API đã chịu được cookie phân công cũ).
 */
export function LogoutButton() {
  return (
    <form
      action="/api/v1/auth/logout"
      method="post"
      onSubmit={(event) => {
        event.preventDefault();
        const form = event.currentTarget;
        void clearAssignment()
          .catch(() => undefined)
          .finally(() => form.submit());
      }}
    >
      <button type="submit" className="grid size-10 place-items-center border border-line hover:border-primary" aria-label="Đăng xuất">
        <LogOut aria-hidden className="size-5" />
      </button>
    </form>
  );
}
