"""Explicit synthetic requirements and filled mock supporting documents.

These are OCR fixtures, not reproductions of certificates issued by an agency.
Only the old dataset's actual source forms retain their original layout.
"""
import hashlib
import io
import re
from pathlib import Path

import fitz
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.pdfgen.canvas import Canvas

from .pipeline import save, sha
from .render import fonts
from .semantics import fold


# No official component list was retrieved for these inventory entries. Keep
# the test assumptions explicit rather than inventing source-backed coverage.
# Pipe-delimited titles are distinct physical mock documents, not one checklist.
ASSUMED_PAPERS = {
    1: 'Bản khai đề nghị tặng Huy chương Thanh niên xung phong vẻ vang|Giấy xác nhận thời gian tham gia thanh niên xung phong|Bản sao giấy tờ định danh|Danh sách đề nghị khen thưởng',
    7: 'Văn bản đề nghị phát động học tập tấm gương|Báo cáo thành tích và hoàn cảnh hy sinh, bị thương|Biên bản xác minh sự việc|Tài liệu chứng minh thành tích',
    27: 'Phiếu khai báo sử dụng máy, thiết bị có yêu cầu nghiêm ngặt về an toàn lao động|Giấy chứng nhận kết quả kiểm định kỹ thuật an toàn|Lý lịch máy, thiết bị|Bản sao giấy chứng nhận đăng ký tổ chức',
    29: 'Văn bản đăng ký hợp đồng nhận lao động thực tập dưới 90 ngày|Hợp đồng nhận lao động thực tập|Danh sách lao động thực tập|Kế hoạch đào tạo và thực tập|Bản sao giấy chứng nhận đăng ký tổ chức',
    62: 'Tờ khai đề nghị hỗ trợ sinh con đúng chính sách dân số|Bản sao giấy khai sinh của trẻ|Bản sao giấy tờ định danh|Giấy xác nhận cư trú|Tài liệu xác nhận đối tượng hỗ trợ',
    64: 'Tờ khai đề nghị trợ cấp xã hội|Bản sao giấy tờ định danh|Giấy xác nhận cư trú|Giấy xác nhận đối tượng bảo trợ xã hội|Biên bản xét duyệt hỗ trợ',
    72: 'Tờ khai đăng ký hoạt động cơ sở trợ giúp xã hội dưới 10 đối tượng|Phương án trợ giúp xã hội|Danh sách nhân viên và đối tượng được chăm sóc|Bản sao giấy tờ về địa điểm hoạt động|Quy chế hoạt động cơ sở',
    73: 'Tờ khai đề nghị hỗ trợ chi phí mai táng|Bản sao giấy chứng tử|Tài liệu xác nhận đối tượng bảo trợ xã hội|Bản sao giấy tờ định danh của người tổ chức mai táng',
    76: 'Văn bản công bố đủ điều kiện sản xuất chế phẩm|Bản kê khai nhân sự|Bảng kê trang thiết bị sản xuất|Bản sao văn bằng chuyên môn|Sơ đồ và thuyết minh cơ sở sản xuất|Bản sao giấy chứng nhận đăng ký tổ chức',
    77: 'Văn bản công bố đủ điều kiện cung cấp dịch vụ diệt côn trùng|Bản kê khai nhân sự|Bản sao văn bằng chuyên môn và chứng nhận tập huấn|Danh mục chế phẩm và thiết bị|Phương án cung cấp dịch vụ',
    78: 'Văn bản đề nghị tiếp nhận đối tượng cần bảo vệ khẩn cấp|Biên bản xác nhận tình trạng cần bảo vệ khẩn cấp|Bản sao giấy tờ định danh|Phiếu thông tin sức khỏe|Biên bản bàn giao đối tượng',
    79: 'Tờ khai đề nghị tiếp nhận vào cơ sở trợ giúp xã hội|Bản sao giấy tờ định danh|Tài liệu xác nhận hoàn cảnh đặc biệt khó khăn|Phiếu thông tin sức khỏe|Biên bản xét duyệt',
    88: 'Đơn đề nghị cấp giấy phép nhập khẩu xuất bản phẩm không kinh doanh|Danh mục xuất bản phẩm nhập khẩu|Bản sao giấy tờ định danh|Tài liệu giới thiệu nội dung xuất bản phẩm',
    106: 'Đơn đề nghị cấp đổi giấy phép hoạt động in xuất bản phẩm|Bản sao giấy phép hoạt động in đã cấp|Bản sao giấy chứng nhận đăng ký tổ chức|Tài liệu chứng minh nội dung thay đổi',
    108: 'Đơn đề nghị điều chỉnh giấy phép kinh doanh karaoke|Bản sao giấy phép kinh doanh karaoke đã cấp|Tài liệu chứng minh nội dung điều chỉnh|Sơ đồ địa điểm kinh doanh',
    111: 'Đơn đề nghị cấp giấy phép kinh doanh karaoke|Bản sao giấy chứng nhận đăng ký kinh doanh|Tài liệu về phòng cháy chữa cháy|Sơ đồ phòng hát và địa điểm kinh doanh',
    112: 'Đơn đề nghị cấp giấy phép kinh doanh karaoke|Bản sao giấy chứng nhận đăng ký kinh doanh|Tài liệu về phòng cháy chữa cháy|Sơ đồ phòng hát và địa điểm kinh doanh',
    118: 'Đơn đề nghị tự nguyện trả lại rừng|Bản sao giấy chứng nhận quyền sử dụng đất, quyền sở hữu rừng|Bản đồ hiện trạng khu rừng|Biên bản xác định ranh giới rừng',
    121: 'Tờ trình đề nghị phê duyệt kế hoạch khuyến nông|Kế hoạch khuyến nông địa phương|Dự toán kinh phí|Biên bản lấy ý kiến cộng đồng',
    126: 'Bản đăng ký thu hồi khoáng sản|Bản đồ khu vực thu hồi khoáng sản|Phương án thu hồi khoáng sản|Tài liệu về dự án có khoáng sản thu hồi|Bản sao giấy chứng nhận đăng ký tổ chức',
    127: 'Văn bản đề nghị quyết toán tiền cấp quyền khai thác khoáng sản|Báo cáo sản lượng khoáng sản thực tế|Bảng tính tiền cấp quyền|Chứng từ nộp tiền|Bản sao giấy phép khai thác',
    128: 'Bản đăng ký thu hồi khoáng sản|Bản đồ khu vực thu hồi khoáng sản|Phương án thu hồi khoáng sản|Tài liệu về dự án có khoáng sản thu hồi|Bản sao giấy chứng nhận đăng ký tổ chức',
    135: 'Đơn đề nghị cấp lại giấy phép tài nguyên nước|Bản sao giấy phép tài nguyên nước đã cấp|Báo cáo tình hình thực hiện giấy phép|Tài liệu giải trình lý do cấp lại',
    139: 'Văn bản đề nghị tạm dừng hiệu lực giấy phép tài nguyên nước|Bản sao giấy phép tài nguyên nước|Báo cáo tình hình khai thác nước|Phương án bảo vệ công trình trong thời gian tạm dừng',
    165: 'Đơn đề nghị cấp lại giấy phép hoạt động trong phạm vi bảo vệ công trình thủy lợi|Bản sao giấy phép đã cấp|Tài liệu về việc thay đổi chủ giấy phép|Báo cáo tình hình hoạt động',
    171: 'Tờ trình đề nghị thẩm định quy trình vận hành công trình thủy lợi|Dự thảo quy trình vận hành|Báo cáo thuyết minh kỹ thuật|Bản vẽ và sơ đồ công trình|Biên bản lấy ý kiến đơn vị liên quan',
    181: 'Văn bản đề nghị cấp lại giấy phép môi trường|Báo cáo đề xuất cấp lại giấy phép môi trường|Bản sao giấy phép môi trường đã cấp|Báo cáo quan trắc môi trường|Tài liệu về thay đổi dự án',
    206: 'Đơn đề nghị cấp giấy phép bán lẻ rượu|Bản sao giấy chứng nhận đăng ký kinh doanh|Hợp đồng thuê địa điểm bán lẻ|Văn bản giới thiệu hoặc hợp đồng nguyên tắc của nhà cung cấp rượu',
    207: 'Đơn đề nghị sửa đổi giấy phép bán lẻ rượu|Bản sao giấy phép bán lẻ rượu đã cấp|Tài liệu chứng minh nội dung sửa đổi',
    208: 'Đơn đề nghị cấp lại giấy phép bán lẻ rượu|Tài liệu giải trình lý do cấp lại|Thông tin giấy phép bán lẻ rượu đã cấp',
    209: 'Đơn đề nghị cấp giấy phép bán lẻ sản phẩm thuốc lá|Bản sao giấy chứng nhận đăng ký kinh doanh|Hợp đồng thuê địa điểm bán lẻ|Văn bản giới thiệu của nhà phân phối sản phẩm thuốc lá',
    210: 'Đơn đề nghị sửa đổi giấy phép bán lẻ sản phẩm thuốc lá|Bản sao giấy phép bán lẻ sản phẩm thuốc lá|Tài liệu chứng minh nội dung sửa đổi',
    211: 'Đơn đề nghị cấp lại giấy phép bán lẻ sản phẩm thuốc lá|Tài liệu giải trình lý do cấp lại|Thông tin giấy phép bán lẻ sản phẩm thuốc lá đã cấp',
    212: 'Đơn đề nghị cấp giấy phép sản xuất rượu thủ công|Bản sao giấy chứng nhận đăng ký kinh doanh|Bản công bố sản phẩm rượu|Tài liệu về an toàn thực phẩm|Bản kê cơ sở vật chất và quy trình sản xuất',
    213: 'Đơn đề nghị sửa đổi giấy phép sản xuất rượu thủ công|Bản sao giấy phép sản xuất rượu thủ công|Tài liệu chứng minh nội dung sửa đổi',
    214: 'Đơn đề nghị cấp lại giấy phép sản xuất rượu thủ công|Tài liệu giải trình lý do cấp lại|Thông tin giấy phép sản xuất rượu thủ công đã cấp',
    217: 'Giấy đề nghị cấp giấy chứng nhận cửa hàng bán lẻ LPG chai|Bản sao giấy chứng nhận đăng ký kinh doanh|Hợp đồng cung cấp LPG chai|Tài liệu về phòng cháy chữa cháy|Bản kê điều kiện cơ sở vật chất',
    218: 'Giấy đề nghị cấp lại giấy chứng nhận cửa hàng bán lẻ LPG chai|Tài liệu giải trình lý do cấp lại|Thông tin giấy chứng nhận đã cấp',
    219: 'Giấy đề nghị điều chỉnh giấy chứng nhận cửa hàng bán lẻ LPG chai|Bản sao giấy chứng nhận đã cấp|Tài liệu chứng minh nội dung điều chỉnh',
    233: 'Đơn xin chuyển trường của học sinh tiểu học|Học bạ học sinh|Giấy giới thiệu chuyển trường|Bản sao giấy khai sinh|Giấy xác nhận kết quả học tập',
    240: 'Đơn xin chuyển trường của học sinh trung học cơ sở|Học bạ học sinh|Giấy giới thiệu chuyển trường|Bản sao giấy khai sinh|Giấy xác nhận kết quả học tập',
    241: 'Đơn đề nghị tiếp nhận học sinh Việt Nam về nước|Học bạ hoặc bảng kết quả học tập ở nước ngoài|Bản sao giấy khai sinh|Bản sao hộ chiếu|Tài liệu xác nhận trình độ học tập',
    242: 'Đơn đề nghị tiếp nhận học sinh nước ngoài|Học bạ hoặc bảng kết quả học tập|Bản sao hộ chiếu của học sinh|Giấy xác nhận cư trú|Giấy khám sức khỏe',
    243: 'Đơn xin học bổ túc trung học cơ sở|Học bạ hoặc giấy xác nhận trình độ|Bản sao giấy khai sinh|Bản sao giấy tờ định danh',
    244: 'Đơn xin thuyên chuyển học bổ túc trung học cơ sở|Học bạ học sinh|Giấy giới thiệu chuyển trường|Giấy xác nhận kết quả học tập',
    256: 'Tờ trình đề nghị thành lập lớp dành cho người khuyết tật|Đề án tổ chức lớp học|Danh sách người học và giáo viên|Bảng kê cơ sở vật chất|Giấy xác nhận khuyết tật của người học',
    326: 'Tờ khai liên thông đăng ký khai sinh, thường trú và bảo hiểm y tế|Giấy chứng sinh của trẻ|Bản sao giấy tờ định danh của cha|Bản sao giấy tờ định danh của mẹ|Bản sao giấy chứng nhận kết hôn|Tờ khai thay đổi thông tin cư trú|Danh sách đề nghị cấp thẻ bảo hiểm y tế',
    327: 'Tờ khai liên thông đăng ký khai tử, xóa thường trú và trợ cấp|Giấy báo tử|Bản sao giấy tờ định danh của người yêu cầu|Tờ khai thay đổi thông tin cư trú|Tờ khai đề nghị hưởng mai táng phí và tử tuất|Tài liệu về bảo hiểm xã hội',
    333: 'Đơn đề nghị gia hạn hoạt động cảng, bến thủy nội địa|Bản sao quyết định công bố hoạt động cảng, bến|Báo cáo hiện trạng công trình|Tài liệu về quyền sử dụng địa điểm|Biên bản kiểm tra an toàn',
    344: 'Văn bản đề nghị đóng cảng, bến thủy nội địa|Bản sao quyết định công bố hoạt động|Phương án đóng cảng, bến|Biên bản bàn giao hiện trạng',
    345: 'Đơn đề nghị công bố lại hoạt động bến thủy nội địa|Bản sao quyết định công bố hoạt động đã cấp|Báo cáo hiện trạng bến|Bản vẽ hoàn công và sơ đồ vùng nước|Tài liệu về quyền sử dụng địa điểm',
    348: 'Đơn đề nghị công bố hoạt động bến thủy nội địa|Bản vẽ hoàn công công trình bến|Biên bản nghiệm thu công trình|Sơ đồ vùng nước và phương án bảo đảm an toàn|Tài liệu về quyền sử dụng địa điểm',
    349: 'Đơn đề nghị công bố hoạt động bến khách ngang sông hoặc bến phục vụ thi công|Bản vẽ hoàn công công trình bến|Biên bản nghiệm thu công trình|Sơ đồ vùng nước và phương án bảo đảm an toàn|Tài liệu về quyền sử dụng địa điểm',
    357: 'Tờ trình đề nghị thẩm định thiết kế xây dựng|Hồ sơ thiết kế xây dựng|Báo cáo kết quả thẩm tra thiết kế|Bản sao quyết định phê duyệt dự án|Hồ sơ khảo sát xây dựng|Bản sao chứng chỉ năng lực tổ chức và cá nhân|Dự toán xây dựng công trình',
    379: 'Văn bản đề nghị tổ chức đại hội tôn giáo|Chương trình và kế hoạch tổ chức đại hội|Danh sách đại biểu|Báo cáo hoạt động của tổ chức tôn giáo|Tài liệu về địa điểm tổ chức',
    380: 'Văn bản đề nghị tổ chức cuộc lễ ngoài cơ sở tôn giáo|Chương trình tổ chức cuộc lễ|Danh sách người chủ trì|Phương án bảo đảm an ninh và an toàn|Văn bản chấp thuận sử dụng địa điểm',
    381: 'Văn bản đề nghị giảng đạo ngoài địa bàn phụ trách|Chương trình giảng đạo|Danh sách người giảng đạo|Văn bản chấp thuận sử dụng địa điểm|Tài liệu về tư cách người giảng đạo',
    388: 'Đơn kiến nghị hoặc phản ánh|Bản sao giấy tờ định danh|Tài liệu chứng minh nội dung đơn|Phiếu phân loại và xử lý đơn',
    389: 'Đơn trình bày nội dung tiếp công dân|Bản sao giấy tờ định danh|Tài liệu liên quan nội dung kiến nghị|Biên bản tiếp công dân',
    390: 'Đơn tố cáo|Bản sao giấy tờ định danh|Tài liệu chứng minh nội dung tố cáo|Biên bản tiếp nhận thông tin tố cáo',
    391: 'Đơn khiếu nại lần đầu|Bản sao giấy tờ định danh|Bản sao quyết định hoặc tài liệu về hành vi bị khiếu nại|Tài liệu chứng minh nội dung khiếu nại',
    399: 'Giấy đề nghị hiệu đính thông tin đăng ký tổ hợp tác|Bản sao giấy chứng nhận đăng ký tổ hợp tác|Tài liệu chứng minh thông tin cần hiệu đính|Biên bản họp thành viên',
}

