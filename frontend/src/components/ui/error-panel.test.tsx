import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, problemFrom } from "@/lib/api/problem";
import { ErrorPanel } from "./error-panel";

vi.mock("next/link", () => ({ default: ({ href, children }: { href: string; children: React.ReactNode }) => <a href={href}>{children}</a> }));

afterEach(() => vi.restoreAllMocks());

describe("ErrorPanel", () => {
  it("lỗi từ API hiện đúng mã lỗi của API và chỉ chỗ tra cứu", () => {
    render(<ErrorPanel error={new ApiError(problemFrom(500, { errorId: "K7M2QX4P", detail: "x" }))} retry={() => {}} />);
    expect(screen.getByText("K7M2QX4P")).toBeInTheDocument();
    expect(screen.getByRole("alert")).toHaveTextContent("Nhật ký hệ thống");
    expect(screen.getByRole("alert")).not.toHaveTextContent("Lỗi hệ thống không có mã");     // không lộ thông điệp kỹ thuật
  });

  it("Sao chép mã đưa mã vào clipboard và báo đã sao chép", async () => {
    const user = userEvent.setup();
    const writeText = vi.spyOn(navigator.clipboard, "writeText").mockResolvedValue();
    render(<ErrorPanel error={new ApiError(problemFrom(500, { errorId: "K7M2QX4P" }))} retry={() => {}} />);
    await user.click(screen.getByRole("button", { name: "Sao chép mã" }));
    expect(writeText).toHaveBeenCalledWith("K7M2QX4P");
    expect(await screen.findByText("Đã sao chép")).toBeInTheDocument();
  });

  it("không chép được thì không báo đã sao chép; Thử lại gọi retry", async () => {
    const user = userEvent.setup();
    vi.spyOn(navigator.clipboard, "writeText").mockRejectedValue(new Error("denied"));
    const retry = vi.fn();
    render(<ErrorPanel error={Object.assign(new Error("x"), { digest: "123456" })} retry={retry} />);
    await user.click(screen.getByRole("button", { name: "Sao chép mã" }));
    expect(screen.queryByText("Đã sao chép")).not.toBeInTheDocument();
    await user.click(screen.getByRole("button", { name: "Thử lại" }));
    expect(retry).toHaveBeenCalledTimes(1);
  });

  it("lỗi không có mã thì không hiện dòng Mã lỗi", () => {
    render(<ErrorPanel error={new Error("x")} retry={() => {}} />);
    expect(screen.queryByText(/Mã lỗi:/)).not.toBeInTheDocument();
  });
});
