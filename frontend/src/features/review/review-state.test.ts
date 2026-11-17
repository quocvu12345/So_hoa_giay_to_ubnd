import { describe, expect, it } from "vitest";
import {
  buildFieldEdits,
  buildMetaPayload,
  canonicalViDate,
  draftsEqual,
  formatViDate,
  initialDraft,
  mergeDraft,
  orderFields,
  parseDraft,
  parseViDate,
  pendingAttention,
  serializeDraft,
  validateDraft,
  validateField,
  validateMeta,
  type ReviewData,
  type ReviewField,
} from "./review-state";

function field(over: Partial<ReviewField> = {}): ReviewField {
  return {
    fieldCode: "F1", label: "Số", position: 1, valueType: "text", required: false, suggestedValue: null, suggestedQuote: null,
    sourcePages: [1], quoteVerified: true, value: null, needsReview: true, verified: false, attention: null, ...over,
  };
}

function review(over: Partial<ReviewData> = {}, fields: ReviewField[] = [field()]): ReviewData {
  return {
    document: {
      id: "d1", title: "scan-0001", documentForm: "Chưa xác định", documentNumber: null, issuedOn: null, origin: "internal", intakeStatus: "inbox",
      reviewStatus: "pending", metadataStatus: "unverified", version: 7, file: null, classification: null, dossiers: [], metadataReviewNote: "",
    },
    suggestion: null, fields, job: null, canEdit: true, lockedReason: null, ...over,
  } as ReviewData;
}

describe("ngày dạng ngày/tháng/năm", () => {
  it("đổi sang ISO và từ chối ngày không có thật", () => {
    expect(parseViDate("20/01/2026")).toBe("2026-01-20");
    expect(parseViDate(" 5/3/2026 ")).toBe("2026-03-05");
    expect(parseViDate("20-01-2026")).toBe("2026-01-20");
    expect(parseViDate("29/02/2024")).toBe("2024-02-29");
    expect(parseViDate("29/02/2026")).toBeNull();
    expect(parseViDate("31/04/2026")).toBeNull();
    expect(parseViDate("2026-01-20")).toBeNull();
    expect(parseViDate("")).toBeNull();
  });
  it("hiển thị ngày ISO và chuẩn hóa dấu phân cách trước khi gửi", () => {
    expect(formatViDate("2026-01-20")).toBe("20/01/2026");
    expect(formatViDate(null)).toBe("");
    expect(canonicalViDate("5-3-2026")).toBe("05/03/2026");
    expect(canonicalViDate("không phải ngày")).toBe("không phải ngày");
  });
});

describe("kiểm tra từng ô", () => {
  it("trường ngày và số báo lỗi tiếng Việt, ô trống hợp lệ", () => {
    expect(validateField({ valueType: "date" }, "")).toBeNull();
    expect(validateField({ valueType: "date" }, "31/02/2026")).toMatch(/ngày\/tháng\/năm/);
    expect(validateField({ valueType: "number" }, "80,5")).toBeNull();
    expect(validateField({ valueType: "number" }, "1.250.000")).toBeNull();
    expect(validateField({ valueType: "number" }, "tám mươi")).toMatch(/Nhập số/);
    expect(validateField({ valueType: "text" }, "x".repeat(2001))).toMatch(/2000/);
  });
  it("đầu văn bản bắt buộc tiêu đề và hình thức, không nhận 'Chưa xác định'", () => {
    const errors = validateMeta({ title: " ", documentForm: "Chưa xác định", documentNumber: "", issuedOn: "99/99/2026", note: "" });
    expect(Object.keys(errors).sort()).toEqual(["meta.documentForm", "meta.issuedOn", "meta.title"]);
    expect(validateMeta({ title: "Kế hoạch năm 2026", documentForm: "Kế hoạch", documentNumber: "26/KH-UBND", issuedOn: "20/01/2026", note: "" })).toEqual({});
  });
  it("gộp lỗi trường và đầu văn bản", () => {
    const data = review({}, [field({ fieldCode: "D", valueType: "date" })]);
    const draft = initialDraft(data);
    draft.fields.D.value = "bad";
    draft.meta.title = "Tiêu đề hợp lệ";
    draft.meta.documentForm = "Công văn";
    expect(Object.keys(validateDraft(data, draft))).toEqual(["D"]);
  });
});