EXCLUDED = {
    'instruction_only', 'conditional_not_selected', 'alternative_case_not_selected',
    'not_selected_direct_channel',
}


def assumed_titles(blueprint):
    ordinal = int(blueprint['ordinal'])
    if ordinal in ASSUMED_PAPERS:
        return ASSUMED_PAPERS[ordinal].split('|')
    # The other source-less entries are the archived education procedures.
    context = fold(blueprint['name'])
    if re.search(r'giao duc|truong|trung tam hoc tap', context):
        if 'giai the' in context:
            return ['Tờ trình đề nghị giải thể cơ sở giáo dục', 'Đề án giải thể cơ sở giáo dục',
                    'Phương án giải quyết quyền lợi người học và người lao động',
                    'Báo cáo tài chính và tài sản', 'Bản sao quyết định thành lập cơ sở giáo dục']
        if re.search(r'sap nhap|chia|tach', context):
            return ['Tờ trình đề nghị tổ chức lại cơ sở giáo dục', 'Đề án sáp nhập, chia, tách cơ sở giáo dục',
                    'Phương án nhân sự và người học', 'Bảng kê cơ sở vật chất và tài chính',
                    'Bản sao quyết định thành lập cơ sở giáo dục']
        if 'tro lai' in context:
            return ['Tờ trình đề nghị hoạt động giáo dục trở lại', 'Báo cáo khắc phục nguyên nhân đình chỉ',
                    'Biên bản kiểm tra điều kiện hoạt động', 'Danh sách cán bộ và giáo viên',
                    'Bản sao quyết định đình chỉ hoạt động']
        return ['Tờ trình đề nghị thành lập hoặc hoạt động cơ sở giáo dục', 'Đề án tổ chức và hoạt động giáo dục',
                'Danh sách cán bộ quản lý và giáo viên', 'Bảng kê cơ sở vật chất và thiết bị dạy học',
                'Tài liệu về địa điểm hoạt động', 'Quy chế tổ chức và hoạt động']
    raise ValueError('No explicit mock requirement plan for '+blueprint['id'])


