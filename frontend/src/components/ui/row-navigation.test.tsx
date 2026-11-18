import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it } from "vitest";
import { nextRowIndex, RowNavigation } from "./row-navigation";

const always = () => true;

function List({ withInput = false }: { withInput?: boolean }) {
  return (
    <div>
      <RowNavigation visible={always} />
      {withInput && <input aria-label="Từ khóa" />}
      <a href="/a" data-row>Hồ sơ A</a>
      <a href="/b" data-row>Hồ sơ B</a>
      <a href="/c" data-row>Hồ sơ C</a>
      <a href="/khac">Liên kết thường</a>
    </div>
  );
}

describe("nextRowIndex", () => {
  it("↓ ↑ dừng ở hai đầu, chưa chọn dòng nào thì ↓ vào dòng đầu và ↑ vào dòng cuối", () => {
    expect(nextRowIndex("ArrowDown", -1, 3)).toBe(0);
    expect(nextRowIndex("ArrowDown", 2, 3)).toBe(2);
    expect(nextRowIndex("ArrowUp", -1, 3)).toBe(2);
    expect(nextRowIndex("ArrowUp", 0, 3)).toBe(0);
    expect(nextRowIndex("Home", 2, 3)).toBe(0);
    expect(nextRowIndex("End", 0, 3)).toBe(2);
    expect(nextRowIndex("ArrowDown", -1, 0)).toBe(-1);
    expect(nextRowIndex("x", 0, 3)).toBe(-1);
  });
});

describe("RowNavigation", () => {
  it("↓ ↑ chuyển tiêu điểm giữa các dòng, chỉ qua liên kết dòng", async () => {
    const user = userEvent.setup();
    render(<List />);
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("Hồ sơ A")).toHaveFocus();
    await user.keyboard("{ArrowDown}{ArrowDown}");
    expect(screen.getByText("Hồ sơ C")).toHaveFocus();
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("Hồ sơ C")).toHaveFocus();
    await user.keyboard("{ArrowUp}");
    expect(screen.getByText("Hồ sơ B")).toHaveFocus();
    await user.keyboard("{Home}");
    expect(screen.getByText("Hồ sơ A")).toHaveFocus();
    await user.keyboard("{End}");
    expect(screen.getByText("Hồ sơ C")).toHaveFocus();
  });

  it("ô nhập giữ phím mũi tên của nó, không bị chiếm", async () => {
    const user = userEvent.setup();
    render(<List withInput />);
    await user.click(screen.getByLabelText("Từ khóa"));
    await user.keyboard("{ArrowDown}{Home}");
    expect(screen.getByLabelText("Từ khóa")).toHaveFocus();
  });

  it("tổ hợp có Ctrl, Alt, ⌘, Shift không bị chiếm", async () => {
    const user = userEvent.setup();
    render(<List />);
    await user.keyboard("{Control>}{ArrowDown}{/Control}");
    await user.keyboard("{Shift>}{ArrowDown}{/Shift}");
    expect(document.body).toHaveFocus();
  });

  it("không có dòng nào đang hiện thì không chiếm phím (trang cuộn như thường)", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <RowNavigation visible={() => false} />
        <a href="/a" data-row>Ẩn</a>
      </div>,
    );
    await user.keyboard("{ArrowDown}");
    expect(document.body).toHaveFocus();
  });

  it("nhường phím cho hộp thoại đang mở", async () => {
    const user = userEvent.setup();
    render(
      <div>
        <RowNavigation visible={always} />
        <a href="/a" data-row>Hồ sơ A</a>
        <div role="dialog" aria-label="Hộp thoại"><button>Trong hộp thoại</button></div>
      </div>,
    );
    await user.click(screen.getByText("Trong hộp thoại"));
    await user.keyboard("{ArrowDown}");
    expect(screen.getByText("Trong hộp thoại")).toHaveFocus();
  });
});
