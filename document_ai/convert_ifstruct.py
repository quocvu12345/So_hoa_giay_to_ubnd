"""Giữ tương thích lệnh chuyển IFStruct; dùng chung bộ chuyển Qwen text."""
from .convert_qwen import convert_checkpoint


def main():
    convert_checkpoint("ifstruct")


if __name__ == "__main__":
    main()