def paper_kind(title):
    n = fold(title)
    patterns = [
        ('birth_notice', r'giay chung sinh'),
        ('birth', r'giay khai sinh|trich luc khai sinh'),
        ('death', r'giay bao tu|giay chung tu|trich luc khai tu'),
        ('marriage', r'giay chung nhan ket hon|trich luc ket hon|tinh trang hon nhan'),
        ('identity', r'can cuoc|giay to dinh danh|ho chieu|chung minh nhan dan|giay to tuy than'),
        ('residence', r'xac nhan cu tru|thong tin cu tru'),
        ('land', r'quyen su dung dat|quyen so huu rung|so do thua|trich do|ban do|ban ve|so do'),
        ('contract', r'hop dong|uy quyen|chap thuan su dung dia diem'),
        ('school', r'hoc ba|ket qua hoc tap|bang diem|trinh do hoc tap'),
        ('roster', r'danh sach|bang ke|ban ke|danh muc|du toan|bang tinh|chung tu'),
        ('report', r'bao cao|de an|phuong an|ke hoach|thuyet minh|quy trinh|thiet ke|khao sat|quy che'),
        ('minutes', r'bien ban'),
        ('application', r'^\W*(?:ban sao )?(?:to khai|ban khai|don\b|giay de nghi|van ban de nghi|to trinh|phieu|van ban cong bo|ban dang ky)'),
        ('certificate', r'giay phep|giay chung nhan|quyet dinh|van bang|chung chi|chung nhan|giay xac nhan'),
    ]
    for kind, pattern in patterns:
        if re.search(pattern, n):
            return kind
    return 'evidence'


