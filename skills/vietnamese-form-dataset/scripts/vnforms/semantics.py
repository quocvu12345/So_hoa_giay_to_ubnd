"""Conservative typed value generation; unknowns stay in a review queue."""
import datetime as dt
import hashlib
import random
import re
import unicodedata


def fold(text):
    return ''.join(c for c in unicodedata.normalize('NFD', str(text).lower()) if unicodedata.category(c) != 'Mn').replace('đ', 'd')


def infer(label, context='', role='applicant'):
    # Some PDF line objects repeat earlier dotted fields in the prefix of a
    # later run. Interpret the final local printed label, never its neighbour.
    pieces = re.split(r'(?:\.[ \t]*){2,}|…+|_{3,}', label)
    if len(pieces) > 1 and pieces[-1].strip(' ,;:'):
        label = pieces[-1]
    indexed = list(re.finditer(r'\[\d+[a-z]?\]', label, re.I))
    if indexed:
        label = label[indexed[-1].end():]
    original_label = re.sub(r'\s+', ' ', unicodedata.normalize('NFC', label).casefold()).strip(' :;,-.<>')
    s = re.sub(r'\[\d+[a-z]?\]|\(\d+\)', '', fold(label))
    s = re.sub(r'\s+', ' ', s).strip(' :;,-.<>')
    s = re.sub(r'^\d+[.)]\s*', '', s)
    c = fold(context)
    # The page context is not a substitute for a label: no copying values into
    # unnamed dot continuations, decorative separators, or signature lines.
    if not s or s in {'/','-'}:
        return None
    if original_label.startswith('sở') or original_label in {'tử','sinh là hóa đơn'}:
        return None
    if len(s) > 65 and re.search(r'theo quy dinh|theo phuong phap|truong hop.*de nghi.*co quan|sinh la hoa don', s):
        return None
    if re.search(r'^mau so|^phu luc|^can cu|^giai thich|^luu\b|^lenh so|^nghi dinh|^thong tu|^phap lenh|giay to khac co lien quan|^nhan;|^nhan,', s):
        return None
    if re.search(r'kinh gui|gui den', s):
        return 'recipient'
    if re.search(r'(^|[,;(])\s*ky(?:,| ten| va| ghi)|ky ten|dong dau|thu truong|chu tich|truong phong|nguoi tiep nhan|can bo tiep nhan|xac nhan cua|chu ky', s):
        return None
    if re.fullmatch(r'st\s*t(?:\s*\(\d+\))?', s):
        return 'ordinal'
    if re.search(r'bo sung lan thu', s):
        return 'amendment_number'
    if 'ten nguoi nop thue' in s and not re.search(r'ap dung.*ca nhan|danh cho ca nhan', c):
        return 'organization.name'
    if re.search(r'(\bho va ten\b|\bho,? chu dem\b|\bho ten\b|ten khai sinh|ten day du|toi ten|toi la|\bong\s*\(?ba\b|ten nguoi|nguoi dai dien|ten ca nhan)', s):
        return 'person.name'
    if re.search(r'ten goi khac|bi danh|ten khac', s):
        return 'alias'
    if re.search(r'(ten|ho).*(cha|me|vo|chong|con)', s) and not re.search(r'cong|cong ty|co quan', s):
        return 'person.name'
    if re.search(r'(ten|don vi).*(doanh nghiep|cong ty|to chuc|ho kinh doanh|hop tac xa|co so|phap nhan|co quan|trung tam)|ten thuong mai|ten bang tieng viet', s):
        return 'organization.name'
    if re.search(r'(ten truong|truong dang hoc|truong hoc|co so giao duc)', s):
        return 'school'
    if re.search(r'so dien thoai|dien thoai|dien thoai di dong|\bdt\b|\btel\b', s):
        return 'phone'
    if re.search(r'thu dien tu|e.?mail|dia chi mail', s):
        return 'email'
    if 'fax' in s:
        return 'fax'
    if re.search(r'website|trang thong tin', s):
        return 'website'
    if re.search(r'ma so thue|ma s[oố].?thue|\bmst\b|ma so nguoi nop thue', s):
        return 'tax_id'
    if re.search(r'so tai khoan|tai khoan so|ma tai khoan', s):
        return 'bank_account'
    if 'ngan hang' in s:
        return 'bank'
    if re.search(r'dinh danh|cccd|cmnd|chung minh|can cuoc|ho chieu|giay to tuy than|so giay to phap ly', s):
        return 'person.id' if not re.search(r'loai|ten giay to', s) else 'identity_type'
    if re.search(r'ngay.{0,18}sinh|sinh ngay|sinh nam|nam sinh|^sinh$', s):
        return 'person.birth_year' if ('nam sinh' in s or 'sinh nam' in s) and 'ngay' not in s else 'person.dob'
    if re.search(r'gioi tinh|nam\s*[/\(]\s*nu', s):
        return 'person.gender'
    if re.search(r'dan toc', s):
        return 'ethnicity'
    if re.search(r'quoc tich', s):
        return 'nationality'
    if re.search(r'que quan|nguyen quan', s):
        return 'hometown'
    if re.search(r'noi sinh', s):
        return 'birthplace'
    if re.search(r'noi cap|co quan cap|don vi cap|don vi ban hanh', s):
        return 'issuer'
    if re.search(r'noi chet|noi tu tran|noi hy sinh', s):
        return 'death_place'
    if re.search(r'tinh trang hon nhan', s):
        return 'marital_status'
    if re.search(r'tinh.*thanh pho|thanh pho.*tinh|^tinh$', s):
        return 'province'
    if re.search(r'quan he|moi quan he|la\s*(con|vo|chong|cha|me)\b', s):
        return 'relationship'
    if re.search(r'phuong|xa\b|thi tran|dac khu', s):
        return 'ward'
    if re.search(r'^quan\s*[/,:]|^quan$|^huyen\b', s):
        return 'district'
    if re.search(r'dia chi|cu tru|thuong tru|tam tru|tru quan|cho o|noi o|tru so|noi cu tru|dia diem|dia chi thua dat|noi cong tac|to/xom|^pho$', s):
        return 'address'
    if re.search(r'quan he|moi quan he|la\s*(con|vo|chong|cha|me)\b', s):
        return 'relationship'
    if re.search(r'loai doi tuong|doi tuong', s):
        return 'beneficiary_type'
    if re.search(r'tinh trang hon nhan', s):
        return 'marital_status'
    if re.search(r'nghe nghiep|nganh nghe|nghe nghiep|linh vuc|hoat dong kinh doanh|chuyen nganh', s):
        return 'occupation'
    if re.search(r'chuc vu|chuc danh', s):
        return 'position'
    if re.search(r'trinh do|van hoa', s):
        return 'education'
    if re.search(r'lop|khoa hoc|nien khoa', s):
        return 'class'
    if re.search(r'quoc gia|nuoc ky ket', s):
        return 'country'
    if re.search(r'ma nganh', s):
        return 'industry_code'
    if re.search(r'hoc ky', s):
        return 'semester'
    if re.search(r'nam hoc', s):
        return 'school_year'
    if re.search(r'so thua|thua dat so|so hieu thua|thua so', s):
        return 'land_parcel'
    if re.search(r'to ban do|so ban do', s):
        return 'map_sheet'
    if re.search(r'dien tich', s):
        return 'area'
    if re.search(r'muc dich su dung|loai dat', s):
        return 'land_purpose'
    if re.search(r'nguon goc.*dat|nguon goc su dung', s):
        return 'land_origin'
    if re.search(r'thoi han su dung', s):
        return 'land_duration'
    if re.search(r'phuong thuc.*thanh toan|hinh thuc.*thanh toan', s):
        return 'payment_method'
    if re.search(r'loai xe|nhan hieu', s):
        return 'vehicle_brand'
    if re.search(r'bien so', s):
        return 'plate'
    if re.search(r'so khung|so may', s):
        return 'vehicle_id'
    if re.search(r'ten hang|hang hoa|san pham', s):
        return 'product'
    if re.search(r'don vi tinh', s):
        return 'unit'
    if re.search(r'ly do|noi dung de nghi|noi dung yeu cau|noi dung dang ky|de nghi.*ve|de nghi cap', s):
        return 'request_reason'
    if re.search(r'muc dich', s):
        return 'purpose'
    if re.search(r'giay to.*kem theo|ho so.*kem theo|kem theo|tai lieu', s):
        return 'attachments'
    if re.search(r'so luong|so ban|so con|so nguoi|so lao dong|so thanh vien|so nhan khau', s):
        return 'quantity'
    if 'bang chu' in s and re.search(r'so tien|tien|gia tri', s):
        return 'money_words'
    if re.search(r'doanh thu|thu nhap|so tien', s):
        return 'money'
    if re.search(r'ty le|ti le|thue suat|phan tram|\(%\)', s):
        return 'percentage'
    if re.search(r'so tien|so thue|doanh thu|thu nhap|chi phi|von|gia tri|gia chuyen nhuong|don gia|thanh tien|muc huong|muc tro cap', s):
        return 'money'
    if re.search(r'ky tinh thue', s):
        return 'tax_period'
    if re.search(r'\bquy\b', s) and not re.search(r'quyen|quy dinh|quy hoach', s):
        return 'quarter'
    if re.search(r'cap ngay|ngay cap|ngay .*quyet dinh|ngay ban hanh|dang ky ngay', s):
        return 'issue_date'
    if re.search(r'ngay.*chet|chet ngay|ngay.*hy sinh|hy sinh ngay', s):
        return 'death_date'
    if re.search(r'\bngay\b', s):
        return 'date' if ('thang' in s and 'nam' in s) or s.endswith('ngay') and ':' in label else 'day'
    if re.search(r'\bthang\b', s):
        return 'month'
    if re.search(r'\bnam\b|nam 20$', s):
        return 'year'
    if re.search(r'\bgio\b', s):
        return 'hour'
    if re.search(r'\bphut\b', s):
        return 'minute'
    if re.search(r'^từ\s*$|^đến\s*$', original_label) or re.search(r'thoi gian|thoi diem|thoi han', s):
        return 'date'
    if re.search(r'quyen so', s):
        return 'book_number'
    if re.search(r'^so(?:\s|$)|:\s*so$|\bma ho so\b|\bso hieu\b|ma ho kinh doanh|giay phep|chung chi.*so|giay uy quyen so|quyet dinh.*so', s) and len(s) < 150:
        return 'reference_number'
    if re.search(r'noi lam don|lam tai|tai\s*$', s):
        return 'place'
    if re.search(r'dai ly|don vi cong tac|co quan|cong ty|to chuc', s):
        return 'organization.name'
    return None


