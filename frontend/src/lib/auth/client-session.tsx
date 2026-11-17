"use client";

import { createContext, useContext, type ReactNode } from "react";

/**
 * Mã phân công đang dùng, cho mã chạy trong trình duyệt.
 * API chỉ nhận phân công qua header X-Assignment-Id; cookie hoso_assignment là httpOnly nên script không đọc được,
 * và trình duyệt không tự gửi header này cho ảnh (<img>) hay EventSource. Mọi lệnh gọi trực tiếp từ trình duyệt phải
 * tự gắn header bằng giá trị này (xem lib/api/client.ts), nếu không người kiêm nhiệm nhiều phân công sẽ bị tính theo phân công đầu danh sách.
 */
const Context = createContext<string | null>(null);

export function AssignmentProvider({ assignmentId, children }: { assignmentId: string | null; children: ReactNode }) {
  return <Context.Provider value={assignmentId}>{children}</Context.Provider>;
}

export function useAssignmentId(): string | null {
  return useContext(Context);
}