def document_parts(component):
    """Expand explicit enumerations and embedded certificates in a source row.

    A row with "A or B" selects its first alternative. It is not evidence that
    both documents are required. Exact wording remains on the parent component.
    """
    original = re.sub(r'\s+', ' ', component['name']).strip(' -+•')
    # Restrict splitting to list markers followed by document nouns. Years,
    # clauses and legal cross-references must not become separate papers.
    noun = r'(?:Bản sao|Bản chính|Bản chụp|Giấy|Tờ khai|Bản khai|Đơn|Văn bản|Báo cáo|Danh sách|Bảng kê|Biên bản|Hợp đồng|Quyết định|Tài liệu|Hồ sơ|Sơ đồ|Bản vẽ|Phương án|Đề án|Kế hoạch|Phiếu|Chứng chỉ)'
    parts = re.split(r'(?:(?:;|\.)\s*[-+]\s*|(?:^|\s)(?<!số )(?<!số)(?:\d+[.)]|[a-z][)])\s*)(?='+noun+r')', original, flags=re.I)
    parts = [p.strip(' .;-+') for p in parts if p.strip(' .;-+')]
    # Embedded supporting papers are not covered by merely filling the
    # request form attached to the same component description. Apply to each
    # numbered part as well, without treating a form number as a list marker.
    parts = [piece for part in parts for piece in re.split(
        r'[.;]\s*(?=(?:Bản sao|Bản chính|Bản chụp|Giấy báo tử|Giấy ra viện|Giấy chứng sinh)\b)', part, flags=re.I)]
    result = []
    for part in parts:
        if len(part.strip()) < 5:
            continue
        # Keep the first named alternative, with the untouched source text in
        # metadata. Do not split natural titles such as giấy khai sinh.
        part = re.split(r'\s+hoặc\s+(?=(?:bản sao |bản chính )?(?:giấy |quyết định |hộ chiếu|căn cước|thẻ căn cước))', part, flags=re.I)[0]
        if not re.search(noun, part, re.I) and result:
            continue
        if part not in result:
            result.append(part)
    return result or [original]