def explicit_role(text, default):
    s = fold(text)
    for role, pattern in [
        ('mother', r'nguoi me|ten me|ho ten me'), ('father', r'nguoi cha|ten cha|ho ten cha'),
        ('wife', r'cua vo|nguoi vo|ben nu|vo \('), ('husband', r'cua chong|nguoi chong|ben nam|chong \('),
        ('guardian', r'nguoi giam ho'), ('ward_person', r'nguoi duoc giam ho'),
        ('representative', r'nguoi dai dien|nguoi duoc uy quyen|nguoi tho cung'),
        ('deceased', r'liet si|nguoi da chet|nguoi hy sinh|nguoi mat tich|nguoi chet'),
        ('child', r'nguoi duoc khai sinh|ten hoc sinh|ten sinh vien|thong tin hoc sinh|ten tre'),
        ('beneficiary', r'nguoi huong|ba me viet nam|thong tin ba me|nguoi duoc de nghi|nguoi duoc tro'),
        ('applicant', r'nguoi de nghi|nguoi yeu cau|nguoi nop|nguoi khai|nguoi lam don'),
    ]:
        if re.search(pattern, s):
            return role
    return default


def scenario(template_id, copy, seed, context):
    n = int(hashlib.sha256(f'{template_id}:{copy}:{seed}'.encode()).hexdigest()[:12], 16)
    r = random.Random(n)
    last = r.choice(['Nguyễn','Trần','Lê','Phạm','Đỗ','Vũ','Bùi','Hoàng','Đặng','Phan'])
    male = r.choice(['Văn An','Minh Hải','Đức Bình','Quang Huy','Tuấn Nam','Hữu Lâm'])
    female = r.choice(['Thị Mai','Ngọc Lan','Thu Hà','Thị Ánh','Bảo Ngọc','Thanh Hương'])
    street = f'{12+n%87} ngõ Mẫu Thử'
    addr = street + ', phường Từ Liêm, Hà Nội'
    history = bool(re.search(r'ba me viet nam|chong my|chien truong|cuu chien binh|liet si|nguoi co cong', fold(context)))
    base_years = {'applicant': 1988, 'representative': 1986, 'beneficiary': 1944 if history else 1955,
                  'deceased': 1947 if history else 1951, 'mother': 1961, 'father': 1958,
                  'wife': 1992, 'husband': 1989, 'child': 2015, 'guardian': 1982, 'ward_person': 2014}
    if history and 'than nhan' not in fold(context):
        base_years.update(applicant=1944, wife=1948, husband=1944, child=1970, mother=1920, father=1917)
    if 'ba me viet nam' in fold(context):
        base_years['beneficiary'] = 1925
    people = {}
    roles = list(base_years)
    for i, (role, year) in enumerate(base_years.items()):
        sex = 'Nữ' if role in {'mother','wife','beneficiary'} else 'Nam'
        name = last + ' ' + (female if sex == 'Nữ' else male)
        # Distinguish role identities and dates, including parent and child names.
        if role in {'child','ward_person'}:
            name = last + ' ' + ['Minh Khôi','Gia Bảo','Đức Anh','Bảo An'][n % 4]
        elif role in {'father','deceased'}:
            name = last + ' ' + ['Văn Hòa','Văn Sơn','Đức Thành','Văn Dũng'][n % 4]
        elif role == 'mother':
            name = r.choice(['Nguyễn','Trần','Lê','Phạm']) + ' Thị Hồng'
        elif role == 'representative':
            name = last + ' Quốc Minh'
        elif role == 'guardian':
            name = last + ' Văn Tùng'
        elif role == 'beneficiary':
            name = r.choice(['Nguyễn','Trần','Lê','Phạm']) + ' Thị Hoa'
        day, month = 3 + n % 20, 1 + n % 10
        people[role] = {'name': name, 'dob': f'{day:02}/{month:02}/{year}', 'birth_year': str(year),
                        'birth_day': f'{day:02}', 'birth_month': f'{month:02}',
                        'gender': sex, 'id': f'999{n%1000000:06}{i:03}'}
    return {'people': people, 'seed_number': n, 'address': addr, 'street': street,
            'organization': f'Cơ sở Mẫu Thử {n%997:03}', 'tax_id': f'999{n%10000000:07}',
            'phone': f'000{n%10000000:07}', 'email': f'mau{n%100000}@example.invalid',
            'date': '13/11/2026', 'issue_date': '15/03/2023', 'death_date': '08/11/2026' if not history else '08/11/1972',
            'history': history, 'context': context}


