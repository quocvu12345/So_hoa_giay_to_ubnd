"""Reviewed slot semantics. Input rectangles reference the untouched official page.

Values are scenario fixtures, never claims about real persons or their eligibility.
Unselected branches and authority signatures remain blank, with explicit labels.
"""
from pathlib import Path
import fitz
from .pdf_slots import slots

ROOT = Path(__file__).resolve().parents[2]
SOURCE = ROOT / 'data/official-forms/originals'


def profile(index):
    people = [('Nguyễn Văn An', 'Trần Thị Mai', 'Nguyễn Minh Khôi', 'Nguyễn Văn Hòa'),
              ('Lê Văn Bình', 'Phạm Thu Hà', 'Lê Gia Bảo', 'Lê Văn Sơn'),
              ('Đỗ Minh Hải', 'Vũ Ngọc Lan', 'Đỗ Đức Anh', 'Đỗ Văn Nam')][index]
    father, mother, child, deceased = people
    addr = f'{12 + index * 17} ngõ Mẫu Thử, phường Từ Liêm, Hà Nội'
    data = {'recipient': 'UBND phường Từ Liêm', 'ward': 'Từ Liêm', 'place': 'Hà Nội',
            'day': '13', 'month': '11', 'year': '2026', 'copies': '2', 'relationship': 'Cha',
            'marriage.no': '123', 'marriage.book': '01', 'marriage.day': '15', 'marriage.month': '06',
            'marriage.year': '2018', 'marriage.place': 'UBND phường Từ Liêm',
            'business.name': ['HKD MẪU AN', 'HKD MẪU BÌNH', 'HKD MẪU HẢI'][index],
            'business.no': f'TEST-HKD-00{index + 1}', 'business.ref': f'T{index + 1:02}',
            'business.reason': 'Giấy chứng nhận bị mất', 'school.name': 'Trường THCS Mẫu Thử',
            'student.name': child, 'student.dob': '08/09/2013', 'student.ethnicity': 'La Hủ',
            'student.class': '8A', 'student.address': addr}
    for role, name, dob, sex, year, suffix in [
        ('applicant', father, '12/05/1990', 'Nam', '1990', 11),
        ('father', father, '12/05/1990', 'Nam', '1990', 11),
        ('mother', mother, '21/08/1992', 'Nữ', '1992', 12),
        ('child', child, '01/11/2026', 'Nam', '2026', 13),
        ('deceased', deceased, '03/02/1955', 'Nam', '1955', 14),
        ('ward_person', child, '01/11/2012', 'Nam', '2012', 13),
    ]:
        values = {'name': name, 'dob': dob, 'gender': sex, 'year': year, 'address': addr,
                  'id': f'999{index:03}0000{suffix}', 'ethnicity': 'Kinh', 'nationality': 'Việt Nam',
                  'nationality_short': 'VN', 'identity': f'Căn cước số 999{index:03}0000{suffix}',
                  'birthplace': 'Bệnh viện Mẫu Thử, Hà Nội', 'hometown': 'Hà Nội'}
        data.update({f'{role}.{k}': v for k, v in values.items()})
    data.update({'death.hour': '08', 'death.minute': '30', 'death.day': '10', 'death.month': '11',
                 'death.year': '2026', 'death.place': 'Bệnh viện Mẫu Thử, Hà Nội',
                 'death.reason': 'Tuổi cao', 'death.notice': 'TEST-001',
                 'death.issuer': 'BV Mẫu Thử', 'birth.words1': 'Ngày một tháng mười một',
                 'birth.words2': 'năm hai nghìn không trăm hai mươi sáu'})
    return data


LABELS = {'recipient': 'Cơ quan nhận', 'place': 'Nơi lập', 'day': 'Ngày lập', 'month': 'Tháng lập',
          'year': 'Năm lập', 'copies': 'Số bản sao', 'relationship': 'Quan hệ với người được khai sinh'}