def select_numbered_cases(blueprint):
    """Select one sibling case, e.g. foreign worker manager vs expert.

    Public sources also encode alternatives as 1.1., 1.2., ... headings;
    the old source-backed planner only recognized headings beginning with
    'Trường hợp'. Preserve the whole source and record this extra selection.
    """
    families = {}
    for group in blueprint.get('source_component_groups', []):
        name = group['name']; match = re.match(r'^(\d+(?:\.\d+)+)\.\s*(.*)', fold(name))
        if not match or not group['component_count']:
            continue
        if not re.match(r'doi voi|truong hop|ho so de nghi cap', match[2]):
            continue
        parent = match[1].rsplit('.', 1)[0]
        names = families.setdefault(parent, [])
        if name not in names:
            names.append(name)
    for groups in families.values():
        if len(groups) < 2:
            continue
        selected = next((g for g in groups if any(c['section'] == g and c.get('selected_template_id') for c in blueprint['components'])), groups[0])
        blueprint['default_test_scenario']['selected_conditional_group'] = selected
        blueprint['default_test_scenario']['case_selection_method'] = 'one_numbered_sibling_case_with_available_source_form'
        blueprint['conditional_component_groups'] = list(dict.fromkeys(blueprint.get('conditional_component_groups', [])+groups))
        for c in blueprint['components']:
            if c['section'] in groups and c['section'] != selected:
                c.update(scenario_status='alternative_case_not_selected', selected_template_id=None)


def choose_component_alternatives(components):
    """Keep one example from explicitly 'one of the following' sublists."""
    choice = None
    for offset, c in enumerate(components):
        if c['scenario_status'] == 'alternative_case_not_selected':
            continue
        text = fold(c['name']).lstrip(' -+')
        heading = bool(re.search(r'mot trong.*(?:sau|sau day)\s*:\s*$', text)) and offset+1 < len(components) and components[offset+1]['section'] == c['section']
        index = re.match(r'^\((\d+)(?:\.(\d+))?\)', text)
        if choice and (c['section'] != choice['section'] or index and not index[2] and index[1] != choice['index']):
            choice = None
        if choice and choice['chosen']:
            # Nested headings inside a rejected sibling (e.g. 7.7 after
            # choosing 7.1) must not reopen the alternative as a new choice.
            c.update(scenario_status='alternative_case_not_selected', selected_template_id=None,
                     classification_note='Another option in the same explicit one-of list.')
            continue
        if heading:
            choice = {'section': c['section'], 'index': index[1] if index else None, 'chosen': False}
            c.update(source_role=c['role'], role='instruction', scenario_status='instruction_only',
                     classification_note='Alternative-list heading; the selected child document supplies this requirement.')
            continue
        if choice:
            choice['chosen'] = True
            c['scenario_status'] = 'selected_for_synthetic_test'
            if c['role'] == 'instruction':
                c.update(source_role='instruction', role='supporting_submit')
            c['classification_note'] = 'First published document option selected for the test.'


def plan_components(blueprint):
    components = []
    source_less = not blueprint['components']
    if source_less:
        for i, title in enumerate(assumed_titles(blueprint), 1):
            components.append({
                'id': f"{blueprint['id']}-mock-{i:03}", 'name': title,
                'role': 'applicant_form' if paper_kind(title) == 'application' else 'supporting_submit',
                'section': 'Thành phần giả định riêng cho bộ dữ liệu kiểm thử',
                'scenario_status': 'selected_for_synthetic_test', 'original_quantity': 1,
                'copy_quantity': 0, 'required_as_published': None,
                'selected_template_id': None, 'template_candidates': [],
                'requirement_basis': 'explicit_test_assumption',
                'source_url': None, 'source_detail_id': None,
                'source_gap': 'No matched official component list for this dated inventory entry.',
            })
    else:
        for c in blueprint['components']:
            entry = {**c, 'requirement_basis': 'published_component_description'}
            text = fold(c['name']).lstrip(' -+')
            if re.match(r'truong hop (cac )?(thong tin|du lieu)', text) and not c.get('selected_template_id'):
                entry.update(source_role=c['role'], role='instruction', scenario_status='instruction_only',
                             classification_note='Source data-lookup instruction, not a separate physical paper.')
            components.append(entry)
        choose_component_alternatives(components)
    planned = []
    for c in components:
        excluded = c['scenario_status'] in EXCLUDED or c['role'] == 'instruction'
        parts = [] if excluded else document_parts(c)
        artifacts = []
        for i, title in enumerate(parts, 1):
            artifacts.append({'id': c['id']+f'-paper-{i:02}', 'title': title,
                              'kind': paper_kind(title), 'part': i,
                              'template_id': c.get('selected_template_id') if i == 1 else None,
                              'published_quantity_total': (c.get('original_quantity') or 0)+(c.get('copy_quantity') or 0),
                              'physical_copy_policy': 'One labelled specimen represents the published originals/copies; quantities stay in checklist.'})
        planned.append({**c, 'included_in_test': not excluded,
                        'selection_note': 'Conditional supporting material is supplied in this synthetic scenario; applicability has not been legally reviewed.' if c['scenario_status'] == 'conditional_needs_review' else None,
                        'expected_artifacts': artifacts})
    if not any(c['expected_artifacts'] for c in planned):
        raise ValueError('An empty checklist must not count as a complete synthetic packet: '+blueprint['id'])
    return planned