def value_for(kind, label, role, data, width):
    person = data['people'].get(role, data['people']['applicant'])
    s = fold(label)
    n = data['seed_number']
    if kind.startswith('person.'):
        value = person[kind.split('.')[1]]
        if kind == 'person.name' and width < 70:
            value = person['name'].split()[0] + ' ' + person['name'].split()[-1]
        if kind == 'person.name' and re.search(r'in\s+hoa|chu\s+hoa', s):
            value = value.upper()
        return value
    values = {
        'recipient': 'UBND phường Từ Liêm', 'organization.name': data['organization'],
        'ordinal': '1', 'amendment_number': '1', 'country': 'Việt Nam', 'industry_code': '4719',
        'school': 'Trường Mẫu Thử', 'phone': data['phone'], 'fax': data['phone'],
        'email': data['email'], 'website': 'example.invalid', 'tax_id': data['tax_id'],
        'bank_account': f'999{n%100000000:08}', 'bank': 'Ngân hàng Mẫu Thử',
        'identity_type': 'Căn cước', 'ethnicity': 'Kinh', 'nationality': 'Việt Nam',
        'hometown': 'Hà Nội', 'birthplace': 'Hà Nội', 'issuer': 'Bộ Công an',
        'death_place': 'Hà Nội', 'province': 'Hà Nội', 'ward': 'Từ Liêm', 'district': 'Không áp dụng',
        'address': data['address'], 'relationship': 'Con', 'alias': 'Không có',
        'beneficiary_type': 'Người cao tuổi' if not data['history'] else 'Người có công',
        'marital_status': 'Chưa đăng ký kết hôn', 'occupation': 'Kinh doanh bán lẻ',
        'position': 'Đại diện', 'education': '12/12', 'class': '6A', 'semester': 'I',
        'school_year': '2026-2027', 'land_parcel': str(50+n%200), 'map_sheet': str(1+n%30),
        'area': '120,5', 'land_purpose': 'Đất ở', 'land_origin': 'Nhận chuyển nhượng',
        'land_duration': 'Lâu dài', 'payment_method': 'Chuyển khoản', 'vehicle_brand': 'HONDA',
        'plate': f'TEST-{n%1000:03}', 'vehicle_id': f'TEST{n%100000:05}', 'product': 'Hàng mẫu',
        'unit': 'Chiếc', 'request_reason': 'Đề nghị giải quyết theo hồ sơ kèm theo',
        'purpose': 'Bổ sung hồ sơ cá nhân', 'attachments': 'Giấy tờ kèm theo',
        'quantity': '1', 'percentage': '10', 'money': '1.000.000', 'money_words': 'Một triệu đồng', 'tax_period': '11/2026',
        'quarter': 'IV', 'issue_date': data['issue_date'], 'death_date': data['death_date'],
        'issue_day': '15', 'issue_month': '03', 'issue_year': '2023',
        'date': data['date'], 'day': '13', 'month': '11', 'year': '2026', 'hour': '08',
        'minute': '30', 'book_number': '01', 'reference_number': f'TEST-{1+n%99:02}', 'place': 'Hà Nội',
    }
    value = values.get(kind)
    if value is None:
        return None
    if kind == 'recipient':
        if 'thue' in fold(data['context']):
            value = 'Cơ quan Thuế cơ sở'
        elif 'hieu truong' in s or 'truong' in s:
            value = 'Trường Mẫu Thử'
        if width < 80:
            value = 'Từ Liêm'
    elif kind == 'organization.name' and width < 150:
        value = f'Cơ sở Mẫu {n%997:03}'
    elif kind == 'address' and width < 210:
        value = (data['street'] + ', Từ Liêm, Hà Nội') if width >= 135 else data['street'] if width > 70 else 'Hà Nội'
    elif kind == 'nationality' and width < 35:
        value = 'VN'
    elif kind == 'reference_number':
        if width < 60 or re.search(r'^so$|so quyet dinh', s):
            value = str(1+n%97)
    elif kind == 'money' and re.search(r'doanh thu|thu nhap', s):
        value = '0' if 'khong chiu thue' in s else '10.000.000'
    elif kind == 'quantity' and re.search(r'so ban|ban sao', s):
        value = '2'
    elif kind == 'year' and re.search(r'nam\s*20\s*$', s):
        value = '26'
    elif kind == 'date' and width < 45:
        value = '13'
    elif kind == 'request_reason':
        c = fold(data['context'])
        if re.search(r'cap lai|cap doi|mat.*giay', c):
            value = 'Bản chính bị thất lạc'
        elif 'tro cap' in c:
            value = 'Đề nghị hưởng trợ cấp theo quy định'
        elif re.search(r'hoc|giao duc', c):
            value = 'Đề nghị hỗ trợ học tập'
        if width < 140:
            value = 'Theo hồ sơ kèm theo'
    return value
