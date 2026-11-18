import { useState } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { Combobox, type ComboOption } from "./combobox";
import { ConfirmInline } from "./confirm-inline";
import { DateInput, Input, Select, Textarea, validateViDate } from "./input";

describe("Input, Textarea, Select", () => {
  it("nhãn gắn với ô, gợi ý và lỗi được đọc cùng ô, ô lỗi đánh dấu aria-invalid", () => {
    render(<Input label="Tên hồ sơ" required hint="Ví dụ: kiểm tra môi trường" error="Nhập tên hồ sơ." />);
    const box = screen.getByLabelText(/Tên hồ sơ/);
    expect(box).toHaveAttribute("aria-invalid", "true");
    expect(box).toHaveAccessibleDescription("Nhập tên hồ sơ. Ví dụ: kiểm tra môi trường");   // lỗi đọc trước gợi ý
    expect(screen.getByTitle("Bắt buộc")).toBeInTheDocument();
  });

  it("không lỗi thì không có aria-invalid và không có dòng lỗi", () => {
    render(<Input label="Năm" hint="Để trống thì lấy năm hiện tại." />);
    expect(screen.getByLabelText("Năm")).not.toHaveAttribute("aria-invalid");
    expect(screen.getByLabelText("Năm")).toHaveAccessibleDescription("Để trống thì lấy năm hiện tại.");
  });

  it("Textarea hiện bộ đếm ký tự theo giá trị và giới hạn", () => {
    render(<Textarea label="Ghi chú" value="abc" maxLength={4000} onChange={() => {}} />);
    expect(screen.getByText("3/4000")).toBeInTheDocument();
  });

  it("Select chọn được bằng bàn phím", async () => {
    const onChange = vi.fn();
    render(<Select label="Mức tiếp cận" defaultValue="internal" onChange={(e) => onChange(e.target.value)}><option value="internal">Nội bộ</option><option value="restricted">Hạn chế</option></Select>);
    await userEvent.selectOptions(screen.getByLabelText("Mức tiếp cận"), "restricted");
    expect(onChange).toHaveBeenCalledWith("restricted");
  });
});

describe("DateInput", () => {
  function Host() {
    const [value, setValue] = useState("");
    return <DateInput label="Hạn" value={value} onValueChange={setValue} />;
  }

  it("rời ô thì đưa ngày về dd/mm/yyyy; ngày sai lịch giữ nguyên để báo lỗi", async () => {
    render(<Host />);
    const box = screen.getByLabelText("Hạn");
    expect(box).toHaveAttribute("placeholder", "dd/mm/yyyy");
    await userEvent.type(box, "5-3-2026");
    await userEvent.tab();
    expect(box).toHaveValue("05/03/2026");
    await userEvent.clear(box);
    await userEvent.type(box, "31/02/2026");
    await userEvent.tab();
    expect(box).toHaveValue("31/02/2026");
  });

  it("validateViDate: rỗng hợp lệ, đúng lịch hợp lệ, sai thì có lời nhắc", () => {
    expect(validateViDate("")).toBeNull();
    expect(validateViDate("20/01/2026")).toBeNull();
    expect(validateViDate("31/02/2026")).toMatch(/ngày\/tháng\/năm/);
    expect(validateViDate("hôm qua")).not.toBeNull();
  });
});

const ALL: ComboOption[] = [
  { value: "a", label: "Cấp giấy phép xây dựng" },
  { value: "b", label: "Cấp giấy chứng nhận đăng ký kinh doanh", hint: "Cấp xã" },
  { value: "c", label: "Đăng ký khai sinh" },
];

function ComboHost({ onQuery = () => {}, onPicked = () => {}, loading = false }: { onQuery?: (q: string) => void; onPicked?: (o: ComboOption | null) => void; loading?: boolean }) {
  const [selected, setSelected] = useState<ComboOption | null>(null);
  const [options, setOptions] = useState(ALL);
  return (
    <form onSubmit={(e) => { e.preventDefault(); onPicked({ value: "submitted", label: "" }); }}>
      <Combobox
        label="Thủ tục"
        options={options}
        selected={selected}
        loading={loading}
        onQueryChange={(q) => { onQuery(q); setOptions(ALL.filter((o) => o.label.toLowerCase().includes(q.toLowerCase()))); }}
        onSelect={(o) => { setSelected(o); onPicked(o); }}
      />
    </form>
  );
}