def register_fonts(root):
    styles = fonts(root)
    # Use redistributable fonts already in the local office runtime when
    # available; the two fixture fonts are a portable fallback.
    font_root = Path('/Volumes/quocDisk/AI/document-samples/tools/lo-extracted/LibreOffice/LibreOffice.app/Contents/Resources/fonts/truetype')
    for name, file in [('VNText', 'DejaVuSans.ttf'), ('VNBold', 'DejaVuSans-Bold.ttf')]:
        if name not in pdfmetrics.getRegisteredFontNames():
            path = font_root/file
            if not path.is_file():
                path = styles[0][1]
            pdfmetrics.registerFont(TTFont(name, str(path)))
    return styles


def profile_facts(profile, blueprint):
    n = profile['seed_number']
    tag = profile['packet_id'].removeprefix('hs-').upper()
    return {
        'organization': profile['organization'], 'tax_id': profile['tax_id'],
        'date': profile['date'], 'issue_date': profile['issue_date'],
        'school': 'Trường Mẫu Thử Từ Liêm', 'class': '6A' if 'trung hoc' in fold(blueprint['domain']) else '5A',
        'school_year': '2026-2027', 'land_parcel': str(50+n % 200), 'map_sheet': str(1+n % 30),
        'area': '120,5 m2', 'land_purpose': 'Đất ở',
        'project': f"Dự án kiểm thử {blueprint['id'].upper()}",
        'budget': f'{(10+n % 90)*1000000:,}'.replace(',', '.')+' đồng',
        'license_no': 'TEST-GP-'+tag, 'birth_no': 'TEST-KS-'+tag,
        'death_no': 'TEST-KT-'+tag, 'marriage_no': 'TEST-KH-'+tag,
        'registration_no': 'TEST-DK-'+tag, 'contract_no': 'TEST-HD-'+tag,
        'issued_by': 'Đơn vị Mẫu Thử - dữ liệu giả lập',
    }


def field(label, value, entity=None, role='applicant'):
    return {'label': label, 'value': str(value), 'entity_key': entity, 'role': role}