ROLES = {'applicant': 'Người yêu cầu', 'father': 'Cha', 'mother': 'Mẹ', 'child': 'Người được khai sinh',
         'subject': 'Người được yêu cầu', 'wife': 'Bên nữ', 'husband': 'Bên nam',
         'guardian': 'Người giám hộ', 'previous': 'Đăng ký trước đây',
         'recipient_person': 'Người được nhận', 'recognition': 'Nội dung nhận cha, mẹ, con',
         'deceased': 'Người đã chết', 'ward_person': 'Người được giám hộ', 'business': 'Hộ kinh doanh',
         'student': 'Học sinh', 'school': 'Cơ sở giáo dục', 'marriage': 'Đăng ký kết hôn trước đây',
         'death': 'Thông tin khai tử', 'birth': 'Ngày sinh bằng chữ'}
SUFFIXES = {'name': 'Họ và tên', 'dob': 'Ngày sinh', 'gender': 'Giới tính', 'year': 'Năm',
            'address': 'Nơi cư trú', 'id': 'Số định danh', 'identity': 'Giấy tờ tùy thân',
            'ethnicity': 'Dân tộc', 'nationality': 'Quốc tịch', 'nationality_short': 'Quốc tịch',
            'birthplace': 'Nơi sinh', 'hometown': 'Quê quán', 'reason': 'Lý do', 'no': 'Số',
            'book': 'Quyển số', 'day': 'Ngày', 'month': 'Tháng', 'place': 'Nơi', 'class': 'Lớp',
            'hour': 'Giờ', 'minute': 'Phút', 'issuer': 'Đơn vị cấp', 'notice': 'Số giấy báo tử',
            'words1': 'Dòng 1', 'words2': 'Dòng 2', 'ref': 'Số văn bản'}


def label(key):
    if '.' in key:
        role, name = key.split('.', 1)
        return f'{ROLES.get(role, role)} · {SUFFIXES.get(name, name)}'
    return LABELS.get(key, key)


def native(id, title, page, code, mapping, dept='vp', filename='civil2026.pdf', overrides=None):
    d = fitz.open(SOURCE / filename)
    sl = slots(d[page - 1])
    fields = []
    for number, entry in mapping.items():
        key, value = entry if isinstance(entry, tuple) else (entry, '$' + entry)
        s = sl[number]
        fields.append({'id': key, 'label': label(key), 'value_spec': value, 'page': 1,
                       'bbox': s['bbox'], 'baseline': s['baseline'], 'source_slot': number,
                       'printed_label': s['prefix'], 'role': key.split('.')[0], 'input_type': 'text'})
    for f in fields:
        f.update((overrides or {}).get(f['id'], {}))
    return {'id': id, 'title': title, 'source_file': filename, 'source_pages': [page],
            'procedure_codes': [code], 'department_id': dept, 'fields': fields,
            'unfilled_slots': [{**s, 'source_slot': i, 'page': 1,
                               'reason': 'continuation_optional_branch_or_signature_reserved'}
                              for i, s in enumerate(sl) if i not in mapping],
            'scope': 'Applicant fields for the stated synthetic scenario; signatures/stamps remain blank.'}


def common():
    return {0: 'recipient', 1: 'applicant.name', 2: 'applicant.dob', 3: 'applicant.address', 5: 'applicant.identity'}


