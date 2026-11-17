import { act, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ToastProvider, useToast } from "./toast";

function Trigger({ onUndo }: { onUndo?: () => void }) {
  const toast = useToast();
  return (
    <>
      <button onClick={() => toast.success("Đã lưu hồ sơ", onUndo ? { label: "Hoàn tác", onClick: onUndo } : undefined)}>ok</button>
      <button onClick={() => toast.error("Chưa lưu được", "AB12CD34")}>loi</button>
    </>
  );
}

afterEach(() => vi.useRealTimers());

describe("Toast", () => {
  it("thành công đọc ở vùng status và tự đóng sau vài giây", () => {
    vi.useFakeTimers();
    render(<ToastProvider><Trigger /></ToastProvider>);
    act(() => screen.getByText("ok").click());
    expect(screen.getByRole("status")).toHaveTextContent("Đã lưu hồ sơ");
    act(() => vi.advanceTimersByTime(7000));
    expect(screen.queryByText("Đã lưu hồ sơ")).not.toBeInTheDocument();
  });

  it("lỗi dùng role=alert, kèm Mã lỗi, ở lại cho tới khi đóng bằng bàn phím", async () => {
    const user = userEvent.setup();
    render(<ToastProvider><Trigger /></ToastProvider>);
    await user.click(screen.getByText("loi"));
    expect(screen.getByRole("alert")).toHaveTextContent("Chưa lưu được");
    expect(screen.getByRole("alert")).toHaveTextContent("Mã lỗi: AB12CD34");
    await user.tab(); // tiêu điểm đang ở nút kích hoạt; Tab kế tiếp tới nút đóng của thông báo
    expect(screen.getByRole("button", { name: "Đóng thông báo" })).toHaveFocus();
    await user.keyboard("{Enter}");
    expect(screen.queryByRole("alert")).not.toBeInTheDocument();
  });

  it("nút Hoàn tác gọi hàm rồi đóng thông báo", async () => {
    const user = userEvent.setup();
    const undo = vi.fn();
    render(<ToastProvider><Trigger onUndo={undo} /></ToastProvider>);
    await user.click(screen.getByText("ok"));
    await user.click(screen.getByRole("button", { name: "Hoàn tác" }));
    expect(undo).toHaveBeenCalledOnce();
    expect(screen.queryByText("Đã lưu hồ sơ")).not.toBeInTheDocument();
  });
});