def paper_fields(spec, profile, blueprint):
    kind = spec['kind']; people = profile['people']; facts = profile['facts']
    role = 'applicant'
    title = fold(spec['title'])
    if kind in {'birth', 'birth_notice', 'school'} or re.search(r'cua tre|hoc sinh|cua con', title):
        role = 'child'
    elif kind == 'death':
        role = 'deceased'
    elif re.search(r'cua me\b', title):
        role = 'mother'
    elif re.search(r'cua cha\b', title):
        role = 'father'
    p = people[role]
    def person(label, key):
        return field(label, p[key], role+'.'+key, role)
    identity = [person('Họ và tên', 'name'), person('Ngày sinh', 'dob'),
                person('Số định danh giả lập', 'id'),
                field('Địa chỉ', profile['address'], 'household.address', role)]
    issue = field('Ngày lập dữ liệu', profile['date'], 'date')
    if kind == 'identity':
        return identity+[person('Giới tính', 'gender'), field('Quốc tịch', 'Việt Nam'),
                         field('Ngày cấp giả lập', profile['issue_date'], 'issue_date'),
                         field('Nơi tạo mẫu', facts['issued_by'])]
    if kind in {'birth', 'birth_notice'}:
        return identity+[person('Giới tính', 'gender'), field('Nơi sinh', 'Hà Nội'),
                         field('Họ tên cha', people['father']['name'], 'father.name', 'father'),
                         field('Số định danh cha', people['father']['id'], 'father.id', 'father'),
                         field('Họ tên mẹ', people['mother']['name'], 'mother.name', 'mother'),
                         field('Số định danh mẹ', people['mother']['id'], 'mother.id', 'mother'),
                         field('Số đăng ký giả lập', facts['birth_no'], 'facts.birth_no'), issue]
    if kind == 'death':
        return identity+[field('Ngày chết', profile['death_date'], 'death_date', 'deceased'),
                         field('Nơi chết', 'Hà Nội'), field('Số đăng ký giả lập', facts['death_no'], 'facts.death_no'),
                         field('Người khai', people['applicant']['name'], 'applicant.name'), issue]
    if kind == 'marriage':
        return [field('Họ tên chồng', people['husband']['name'], 'husband.name', 'husband'),
                field('Ngày sinh chồng', people['husband']['dob'], 'husband.dob', 'husband'),
                field('Số định danh chồng', people['husband']['id'], 'husband.id', 'husband'),
                field('Họ tên vợ', people['wife']['name'], 'wife.name', 'wife'),
                field('Ngày sinh vợ', people['wife']['dob'], 'wife.dob', 'wife'),
                field('Số định danh vợ', people['wife']['id'], 'wife.id', 'wife'),
                field('Địa chỉ', profile['address'], 'household.address'),
                field('Số đăng ký giả lập', facts['marriage_no'], 'facts.marriage_no'),
                field('Ngày đăng ký giả lập', '15/06/2018'), issue]
    if kind == 'residence':
        return identity+[field('Chủ hộ', people['applicant']['name'], 'applicant.name'),
                         field('Quan hệ với chủ hộ', 'Bản thân' if role == 'applicant' else 'Con'),
                         field('Loại cư trú', 'Thường trú'), issue]
    if kind == 'land':
        return identity+[field('Công trình / khu vực', facts['project'], 'facts.project'),
                         field('Thửa đất số', facts['land_parcel'], 'facts.land_parcel'),
                         field('Tờ bản đồ số', facts['map_sheet'], 'facts.map_sheet'),
                         field('Diện tích', facts['area'], 'facts.area'),
                         field('Mục đích sử dụng', facts['land_purpose'], 'facts.land_purpose'),
                         field('Số tham chiếu giả lập', facts['license_no'], 'facts.license_no'), issue]
    if kind == 'school':
        return identity+[field('Trường', facts['school'], 'facts.school'),
                         field('Lớp', facts['class'], 'facts.class'),
                         field('Năm học', facts['school_year'], 'facts.school_year'),
                         field('Toán', '8,0'), field('Ngữ văn / Tiếng Việt', '8,5'),
                         field('Kết quả học tập', 'Hoàn thành chương trình'), issue]
    organization = [field('Tên tổ chức / cơ sở', profile['organization'], 'organization'),
                    field('Mã số thuế giả lập', profile['tax_id'], 'tax_id')]
    if kind == 'contract':
        return [field('Bên A', people['applicant']['name'], 'applicant.name'),
                field('Số định danh bên A', people['applicant']['id'], 'applicant.id'),
                field('Bên B', people['representative']['name'], 'representative.name', 'representative'),
                field('Số định danh bên B', people['representative']['id'], 'representative.id', 'representative'),
                field('Địa chỉ thực hiện', profile['address'], 'household.address'),
                field('Số hợp đồng giả lập', facts['contract_no'], 'facts.contract_no'),
                field('Giá trị giả lập', facts['budget'], 'facts.budget'),
                field('Nội dung thỏa thuận', 'Cung cấp địa điểm, tài liệu hoặc dịch vụ theo kịch bản kiểm thử.'), issue]
    if kind == 'certificate':
        return identity+organization+[field('Số văn bản giả lập', facts['license_no'], 'facts.license_no'),
                                      field('Ngày cấp giả lập', profile['issue_date'], 'issue_date'),
                                      field('Đơn vị tạo mẫu', facts['issued_by']),
                                      field('Nội dung', 'Thông tin điều kiện và hoạt động trong kịch bản kiểm thử '+blueprint['id']+'.')]
    if kind == 'roster':
        return organization+[field('Người lập', people['applicant']['name'], 'applicant.name'),
                             field('Địa chỉ', profile['address'], 'household.address'), issue]
    return identity+organization+[field('Mã thủ tục trong kiểm kê', blueprint['procedure_code']),
                                  field('Điện thoại giả lập', profile['phone'], 'phone'),
                                  field('Thư điện tử', profile['email'], 'email'), issue]


def wrap(text, font, size, width):
    result = []
    for paragraph in str(text).splitlines() or ['']:
        line = ''
        for word in paragraph.split():
            candidate = (line+' '+word).strip()
            if line and pdfmetrics.stringWidth(candidate, font, size) > width:
                result.append(line); line = word
            else:
                line = candidate
        result.append(line)
    return result


