import { useState } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ProcedureOption, ProcedureSummary } from "@/app/actions/procedure";
import { ToastProvider } from "@/components/ui/toast";
import { ProcedurePicker } from "./procedure-picker";

vi.mock("next/navigation", () => ({ useRouter: () => ({ push: vi.fn(), refresh: vi.fn() }) }));
const find = vi.fn();
const load = vi.fn();
vi.mock("@/app/actions/procedure", () => ({ findProcedureOptions: (...a: unknown[]) => find(...a), loadProcedureSummary: (...a: unknown[]) => load(...a) }));

const option = (id: string, name: string, extra: Partial<ProcedureOption> = {}): ProcedureOption => ({ id, name, code: null, domain: "Hộ tịch", level: "Cấp xã", status: "Đang hiệu lực", componentCount: 3, ...extra });
const SUMMARY: ProcedureSummary = {
  id: "p1", name: "Đăng ký khai sinh", code: "1.001193",
  components: [
    { id: "c1", section: "Thành phần hồ sơ", name: "Tờ khai đăng ký khai sinh", required: true },
    { id: "c2", section: "Thành phần hồ sơ", name: "Giấy chứng sinh", required: true },
    { id: "c3", section: "Thành phần hồ sơ", name: "Giấy tờ chứng minh nơi cư trú", required: false },
  ],
};

function Host({ initial = null, onValue = () => {} }: { initial?: ProcedureSummary | null; onValue?: (v: ProcedureSummary | null) => void }) {
  const [value, setValue] = useState<ProcedureSummary | null>(initial);
  return (
    <ToastProvider>
      <ProcedurePicker value={value} onChange={(v) => { setValue(v); onValue(v); }} />
    </ToastProvider>
  );
}

beforeEach(() => {
  find.mockReset();
  load.mockReset();
});

describe("ProcedurePicker", () => {
  it("chưa gõ đủ 2 ký tự thì không gọi API và nhắc cách tìm", async () => {
    render(<Host />);
    await userEvent.type(screen.getByRole("combobox"), "k");
    expect(find).not.toHaveBeenCalled();
    expect(screen.getByRole("listbox")).toHaveTextContent("Gõ ít nhất 2 ký tự");
  });

  it("gõ liền tay chỉ gọi API một lần sau khi ngừng gõ, rồi hiện kết quả kèm lĩnh vực và số thành phần", async () => {
    find.mockResolvedValue({ ok: true, data: [option("p1", "Đăng ký khai sinh", { code: "1.001193" })] });
    render(<Host />);
    await userEvent.type(screen.getByRole("combobox"), "khai sinh");
    expect(find).not.toHaveBeenCalled();                       // còn trong thời gian chờ 300 ms
    const item = await screen.findByRole("option", { name: /Đăng ký khai sinh/ });
    expect(find).toHaveBeenCalledTimes(1);
    expect(find).toHaveBeenCalledWith("khai sinh");
    expect(item).toHaveTextContent("mã 1.001193");
    expect(item).toHaveTextContent("Hộ tịch · Cấp xã · 3 thành phần");
  });

  it("kết quả của lần gõ cũ về muộn thì bị bỏ", async () => {
    let releaseOld!: (value: unknown) => void;
    find.mockImplementationOnce(() => new Promise((resolve) => { releaseOld = resolve; }));
    find.mockResolvedValueOnce({ ok: true, data: [option("new", "Kết quả mới")] });
    render(<Host />);
    const box = screen.getByRole("combobox");
    await userEvent.type(box, "ab");
    await waitFor(() => expect(find).toHaveBeenCalledTimes(1));
    await userEvent.type(box, "c");                            // gõ tiếp khi lần tìm trước chưa về
    await screen.findByRole("option", { name: /Kết quả mới/ });
    releaseOld({ ok: true, data: [option("old", "Kết quả cũ")] });
    await new Promise((r) => setTimeout(r, 20));
    expect(screen.queryByRole("option", { name: /Kết quả cũ/ })).not.toBeInTheDocument();
    expect(screen.getByRole("option", { name: /Kết quả mới/ })).toBeInTheDocument();
  });

  it("chọn một thủ tục thì tải thành phần và báo cho form; hiện số thành phần bắt buộc", async () => {
    find.mockResolvedValue({ ok: true, data: [option("p1", "Đăng ký khai sinh")] });
    load.mockResolvedValue({ ok: true, data: SUMMARY });
    const onValue = vi.fn();
    render(<Host onValue={onValue} />);
    await userEvent.type(screen.getByRole("combobox"), "khai");
    await userEvent.click(await screen.findByRole("option", { name: /Đăng ký khai sinh/ }));
    await waitFor(() => expect(onValue).toHaveBeenCalledWith(SUMMARY));
    expect(load).toHaveBeenCalledWith("p1");
    expect(await screen.findByText(/Hồ sơ theo thủ tục này có 3 thành phần, 2 bắt buộc/)).toBeInTheDocument();
    expect(screen.getAllByText("Bắt buộc")).toHaveLength(2);
    expect(screen.getByText("Nếu có")).toBeInTheDocument();
  });

  it("bỏ thủ tục thì báo null và quay về ô tìm", async () => {
    const onValue = vi.fn();
    render(<Host initial={SUMMARY} onValue={onValue} />);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: /Bỏ thủ tục/ }));
    expect(onValue).toHaveBeenCalledWith(null);
    expect(await screen.findByRole("combobox")).toBeInTheDocument();
  });

  it("lỗi từ máy chủ hiện ngay dưới ô, không làm mất ô tìm", async () => {
    find.mockResolvedValue({ ok: false, code: "x", message: "Chưa tìm được thủ tục. Thử lại sau ít giây." });
    render(<Host />);
    await userEvent.type(screen.getByRole("combobox"), "khai");
    expect(await screen.findByText("Chưa tìm được thủ tục. Thử lại sau ít giây.")).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveAccessibleDescription(/Chưa tìm được thủ tục/);
  });
});