describe("dựng nháp từ dữ liệu API", () => {
  it("giá trị đã lưu thắng gợi ý AI; chưa có thì lấy gợi ý", () => {
    const data = review({}, [field({ fieldCode: "A", value: "đã sửa", suggestedValue: "AI" }), field({ fieldCode: "B", suggestedValue: "AI-B" }), field({ fieldCode: "C" })]);
    const draft = initialDraft(data);
    expect(draft.fields.A.value).toBe("đã sửa");
    expect(draft.fields.B.value).toBe("AI-B");
    expect(draft.fields.C.value).toBe("");
  });
  it("đầu văn bản chưa xác nhận lấy gợi ý của AI, đã xác nhận giữ nguyên", () => {
    const suggestion = { title: "Kế hoạch năm 2026", documentForm: "Kế hoạch" } as ReviewData["suggestion"];
    const fresh = initialDraft(review({ suggestion }));
    expect(fresh.meta.title).toBe("Kế hoạch năm 2026");
    expect(fresh.meta.documentForm).toBe("Kế hoạch");
    const base = review({ suggestion });
    const checked = initialDraft({ ...base, document: { ...base.document, metadataStatus: "header_checked", title: "Tiêu đề đã xác nhận", documentForm: "Công văn", issuedOn: "2026-01-20" } });
    expect(checked.meta).toMatchObject({ title: "Tiêu đề đã xác nhận", documentForm: "Công văn", issuedOn: "20/01/2026" });
  });
  it("trường cần chú ý đứng đầu, còn lại giữ thứ tự danh mục", () => {
    const ordered = orderFields([field({ fieldCode: "1", position: 1 }), field({ fieldCode: "2", position: 2, attention: "xem" }), field({ fieldCode: "3", position: 3 })]);
    expect(ordered.map((f) => f.fieldCode)).toEqual(["2", "1", "3"]);
  });
  it("chặn xác nhận khi trường cần chú ý chưa đánh dấu đã kiểm", () => {
    const data = review({}, [field({ fieldCode: "A", attention: "xem" }), field({ fieldCode: "B" })]);
    const draft = initialDraft(data);
    expect(pendingAttention(data, draft).map((f) => f.fieldCode)).toEqual(["A"]);
    draft.fields.A.confirmed = true;
    expect(pendingAttention(data, draft)).toEqual([]);
  });
});

describe("so sánh nháp", () => {
  it("nhận ra thay đổi ở trường, cờ đã kiểm và đầu văn bản", () => {
    const base = initialDraft(review());
    expect(draftsEqual(base, initialDraft(review()))).toBe(true);
    const edited = structuredClone(base);
    edited.fields.F1.value = "x";
    expect(draftsEqual(base, edited)).toBe(false);
    const confirmed = structuredClone(base);
    confirmed.fields.F1.confirmed = true;
    expect(draftsEqual(base, confirmed)).toBe(false);
    const meta = structuredClone(base);
    meta.meta.note = "ghi chú";
    expect(draftsEqual(base, meta)).toBe(false);
  });
});

describe("tải trọng gửi API", () => {
  it("xác nhận mọi trường; ô trống thành null; ngày chuẩn hóa dấu phân cách", () => {
    const data = review({}, [field({ fieldCode: "A" }), field({ fieldCode: "D", valueType: "date" })]);
    const draft = initialDraft(data);
    draft.fields.A.value = "  ";
    draft.fields.D.value = "5-3-2026";
    expect(buildFieldEdits(data, draft)).toEqual([
      { fieldCode: "A", value: null, verify: true },
      { fieldCode: "D", value: "05/03/2026", verify: true },
    ]);
  });
  it("đầu văn bản: cắt khoảng trắng, ngày ISO, trống thành null", () => {
    expect(buildMetaPayload({ title: " Kế hoạch ", documentForm: " Kế hoạch ", documentNumber: " ", issuedOn: "20/01/2026", note: "" })).toEqual({
      title: "Kế hoạch", documentForm: "Kế hoạch", documentNumber: null, issuedOn: "2026-01-20", note: null,
    });
  });
});

describe("nháp trong sessionStorage", () => {
  const draft = initialDraft(review());
  const now = new Date("2026-11-17T08:00:00Z");

  it("lưu rồi đọc lại đúng phiên bản giấy tờ", () => {
    const restored = parseDraft(serializeDraft(7, draft, now), 7);
    expect(restored?.savedAt).toBe(now.toISOString());
    expect(restored?.draft).toEqual(draft);
  });
  it("bỏ nháp khi giấy tờ đã đổi phiên bản, hỏng, hoặc không có", () => {
    expect(parseDraft(serializeDraft(7, draft, now), 8)).toBeNull();
    expect(parseDraft("{không phải json", 7)).toBeNull();
    expect(parseDraft(JSON.stringify({ v: 99, docVersion: 7, savedAt: "x", draft }), 7)).toBeNull();
    expect(parseDraft(null, 7)).toBeNull();
  });
  it("phủ nháp chỉ giữ trường còn tồn tại", () => {
    const base = initialDraft(review({}, [field({ fieldCode: "A" })]));
    const saved = structuredClone(base);
    saved.fields.A.value = "đã gõ";
    saved.fields.GONE = { value: "trường của loại cũ", confirmed: true };
    const merged = mergeDraft(base, saved);
    expect(merged.fields.A.value).toBe("đã gõ");
    expect("GONE" in merged.fields).toBe(false);
  });
});