describe("Combobox", () => {
  it("gõ thì mở danh sách và báo số kết quả cho trình đọc màn hình", async () => {
    const onQuery = vi.fn();
    render(<ComboHost onQuery={onQuery} />);
    const box = screen.getByRole("combobox", { name: "Thủ tục" });
    expect(box).toHaveAttribute("aria-expanded", "false");
    await userEvent.type(box, "cấp");
    expect(onQuery).toHaveBeenLastCalledWith("cấp");
    expect(box).toHaveAttribute("aria-expanded", "true");
    expect(screen.getAllByRole("option")).toHaveLength(2);
    expect(screen.getByRole("status")).toHaveTextContent("2 kết quả");
  });

  it("↓ ↑ đổi mục đang chọn, Enter chọn và KHÔNG gửi biểu mẫu", async () => {
    const onPicked = vi.fn();
    render(<ComboHost onPicked={onPicked} />);
    const box = screen.getByRole("combobox");
    await userEvent.click(box);                                   // nhận tiêu điểm là mở danh sách, mục đầu đang chọn
    await userEvent.keyboard("{ArrowDown}");
    expect(box).toHaveAttribute("aria-activedescendant", screen.getAllByRole("option")[1].id);
    expect(screen.getAllByRole("option")[1]).toHaveAttribute("aria-selected", "true");
    await userEvent.keyboard("{ArrowUp}{ArrowDown}{Enter}");
    expect(onPicked).toHaveBeenCalledTimes(1);
    expect(onPicked).toHaveBeenCalledWith(ALL[1]);
    expect(screen.queryByRole("combobox")).not.toBeInTheDocument();   // đã chọn: hiện mục đã chọn thay cho ô gõ
    expect(screen.getByText(ALL[1].label)).toBeInTheDocument();
  });

  it("Esc đóng danh sách; bấm chuột chọn được; Bỏ chọn trả về ô gõ", async () => {
    const onPicked = vi.fn();
    render(<ComboHost onPicked={onPicked} />);
    const box = screen.getByRole("combobox");
    await userEvent.click(box);
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    await userEvent.type(box, "đăng");
    await userEvent.click(screen.getByRole("option", { name: /Đăng ký khai sinh/ }));
    expect(onPicked).toHaveBeenLastCalledWith(ALL[2]);
    await userEvent.click(screen.getByRole("button", { name: /Bỏ chọn/ }));
    expect(onPicked).toHaveBeenLastCalledWith(null);
    expect(screen.getByRole("combobox")).toBeInTheDocument();
  });

  it("không có kết quả thì nói rõ; đang tìm thì nói đang tìm", async () => {
    const { rerender } = render(<ComboHost />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByRole("listbox")).toHaveTextContent("Không có kết quả");
    expect(screen.getByRole("status")).toHaveTextContent("Không có kết quả");       // trình đọc màn hình cũng được báo
    rerender(<ComboHost loading />);
    await userEvent.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByRole("listbox")).toHaveTextContent("Đang tìm");
  });
});

describe("ConfirmInline", () => {
  it("bấm thì hỏi tại chỗ, tiêu điểm vào Hủy; Hủy không làm gì và trả tiêu điểm về nút", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmInline label="Hủy việc" question="Hủy việc đọc này?" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Hủy việc" }));
    expect(screen.getByRole("group", { name: "Hủy việc đọc này?" })).toBeInTheDocument();
    expect(await screen.findByRole("button", { name: "Hủy" })).toHaveFocus();
    await userEvent.keyboard("{Enter}");
    expect(onConfirm).not.toHaveBeenCalled();
    expect(await screen.findByRole("button", { name: "Hủy việc" })).toHaveFocus();
  });

  it("Xác nhận gọi đúng một lần rồi đóng; Esc cũng hủy", async () => {
    const onConfirm = vi.fn();
    render(<ConfirmInline label="Xóa" question="Xóa trường này?" confirmLabel="Xóa luôn" onConfirm={onConfirm} />);
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await userEvent.click(screen.getByRole("button", { name: "Xóa luôn" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(await screen.findByRole("button", { name: "Xóa" })).toBeInTheDocument();
    await userEvent.click(screen.getByRole("button", { name: "Xóa" }));
    await userEvent.keyboard("{Escape}");
    expect(screen.queryByRole("group")).not.toBeInTheDocument();
    expect(onConfirm).toHaveBeenCalledTimes(1);
  });

  it("đang xử lý thì khóa nút", async () => {
    render(<ConfirmInline label="Hủy việc" question="Chắc chứ?" onConfirm={() => {}} pending />);
    expect(screen.getByRole("button", { name: "Hủy việc" })).toBeDisabled();
  });
});