def render_paper(root, out, spec, profile, blueprint, copy_index):
    styles = register_fonts(root); ink, font_path = styles[copy_index % 2]
    document_id = 'mock-'+profile['packet_id'].removeprefix('hs-')+'-'+hashlib.sha256(spec['id'].encode()).hexdigest()[:12]
    stream = io.BytesIO(); width, height = 595.28, 841.89
    canvas = Canvas(stream, pagesize=(width, height), pageCompression=1, invariant=1)
    truth = []; page = 0; y = 0
    def text_at(x, top, text, font='VNText', size=10, color=(.16, .20, .24)):
        canvas.setFillColorRGB(*color); canvas.setFont(font, size)
        canvas.drawString(x, height-top, text)
    def new_page():
        nonlocal page, y
        if page:
            canvas.showPage()
        page += 1
        canvas.setFillColorRGB(.96, .97, .98); canvas.rect(38, height-69, width-76, 36, stroke=0, fill=1)
        text_at(49, 49, 'DỮ LIỆU GIẢ LẬP - CHỈ DÙNG KIỂM THỬ', 'VNBold', 11, (.65, .16, .15))
        text_at(49, 62, 'Giấy tờ tự dựng; không phải bản cấp bởi cơ quan có thẩm quyền.', size=7.8)
        text_at(40, height-33, document_id+' | Trang '+str(page), size=7)
        text_at(40, height-21, 'Không có chữ ký, con dấu thật. Chữ điền mô phỏng bằng font.', size=7)
        y = 91
    def paragraph(text, font='VNText', size=9.6, leading=15, gap=9):
        nonlocal y
        for line in wrap(text, font, size, width-96):
            if y+leading > height-62:
                new_page()
            text_at(48, y, line, font, size); y += leading
        y += gap
    new_page()
    # Titles are bounded for readability; full source descriptions remain in
    # checklist.json and the labels, with no truncation of required metadata.
    title = re.split(r'\s*(?:\(|;|\.\s| theo | ban hành | kèm theo )', spec['title'], maxsplit=1)[0].strip(' -+')
    if len(title) > 180:
        title = title[:177].rsplit(' ', 1)[0]+'...'
    paragraph(title.upper(), 'VNBold', 13, 19, 8)
    paragraph('Số mẫu: '+document_id+' | Bộ '+str(copy_index+1), size=8, leading=12, gap=5)
    paragraph('Hồ sơ: '+blueprint['name'], size=9, leading=14, gap=10)
    for i, f in enumerate(paper_fields(spec, profile, blueprint), 1):
        label_lines = wrap(f['label'], 'VNText', 9, 156)
        value_lines = wrap(f['value'], ink, 12, width-268)
        row_height = max(len(label_lines)*13, len(value_lines)*17)+14
        if y+row_height > height-65:
            new_page()
        canvas.setStrokeColorRGB(.83, .87, .90); canvas.setLineWidth(.4)
        canvas.line(48, height-y-row_height+5, width-48, height-y-row_height+5)
        for j, line in enumerate(label_lines):
            text_at(48, y+11+j*13, line, size=9)
        top = y+12-12*1.1; bottom = y+12+(len(value_lines)-1)*17+12*.3
        for j, line in enumerate(value_lines):
            text_at(220, y+12+j*17, line, ink, 12, (.08, .23, .43))
        truth.append({**f, 'id': f'f{i:03}', 'page': page,
                      'bbox': [219, top-1, width-47, bottom+2],
                      'ink_bbox': [220, top, max(221, 220+max(pdfmetrics.stringWidth(t, ink, 12) for t in value_lines)), bottom],
                      'font_name': font_path.stem, 'font_size': 12,
                      'expected_status': 'filled', 'coordinate_origin': 'top_left', 'bbox_unit': 'pdf_point'})
        y += row_height
    kind = spec['kind']
    if kind == 'roster':
        paragraph('BẢNG KÊ CHI TIẾT', 'VNBold', 10)
        for i, role in enumerate(['applicant', 'representative', 'beneficiary'], 1):
            p = profile['people'][role]
            paragraph(f"{i}. {p['name']} - Số định danh {p['id']} - 01 mục / hồ sơ - Đã có dữ liệu giả lập.", ink, 11, 16, 4)
    elif kind in {'report', 'minutes', 'evidence', 'application'}:
        paragraph('NỘI DUNG MẪU', 'VNBold', 10)
        body = {
            'report': '1. Hiện trạng: Cơ sở Mẫu Thử có 03 nhân sự và 01 địa điểm hoạt động.\n2. Phương án: Thực hiện các hạng mục trong hồ sơ; thời gian dự kiến 30 ngày.\n3. Kinh phí dự kiến: '+profile['facts']['budget']+'. Nguồn vốn tự bố trí trong kịch bản thử.',
            'minutes': 'Vào ngày '+profile['date']+', các thành viên trong danh sách thống nhất nội dung đề nghị và tài liệu kèm theo. Cuộc họp giả lập có 03 người tham dự, 03 ý kiến đồng ý.',
            'evidence': 'Tài liệu ghi nhận tình huống giả lập phục vụ thử nghiệm phân loại và đọc thông tin. Chủ thể, địa điểm và mã tham chiếu sử dụng cùng thông tin với các giấy tờ trong bộ hồ sơ.',
            'application': 'Kính gửi đơn vị tiếp nhận Mẫu Thử.\nNgười khai đề nghị xử lý nội dung: '+blueprint['name']+'. Các tài liệu đính kèm là dữ liệu giả lập được liệt kê trong checklist của bộ hồ sơ.',
        }[kind]
        paragraph(body, ink, 11.5, 17, 7)
    paragraph('Người lập mẫu: '+profile['people']['applicant']['name']+' - không ký, không đóng dấu.', size=9, leading=14)
    canvas.save()
    destination = out/'documents'/(document_id+'.pdf'); destination.parent.mkdir(parents=True, exist_ok=True)
    with fitz.open(stream=stream.getvalue(), filetype='pdf') as vector, fitz.open() as raster:
        for original in vector:
            pix = original.get_pixmap(dpi=150, alpha=False)
            target = raster.new_page(width=original.rect.width, height=original.rect.height)
            target.insert_image(target.rect, stream=pix.tobytes('png'))
        raster.set_metadata({'title': 'GIẢ LẬP - '+title, 'subject': 'Synthetic mock document for OCR tests'})
        raster.save(destination, garbage=4, deflate=True)
    ground = out/'ground-truth'/(document_id+'.json')
    save(ground, {'document_id': document_id, 'packet_id': profile['packet_id'],
                  'synthetic': True, 'artifact_kind': 'synthetic_mock',
                  'source_original_available': False, 'layout_basis': 'purpose_built_test_fixture',
                  'schema_status': 'synthetic_fixture_fields', 'handwriting_kind': 'font_simulation',
                  'requirement_id': spec['id'], 'source_description': spec['title'], 'fields': truth,
                  'reserved': ['signature', 'seal'], 'layout_issues': []})
    return {'id': document_id, 'title': spec['title'], 'template_id': None,
            'artifact_kind': 'synthetic_mock', 'mock_document_kind': kind,
            'requirement_ids': [spec['id']], 'local_path': str(destination.relative_to(root)),
            'sha256': sha(destination), 'byte_size': destination.stat().st_size,
            'page_count': page, 'media_type': 'application/pdf',
            'ground_truth_path': str(ground.relative_to(root)),
            'source_pdf': None, 'original_sha256': None,
            'filled_fields': len(truth), 'font_name': font_path.stem}