def definitions():
    forms = []
    marriage = native('ket-hon', 'Tờ khai đăng ký kết hôn', 139, '1.000894', {0: 'recipient',
                      1: ('place', 'Hà Nội'), 3: 'day', 5: 'month', 6: 'year', 10: 'copies'})
    marriage['fields'].extend([
        {**manual('copy_request.yes', [164, 735, 175, 748], 'X'), 'input_type': 'checkbox', 'label': 'Yêu cầu bản sao · Có'},
        {**manual('copy_request.no', [216, 735, 227, 748], ''), 'input_type': 'checkbox', 'label': 'Yêu cầu bản sao · Không'},
    ])
    for role, person, x0, x1 in [('wife', 'mother', 187, 365), ('husband', 'father', 375, 552)]:
        for suffix, y in [('name', 300), ('dob', 332), ('ethnicity', 358), ('nationality', 386),
                          ('address', 419), ('identity', 464)]:
            marriage['fields'].append(manual(f'{role}.{suffix}', [x0, y - 16, x1, y], f'${person}.{suffix}'))
        marriage['fields'].append(manual(f'{role}.marriage_number', [x0, 490, x1, 505], '1'))
    forms.append(marriage)
    forms.append(native('khai-sinh', 'Tờ khai đăng ký khai sinh', 18, '1.001193', {
        **common(), 7: 'relationship', 8: 'child.name', 9: 'child.dob',
        10: ('birth.words1', 'Ngày một tháng mười một'), 11: 'birth.words2', 12: 'child.gender',
        13: 'child.ethnicity', 14: 'child.nationality', 15: 'child.birthplace', 17: 'child.hometown',
        18: 'mother.name', 19: 'mother.year', 20: 'mother.ethnicity', 21: 'mother.nationality_short',
        22: 'mother.address', 24: 'mother.identity', 25: 'father.name', 26: 'father.year',
        27: 'father.ethnicity', 28: 'father.nationality_short', 29: 'father.address', 31: 'father.identity',
        32: 'marriage.no', 33: 'marriage.book', 34: 'marriage.day', 35: 'marriage.month',
        36: 'marriage.year', 37: ('marriage.place', 'P. Từ Liêm'), 38: 'place', 39: 'day', 40: 'month', 41: 'year',
    }, overrides={'birth.words1': {'value_spec': 'Ngày một'}, 'birth.words2': {'value_spec': 'tháng mười một năm hai nghìn không trăm hai mươi sáu'}}))
    forms.append(native('khai-sinh-lai', 'Tờ khai đăng ký lại khai sinh', 42, '1.004884', {
        **common(), 7: ('relationship', 'Bản thân'), 8: ('subject.name', '$applicant.name'),
        9: ('subject.dob', '$applicant.dob'), 10: ('birth.words1', 'Ngày mười hai tháng năm'),
        11: ('birth.words2', 'năm một nghìn chín trăm chín mươi'), 12: ('subject.gender', 'Nam'),
        13: ('subject.ethnicity', 'Kinh'), 14: ('subject.nationality', 'Việt Nam'),
        15: ('subject.birthplace', 'Hà Nội'), 16: ('subject.hometown', 'Hà Nội'),
        17: ('mother.name', 'Trần Thị Hồng'), 18: ('mother.year', '1965'), 19: 'mother.ethnicity',
        20: 'mother.nationality', 21: 'mother.address', 23: ('mother.identity', 'Căn cước số 999000000021'),
        24: ('father.name', '$deceased.name'), 25: ('father.year', '1955'), 26: 'father.ethnicity',
        27: 'father.nationality', 28: 'father.address', 30: ('father.identity', '$deceased.identity'),
        31: ('previous.place', 'UBND xã Mễ Trì, huyện Từ Liêm, Hà Nội'),
        32: ('previous.no', '123'), 33: ('previous.book', '01'), 34: ('previous.day', '20'),
        35: ('previous.month', '05'), 36: ('previous.year', '1990'), 38: 'place', 39: 'day', 40: 'month', 41: 'year',
    }))
    forms.append(native('nhan-cha-me-con', 'Tờ khai đăng ký nhận cha, mẹ, con', 65, '1.001022', {
        **common(), 7: ('relationship', 'Bản thân'), 8: ('recipient_person.name', '$child.name'),
        9: ('recipient_person.dob', '$child.dob'), 10: 'child.gender', 11: 'child.ethnicity',
        12: 'child.nationality', 13: 'child.address', 15: ('child.identity', 'Giấy khai sinh số TEST-101'),
        17: ('recognition.relation', 'con'), 18: 'father.name', 19: 'father.dob', 20: 'father.gender',
        21: 'father.ethnicity', 22: 'father.nationality', 23: 'father.address', 25: 'father.identity',
        27: ('recognition.commitment', 'con'), 28: 'place', 29: 'day', 30: 'month', 31: 'year',
    }))
    forms.append(native('ket-hon-lai', 'Tờ khai đăng ký lại kết hôn', 162, '1.004746', {
        **common(), 7: ('wife.name', '$mother.name'), 8: ('wife.dob', '$mother.dob'),
        9: ('wife.ethnicity', 'Kinh'), 10: ('wife.nationality', 'Việt Nam'),
        11: ('wife.address', '$mother.address'), 13: ('wife.identity', '$mother.identity'),
        15: ('husband.name', '$father.name'), 16: ('husband.dob', '$father.dob'),
        17: ('husband.ethnicity', 'Kinh'), 18: ('husband.nationality', 'Việt Nam'),
        19: ('husband.address', '$father.address'), 21: ('husband.identity', '$father.identity'),
        23: ('marriage.place', 'UBND phường Mễ Trì, quận Nam Từ Liêm, Hà Nội'),
        25: 'marriage.day', 26: 'marriage.month', 27: 'marriage.year', 28: 'marriage.no',
        29: 'marriage.book', 30: 'place', 31: 'day', 32: 'month', 33: 'year',
    }))
    death = {**common(), 7: ('relationship', 'Con'), 8: 'deceased.name', 9: 'deceased.dob',
             10: 'deceased.gender', 11: 'deceased.ethnicity', 12: 'deceased.nationality',
             13: 'deceased.address', 15: 'deceased.identity', 17: 'death.hour', 18: 'death.minute',
             19: 'death.day', 20: 'death.month', 21: 'death.year', 22: 'death.place', 24: 'death.reason'}
    forms.append(native('khai-tu', 'Tờ khai đăng ký khai tử', 184, '1.000656', {
        **death, 25: 'death.notice', 26: 'death.issuer', 28: 'death.day', 29: 'death.month',
        30: 'death.year', 31: 'place', 32: 'day', 33: 'month', 34: 'year',
    }))
    forms.append(native('khai-tu-lai', 'Tờ khai đăng ký lại khai tử', 206, '1.005461', {
        **death, 21: ('death.year', '2024'), 25: ('previous.place', 'UBND phường Mễ Trì'),
        26: ('previous.day', '12'), 27: ('previous.month', '11'), 28: ('previous.year', '2024'),
        29: ('previous.no', '123'), 30: ('previous.book', '01'),
        31: 'place', 32: 'day', 33: 'month', 34: 'year',
    }))
    guardian = {**common(), 7: ('guardian.name', '$mother.name'), 8: ('guardian.dob', '$mother.dob'),
                9: ('guardian.gender', 'Nữ'), 10: ('guardian.ethnicity', 'Kinh'),
                11: ('guardian.nationality', 'Việt Nam'), 12: ('guardian.address', '$mother.address'),
                14: ('guardian.identity', '$mother.identity'), 16: 'ward_person.name',
                17: 'ward_person.dob', 18: 'ward_person.gender', 19: 'ward_person.ethnicity',
                20: 'ward_person.nationality', 21: 'ward_person.address',
                23: ('ward_person.identity', 'Giấy khai sinh số TEST-102')}
    forms.append(native('giam-ho', 'Tờ khai đăng ký giám hộ', 227, '1.004837', {
        **guardian, 25: ('reason', 'Cha mẹ của người được giám hộ đều đã mất'),
        28: 'place', 29: 'day', 30: 'month', 31: 'year',
    }))
    forms.append(native('cham-dut-giam-ho', 'Tờ khai đăng ký chấm dứt giám hộ', 248, '1.004845', {
        **guardian, 17: ('ward_person.dob', '01/11/2008'), 25: ('previous.place', 'UBND phường Mễ Trì, quận Nam Từ Liêm, Hà Nội'),
        26: ('previous.day', '02'), 27: ('previous.month', '03'), 28: ('previous.year', '2022'),
        29: ('previous.no', '123'), 30: ('previous.book', '01'), 31: ('reason', 'Người được giám hộ đã thành niên'),
        33: 'place', 34: 'day', 35: 'month', 36: 'year',
    }))
    forms.append(native('tinh-trang-hon-nhan', 'Tờ khai cấp giấy xác nhận tình trạng hôn nhân', 429, '1.004873', {
        **common(), 7: ('relationship', 'Bản thân'), 8: ('subject.name', '$applicant.name'),
        9: ('subject.dob', '$applicant.dob'), 10: ('subject.gender', 'Nam'),
        12: ('subject.ethnicity', 'Kinh'), 14: ('subject.nationality', 'Việt Nam'),
        15: ('subject.address', '$applicant.address'), 17: ('subject.identity', '$applicant.identity'),
        19: ('marital_status', 'Chưa đăng ký kết hôn với ai'),
        24: ('purpose', 'Bổ sung hồ sơ vay vốn'), 29: 'place', 30: 'day', 31: 'month', 32: 'year',
    }))
    forms.append(native('ban-sao-ho-tich', 'Tờ khai cấp bản sao trích lục hộ tịch, bản sao giấy khai sinh', 439, '2.000635', {
        **common(), 7: 'relationship', 8: ('copy_type', 'Giấy khai sinh'), 9: 'child.name', 10: 'child.dob',
        11: 'child.gender', 12: 'child.ethnicity', 13: 'child.nationality', 14: 'child.address',
        16: ('child.identity', 'Giấy khai sinh số TEST-101'), 18: ('previous.place', 'UBND phường Từ Liêm'),
        20: ('previous.day', '05'), 21: ('previous.month', '11'), 22: ('previous.year', '2026'),
        23: ('previous.no', '101'), 24: ('previous.book', '01'), 28: 'copies',
        29: 'place', 30: 'day', 31: 'month', 32: 'year',
    }))
    forms.append(native('xac-nhan-ho-tich', 'Tờ khai đề nghị xác nhận thông tin hộ tịch', 448, '2.002516', {
        0: 'recipient', 1: 'applicant.name', 3: 'applicant.address', 5: 'applicant.id',
        7: ('relationship', 'Bản thân'), 9: ('subject.name', '$applicant.name'),
        10: ('subject.dob', '$applicant.dob'), 11: ('subject.gender', 'Nam'), 12: ('subject.ethnicity', 'Kinh'),
        13: ('subject.nationality', 'Việt Nam'), 14: ('subject.id', '$applicant.id'),
        15: ('subject.identity', '$applicant.identity'), 17: ('reason', 'Đối chiếu thông tin cá nhân trong hồ sơ'),
        20: ('requested_content', 'Xác nhận thông tin đăng ký khai sinh'), 25: 'place',
        26: 'day', 27: 'month', 28: 'year', 30: ('delivery_method', 'Nhận trực tiếp'),
    }))
    study = native('ho-tro-hoc-tap', 'Đơn đề nghị hỗ trợ học tập · Mẫu 02', 1, '1.003702', {
        0: 'student.name', 1: 'student.address', 2: 'student.dob', 3: 'student.ethnicity',
        4: 'student.class', 5: 'school.name', 6: ('place', 'HN'), 7: 'day', 8: 'month', 9: 'year',
    }, dept='vx', filename='mau-02-ho-tro-hoc-tap-cong-bao-2023-trang-79.pdf')
    study['fields'].append(manual('recipient', [191, 230, 440, 245], '$school.name'))
    forms.append(study)
    # Source is scanned. Coordinates manually reviewed against exact PDF page.
    forms.append({'id': 'cap-lai-hkd', 'title': 'Giấy đề nghị cấp lại giấy chứng nhận đăng ký hộ kinh doanh',
                  'source_file': 'business28.pdf', 'source_pages': [245], 'procedure_codes': ['2.000575'],
                  'department_id': 'ktdt', 'scope': 'Cấp lại do mất giấy chứng nhận; chỗ ký giữ trống.',
                  'unfilled_slots': [], 'fields': [
                      manual('business.ref', [149, 120, 206, 136]),
                      manual('place', [315, 120, 341, 136], 'HN'),
                      manual('day', [370, 120, 390, 136]),
                      manual('month', [428, 120, 449, 136]),
                      manual('year', [480, 120, 508, 136]),
                      manual('recipient', [414, 214, 482, 229], 'P. Từ Liêm'),
                      manual('business.name', [360, 253, 535, 268]),
                      manual('business.no', [250, 276, 535, 291]),
                      manual('business.reason', [249, 326, 535, 341]),
                  ]})
    return forms


def manual(key, rect, value=None):
    return {'id': key, 'label': label(key), 'value_spec': ('$' + key) if value is None else value, 'page': 1,
            'bbox': rect, 'baseline': rect[3], 'printed_label': label(key),
            'role': key.split('.')[0], 'input_type': 'text', 'source_slot': None}
