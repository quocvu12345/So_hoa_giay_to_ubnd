/** Nhãn tiếng Việt cho giá trị API của giấy tờ. Không dùng "server-only" để dùng được cả ở trình duyệt và test. */
export const RELATION_LABELS: Record<string, { out: string; in: string }> = {
  appendix_of: { out: "Là phụ lục của", in: "Có phụ lục" },
  replaces: { out: "Thay thế", in: "Bị thay thế bởi" },
  amends: { out: "Sửa đổi", in: "Bị sửa đổi bởi" },
  responds_to: { out: "Trả lời", in: "Được trả lời bởi" },
  related: { out: "Liên quan tới", in: "Liên quan tới" },
};

export const SIGNATURE_STATUS: Record<string, { label: string; tone: "ok" | "bad" | "warn" | "neutral" }> = {
  valid: { label: "Chữ ký toàn vẹn", tone: "ok" },
  invalid: { label: "Chữ ký không khớp nội dung", tone: "bad" },
  revoked: { label: "Chứng thư đã bị thu hồi", tone: "bad" },
  unknown: { label: "Chưa xác định được", tone: "warn" },
};

export const REVIEW_STATUS: Record<string, string> = { verified: "Đã đối chiếu", pending: "Chưa đối chiếu" };
export const INTAKE_STATUS: Record<string, string> = { inbox: "Ở hộp tiếp nhận", filed: "Đã xếp vào hồ sơ", discarded: "Đã bỏ", split: "Đã tách thành văn bản con" };
