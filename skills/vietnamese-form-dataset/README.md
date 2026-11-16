# Sinh bộ dữ liệu hồ sơ

`build_dossiers.py` giữ kho mẫu nguồn tại `data/tuliem-dossiers/`: 425 mục,
hai kịch bản cho mỗi mục, PDF chỉ có ở những bộ tìm được biểu mẫu nguồn.

`build_complete_dossiers.py` bổ sung bộ kiểm thử tại
`data/tuliem-dossiers-full/`: đúng **425 × 2 = 850 bộ có PDF**, giấy tờ tự dựng
có nhãn giả lập, mẫu nguồn đã điền được sao chép nguyên vẹn. Hai bộ dùng người
khai khác nhau; giấy tờ trong cùng bộ dùng chung profile.

```sh
/Volumes/quocDisk/AI/document-samples/venv/bin/python skills/vietnamese-form-dataset/scripts/build_complete_dossiers.py --root . --copies 2 --phase all --resume
```

Các giai đoạn: `plan`, `generate`, `verify`, `package`. Chạy riêng `verify`
để kiểm tra 850 PDF, từng giấy tờ theo checklist, giá trị dùng chung, tọa độ,
mã băm và trang gộp. `--resume` chỉ dùng lại bộ có chữ ký bộ sinh và mã băm
PDF khớp; seed phải khớp profile của kho nguồn để tái sử dụng các mẫu đã điền.

338 mục có mô tả thành phần nguồn; 87 mục chưa có chi tiết dùng danh sách
thành phần giả định công khai trong `synthetic_papers.py`. Trong số này, 32
mã đã thay đổi chỉ sinh mô phỏng lịch sử. Không đổi các con số này thành
khẳng định đủ nguồn chính thức hoặc đủ điều kiện nộp hành chính.

Mỗi thành phần được chọn phải có PDF thực tế. Dòng gộp nhiều giấy tờ được
tách thành các mục con. Giữ nguyên hướng dẫn, điều kiện và các nhánh không
chọn trong checklist. Một bản mẫu đại diện cho mỗi loại giấy tờ, số lượng
bản chính/bản sao nguồn được lưu riêng. Đáp án gồm giá trị và tọa độ được
giữ trong JSON; PDF chỉ chứa ảnh raster, không chứa đáp án ẩn.

Mở `/tuliem-dossiers-full/` để xem danh mục; ZIP từng thủ tục có đủ hai bộ,
PDF riêng, PDF gộp, profile, checklist và đáp án. ZIP toàn bộ có tên
`tuliem-dossiers-full.zip`. Dịch vụ inbox ưu tiên bộ đầy đủ sau khi kiểm tra
thành công, giữ danh mục cũ tại `/tuliem-dossiers/` để đối chiếu.
