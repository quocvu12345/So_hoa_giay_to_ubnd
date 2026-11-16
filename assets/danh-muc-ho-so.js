// Danh mục phục vụ thiết kế và khảo sát, không phải danh mục chính thức đã phê duyệt.
// 1. departmentName: đầu mối phụ trách đề xuất (khác cơ quan ban hành trên giấy).
// 2. title: nhóm hồ sơ công việc, chứa nhiều giấy tờ liên quan.
// 3. documentTypes: từng loại giấy tờ cụ thể và các trường cần đọc/nhập nếu có.
// direction: Đến / Đi / Nội bộ là thuộc tính riêng, KHÔNG dùng làm loại giấy tờ.
// Một hồ sơ không bắt buộc có đủ mọi loại giấy tờ liệt kê; đối chiếu hồ sơ thực tế.
window.HOSO_DEPARTMENTS = [
  {
    "id": "vp",
    "name": "Văn phòng HĐND và UBND",
    "kind": "Phòng chuyên môn / bộ phận văn thư, tổng hợp",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "nv",
    "name": "Phòng Nội vụ - Tư pháp",
    "kind": "Phòng chuyên môn",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "kt",
    "name": "Phòng Kinh tế",
    "kind": "Phòng chuyên môn",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "ht",
    "name": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "kind": "Phòng chuyên môn",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "vx",
    "name": "Phòng Văn hóa - Xã hội",
    "kind": "Phòng chuyên môn",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "mc",
    "name": "Điểm Phục vụ hành chính công / đơn vị giải quyết",
    "kind": "Đầu mối liên thông, không gán là phòng chuyên môn",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "qp",
    "name": "Ban Chỉ huy quân sự / Công an phối hợp UBND",
    "kind": "Đơn vị phối hợp; chỉ tiếp nhận hồ sơ trong phạm vi được giao",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "tt",
    "name": "Thường trực HĐND",
    "kind": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "bkt",
    "name": "Ban Kinh tế - Ngân sách HĐND",
    "kind": "Ban của HĐND, khác Phòng Kinh tế thuộc UBND",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "bvx",
    "name": "Ban Văn hóa - Xã hội HĐND",
    "kind": "Ban của HĐND, khác Phòng Văn hóa - Xã hội thuộc UBND",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  },
  {
    "id": "db",
    "name": "Tổ đại biểu / đại biểu HĐND",
    "kind": "Chủ thể hoạt động HĐND; Văn phòng hỗ trợ",
    "assignment": "Đề xuất; xác nhận theo phân công hiện hành khi khảo sát"
  }
];

window.HOSO_CATALOG = [
  {
    "code": "U01",
    "group": "UBND",
    "title": "Công văn, quyết định, thông báo và sổ đăng ký",
    "owner": "vp",
    "ownerLabel": "Văn phòng HĐND và UBND",
    "departmentName": "Văn phòng HĐND và UBND",
    "departmentRole": "Phòng chuyên môn / bộ phận văn thư, tổng hợp",
    "responsibility": "Các phòng chuyên môn xử lý nội dung; văn thư quản lý đăng ký và bản lưu.",
    "businessFields": "Số đến/đi; ngày nhận/phát hành; nơi gửi/nhận; số, ký hiệu; trích yếu; người ký; hạn xử lý.",
    "filingRule": "Sổ đăng ký theo năm; tài liệu đồng thời liên kết với hồ sơ công việc gốc, không gom mọi công văn thành một hồ sơ.",
    "documentTypes": [
      {
        "id": "U01-D01",
        "name": "Công văn chỉ đạo, hướng dẫn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D02",
        "name": "Công văn đề nghị phối hợp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D03",
        "name": "Công văn trả lời, giải trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D04",
        "name": "Quyết định hành chính",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D05",
        "name": "Thông báo của UBND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D06",
        "name": "Giấy mời họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D07",
        "name": "Phiếu chuyển văn bản xử lý",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D08",
        "name": "Phiếu trình lãnh đạo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D09",
        "name": "Sổ đăng ký văn bản đến",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D10",
        "name": "Sổ đăng ký văn bản đi",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D11",
        "name": "Phiếu gửi văn bản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U01-D12",
        "name": "Giấy xác nhận đã nhận văn bản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U02",
    "group": "UBND",
    "title": "Chỉ đạo, điều hành và hội nghị UBND",
    "owner": "vp",
    "ownerLabel": "Văn phòng HĐND và UBND",
    "departmentName": "Văn phòng HĐND và UBND",
    "departmentRole": "Phòng chuyên môn / bộ phận văn thư, tổng hợp",
    "responsibility": "Lãnh đạo UBND và phòng chuyên môn cung cấp báo cáo, xác nhận kết quả.",
    "businessFields": "Kỳ báo cáo; cuộc họp; ngày họp; nhiệm vụ; đơn vị thực hiện; thời hạn; số văn bản kết luận.",
    "filingRule": "Theo chương trình, cuộc họp hoặc vụ việc; giữ liên kết tài liệu trước, trong và sau cuộc họp.",
    "documentTypes": [
      {
        "id": "U02-D01",
        "name": "Chương trình công tác",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D02",
        "name": "Lịch công tác",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D03",
        "name": "Quyết định phân công nhiệm vụ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D04",
        "name": "Quy chế làm việc",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D05",
        "name": "Giấy mời phiên họp UBND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D06",
        "name": "Chương trình phiên họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D07",
        "name": "Báo cáo trình phiên họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D08",
        "name": "Biên bản phiên họp UBND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D09",
        "name": "Thông báo kết luận cuộc họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D10",
        "name": "Báo cáo kinh tế - xã hội tổng hợp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U02-D11",
        "name": "Báo cáo kết quả thực hiện nhiệm vụ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U03",
    "group": "UBND",
    "title": "Văn thư, lưu trữ và bàn giao sau sắp xếp",
    "owner": "vp",
    "ownerLabel": "Văn phòng HĐND và UBND",
    "departmentName": "Văn phòng HĐND và UBND",
    "departmentRole": "Phòng chuyên môn / bộ phận văn thư, tổng hợp",
    "responsibility": "Mỗi phòng lập hồ sơ công việc; đầu mối lưu trữ nhận bàn giao theo phân công.",
    "businessFields": "Cơ quan hình thành; đơn vị giao/nhận; phông; thời gian tài liệu; mã hồ sơ; số tờ; thời hạn lưu trữ; vị trí hộp/kệ.",
    "filingRule": "Giữ nguyên nguồn gốc và niên đại trước sắp xếp; lưu riêng đơn vị đang quản lý, không đổi tên cơ quan ban hành cũ thành cơ quan mới.",
    "documentTypes": [
      {
        "id": "U03-D01",
        "name": "Danh mục hồ sơ hằng năm",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D02",
        "name": "Mục lục hồ sơ, tài liệu",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D03",
        "name": "Biên bản giao nhận tài liệu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D04",
        "name": "Biên bản nộp lưu hồ sơ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D05",
        "name": "Biên bản kiểm kê tài liệu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D06",
        "name": "Danh sách tài liệu thiếu",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D07",
        "name": "Phiếu yêu cầu khai thác tài liệu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D08",
        "name": "Sổ mượn, trả tài liệu",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D09",
        "name": "Phiếu kiểm tra chất lượng số hóa",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D10",
        "name": "Biên bản nghiệm thu số hóa",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D11",
        "name": "Biên bản bàn giao dữ liệu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U03-D12",
        "name": "Biên bản tiếp nhận hồ sơ từ đơn vị tiền nhiệm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U04",
    "group": "UBND",
    "title": "Tiếp công dân, đơn thư và xử lý vụ việc",
    "owner": "vp",
    "ownerLabel": "Văn phòng HĐND và UBND",
    "departmentName": "Văn phòng HĐND và UBND",
    "departmentRole": "Phòng chuyên môn / bộ phận văn thư, tổng hợp",
    "responsibility": "Đề xuất Văn phòng tổng hợp; phòng theo lĩnh vực chủ trì xác minh theo giao nhiệm vụ; phối hợp Nội vụ - Tư pháp.",
    "businessFields": "Mã vụ việc; loại đơn; người gửi; ngày nhận; nội dung; đơn vị xử lý; hạn; kết quả; liên kết đơn lặp.",
    "filingRule": "Theo vụ việc và quá trình giải quyết; hạn chế quyền truy cập thông tin người gửi, nhất là hồ sơ tố cáo.",
    "documentTypes": [
      {
        "id": "U04-D01",
        "name": "Sổ tiếp công dân",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D02",
        "name": "Lịch tiếp công dân",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D03",
        "name": "Biên bản tiếp công dân",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D04",
        "name": "Đơn khiếu nại",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D05",
        "name": "Đơn tố cáo",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D06",
        "name": "Đơn kiến nghị",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D07",
        "name": "Đơn phản ánh",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D08",
        "name": "Phiếu phân loại đơn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D09",
        "name": "Phiếu chuyển đơn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D10",
        "name": "Thông báo thụ lý",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D11",
        "name": "Biên bản xác minh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D12",
        "name": "Báo cáo đề xuất giải quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D13",
        "name": "Quyết định giải quyết khiếu nại",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D14",
        "name": "Kết luận nội dung tố cáo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U04-D15",
        "name": "Thông báo kết quả xử lý đơn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U05",
    "group": "UBND",
    "title": "Tổ chức bộ máy, cán bộ và nhân sự",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Văn phòng, các phòng sử dụng nhân sự; kế toán đối chiếu chế độ chi trả.",
    "businessFields": "Mã cán bộ; đơn vị; chức danh; quyết định; ngày hiệu lực; bậc/hệ số lương nếu có.",
    "filingRule": "Theo từng cán bộ hoặc từng đề án tổ chức; dữ liệu nhân sự có quyền xem riêng.",
    "documentTypes": [
      {
        "id": "U05-D01",
        "name": "Đề án tổ chức lại đơn vị",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D02",
        "name": "Quyết định thành lập đơn vị",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D03",
        "name": "Quy định chức năng, nhiệm vụ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D04",
        "name": "Danh mục vị trí việc làm",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D05",
        "name": "Quyết định giao biên chế",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D06",
        "name": "Quyết định tuyển dụng hoặc tiếp nhận",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D07",
        "name": "Quyết định điều động",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D08",
        "name": "Quyết định bổ nhiệm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D09",
        "name": "Sơ yếu lý lịch cán bộ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D10",
        "name": "Bản sao văn bằng, chứng chỉ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D11",
        "name": "Hợp đồng lao động",
        "fields": [
          "Số hợp đồng",
          "Ngày ký",
          "Các bên ký kết",
          "Nội dung hợp đồng",
          "Giá trị",
          "Thời hạn thực hiện"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số hợp đồng",
              "Ngày ký",
              "Các bên ký kết",
              "Nội dung hợp đồng",
              "Giá trị",
              "Thời hạn thực hiện"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D12",
        "name": "Quyết định nâng lương",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D13",
        "name": "Phiếu đánh giá công chức",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D14",
        "name": "Quyết định cử đi đào tạo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U05-D15",
        "name": "Quyết định nghỉ hưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U06",
    "group": "UBND",
    "title": "Thi đua, khen thưởng và kỷ luật",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đơn vị đề nghị; hội đồng và người có thẩm quyền xem xét.",
    "businessFields": "Đợt/năm; cá nhân/tập thể; hình thức; số quyết định; ngày hiệu lực.",
    "filingRule": "Tách hồ sơ khen thưởng và hồ sơ kỷ luật; quyền khai thác theo nội dung.",
    "documentTypes": [
      {
        "id": "U06-D01",
        "name": "Bản đăng ký thi đua",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D02",
        "name": "Giao ước thi đua",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D03",
        "name": "Báo cáo thành tích",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D04",
        "name": "Tờ trình đề nghị khen thưởng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D05",
        "name": "Danh sách đề nghị khen thưởng",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D06",
        "name": "Biên bản họp hội đồng thi đua",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D07",
        "name": "Quyết định khen thưởng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D08",
        "name": "Bản kiểm điểm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D09",
        "name": "Bản giải trình kỷ luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D10",
        "name": "Biên bản họp xét kỷ luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U06-D11",
        "name": "Quyết định kỷ luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U07",
    "group": "UBND",
    "title": "Cải cách hành chính, công vụ và tổ chức bầu cử",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Văn phòng, cơ quan bầu cử, các phòng và tổ dân phố; phân biệt với hồ sơ hoạt động đại biểu HĐND.",
    "businessFields": "Năm; đợt kiểm tra/bầu cử; đơn vị/tổ bầu cử; mốc thời gian; số quyết định; kết quả.",
    "filingRule": "Theo nhiệm vụ hoặc kỳ bầu cử. Danh sách cá nhân chỉ nhập khi nằm trong phạm vi được phép số hóa.",
    "documentTypes": [
      {
        "id": "U07-D01",
        "name": "Kế hoạch cải cách hành chính",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D02",
        "name": "Báo cáo cải cách hành chính",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D03",
        "name": "Phiếu chấm điểm cải cách hành chính",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D04",
        "name": "Biên bản kiểm tra công vụ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D05",
        "name": "Kế hoạch tổ chức bầu cử",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D06",
        "name": "Quyết định thành lập tổ bầu cử",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D07",
        "name": "Danh sách cử tri thuộc phạm vi bàn giao",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D08",
        "name": "Biên bản kiểm phiếu thuộc phạm vi bàn giao",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D09",
        "name": "Báo cáo kết quả bầu cử",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U07-D10",
        "name": "Quyết định công nhận chức danh tổ dân phố",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U08",
    "group": "UBND",
    "title": "Hộ tịch",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đầu mối tiếp nhận TTHC; hệ thống hộ tịch chuyên ngành và cơ quan có thẩm quyền liên quan.",
    "businessFields": "Loại việc; số/quyển đăng ký; ngày đăng ký; họ tên; ngày sinh; quan hệ; số trích lục; định danh chỉ khi cần.",
    "filingRule": "Theo loại việc, năm và số đăng ký; quét sổ bằng thiết bị phù hợp, đối chiếu dữ liệu hộ tịch đã có.",
    "documentTypes": [
      {
        "id": "U08-D01",
        "name": "Tờ khai đăng ký khai sinh",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D02",
        "name": "Giấy chứng sinh trong hồ sơ khai sinh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D03",
        "name": "Giấy khai sinh bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D04",
        "name": "Tờ khai đăng ký kết hôn",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D05",
        "name": "Giấy chứng nhận kết hôn bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D06",
        "name": "Tờ khai đăng ký khai tử",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D07",
        "name": "Giấy báo tử trong hồ sơ khai tử",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D08",
        "name": "Trích lục khai tử",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D09",
        "name": "Tờ khai cấp giấy xác nhận tình trạng hôn nhân",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D10",
        "name": "Giấy xác nhận tình trạng hôn nhân bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D11",
        "name": "Tờ khai thay đổi, cải chính hộ tịch",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D12",
        "name": "Trích lục thay đổi, cải chính hộ tịch",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D13",
        "name": "Tờ khai đăng ký nhận cha, mẹ, con",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D14",
        "name": "Sổ đăng ký hộ tịch",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U08-D15",
        "name": "Phiếu yêu cầu cấp bản sao trích lục hộ tịch",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U09",
    "group": "UBND",
    "title": "Chứng thực",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đầu mối tiếp nhận và cán bộ thực hiện chứng thực.",
    "businessFields": "Loại chứng thực; số sổ; ngày thực hiện; người yêu cầu; người ký chứng thực; loại giấy tờ.",
    "filingRule": "Theo sổ, năm và số chứng thực; quản lý riêng giấy tờ định danh, bản sao và bản lưu.",
    "documentTypes": [
      {
        "id": "U09-D01",
        "name": "Phiếu yêu cầu chứng thực",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D02",
        "name": "Bản sao giấy tờ được chứng thực",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D03",
        "name": "Bản lưu giấy tờ có chữ ký được chứng thực",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D04",
        "name": "Bản dịch có chứng thực chữ ký người dịch",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D05",
        "name": "Hợp đồng được chứng thực bản lưu",
        "fields": [
          "Số hợp đồng",
          "Ngày ký",
          "Các bên ký kết",
          "Nội dung hợp đồng",
          "Giá trị",
          "Thời hạn thực hiện"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số hợp đồng",
              "Ngày ký",
              "Các bên ký kết",
              "Nội dung hợp đồng",
              "Giá trị",
              "Thời hạn thực hiện"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D06",
        "name": "Văn bản giao dịch được chứng thực bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D07",
        "name": "Sổ chứng thực bản sao",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D08",
        "name": "Sổ chứng thực chữ ký",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D09",
        "name": "Sổ chứng thực hợp đồng, giao dịch",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D10",
        "name": "Biên lai thu phí chứng thực",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U09-D11",
        "name": "Văn bản đề nghị nhận thừa kế",
        "fields": [
          "Người đề nghị nhận thừa kế",
          "Giấy tờ định danh người đề nghị",
          "Địa chỉ người đề nghị",
          "Người để lại di sản",
          "Ngày mất",
          "Giấy chứng tử",
          "Quan hệ với người để lại di sản",
          "Người đồng thừa kế",
          "Mô tả di sản",
          "Căn cứ thừa kế",
          "Nội dung đề nghị",
          "Ngày lập",
          "Ngày sinh người đề nghị",
          "Ngày cấp giấy tờ người đề nghị",
          "Nơi cấp giấy tờ người đề nghị"
        ],
        "fieldGroups": [
          {
            "title": "Người đề nghị",
            "fields": [
              "Người đề nghị nhận thừa kế",
              "Ngày sinh người đề nghị",
              "Giấy tờ định danh người đề nghị",
              "Ngày cấp giấy tờ người đề nghị",
              "Nơi cấp giấy tờ người đề nghị",
              "Địa chỉ người đề nghị"
            ]
          },
          {
            "title": "Người để lại di sản",
            "fields": [
              "Người để lại di sản",
              "Ngày mất",
              "Giấy chứng tử",
              "Quan hệ với người để lại di sản"
            ]
          },
          {
            "title": "Thừa kế",
            "fields": [
              "Người đồng thừa kế",
              "Mô tả di sản",
              "Căn cứ thừa kế",
              "Nội dung đề nghị",
              "Ngày lập"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh người đề nghị": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      },
      {
        "id": "U09-D12",
        "name": "Tờ tường trình về quan hệ nhân thân thừa kế",
        "fields": [
          "Người tường trình",
          "Giấy tờ định danh người tường trình",
          "Địa chỉ người tường trình",
          "Người để lại di sản",
          "Ngày mất",
          "Quan hệ với người để lại di sản",
          "Cha mẹ người để lại di sản",
          "Vợ hoặc chồng người để lại di sản",
          "Các con của người để lại di sản",
          "Địa chỉ bất động sản",
          "Ngày lập",
          "Ngày sinh người tường trình",
          "Ngày cấp giấy tờ người tường trình",
          "Nơi cấp giấy tờ người tường trình"
        ],
        "fieldGroups": [
          {
            "title": "Người tường trình",
            "fields": [
              "Người tường trình",
              "Ngày sinh người tường trình",
              "Giấy tờ định danh người tường trình",
              "Ngày cấp giấy tờ người tường trình",
              "Nơi cấp giấy tờ người tường trình",
              "Địa chỉ người tường trình"
            ]
          },
          {
            "title": "Người để lại di sản",
            "fields": [
              "Người để lại di sản",
              "Ngày mất",
              "Quan hệ với người để lại di sản"
            ]
          },
          {
            "title": "Quan hệ nhân thân",
            "fields": [
              "Cha mẹ người để lại di sản",
              "Vợ hoặc chồng người để lại di sản",
              "Các con của người để lại di sản"
            ]
          },
          {
            "title": "Thông tin khác",
            "fields": [
              "Địa chỉ bất động sản",
              "Ngày lập"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh người tường trình": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      },
      {
        "id": "U09-D13",
        "name": "Di chúc",
        "fields": [
          "Người lập di chúc",
          "Ngày sinh",
          "Giấy tờ định danh người lập di chúc",
          "Địa chỉ người lập di chúc",
          "Người hưởng di sản",
          "Mô tả di sản",
          "Nội dung phân chia di sản",
          "Người làm chứng",
          "Người quản lý di sản",
          "Ngày lập",
          "Ngày cấp giấy tờ người lập di chúc",
          "Nơi cấp giấy tờ người lập di chúc"
        ],
        "fieldGroups": [
          {
            "title": "Người lập di chúc",
            "fields": [
              "Người lập di chúc",
              "Ngày sinh",
              "Giấy tờ định danh người lập di chúc",
              "Ngày cấp giấy tờ người lập di chúc",
              "Nơi cấp giấy tờ người lập di chúc",
              "Địa chỉ người lập di chúc"
            ]
          },
          {
            "title": "Di sản & người hưởng",
            "fields": [
              "Người hưởng di sản",
              "Mô tả di sản",
              "Nội dung phân chia di sản",
              "Người quản lý di sản"
            ]
          },
          {
            "title": "Người làm chứng & thời điểm",
            "fields": [
              "Người làm chứng",
              "Ngày lập"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh người lập di chúc": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      },
      {
        "id": "U09-D14",
        "name": "Văn bản khai nhận hoặc thỏa thuận phân chia di sản",
        "fields": [
          "Người để lại di sản",
          "Ngày mất",
          "Giấy chứng tử",
          "Người nhận di sản",
          "Giấy tờ định danh người nhận di sản",
          "Quan hệ với người để lại di sản",
          "Mô tả di sản",
          "Nội dung phân chia di sản",
          "Số giấy chứng nhận",
          "Ngày lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Người để lại di sản",
              "Ngày mất",
              "Giấy chứng tử",
              "Người nhận di sản",
              "Giấy tờ định danh người nhận di sản",
              "Quan hệ với người để lại di sản",
              "Mô tả di sản",
              "Nội dung phân chia di sản",
              "Số giấy chứng nhận",
              "Ngày lập"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh người nhận di sản": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      }
    ]
  },
  {
    "code": "U10",
    "group": "UBND",
    "title": "Pháp luật, hòa giải và xử lý vi phạm hành chính",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Phòng chuyên môn giữ hồ sơ xử phạt theo lĩnh vực; Nội vụ - Tư pháp đề xuất đầu mối tổng hợp pháp lý.",
    "businessFields": "Loại nhiệm vụ; vụ việc; văn bản liên quan; lĩnh vực; ngày; kết quả hòa giải/xử lý.",
    "filingRule": "Tách hồ sơ xây dựng pháp luật, hòa giải và từng vụ xử lý; không tự kết luận thẩm quyền từ tên văn bản.",
    "documentTypes": [
      {
        "id": "U10-D01",
        "name": "Dự thảo văn bản quy phạm pháp luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D02",
        "name": "Báo cáo thẩm định dự thảo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D03",
        "name": "Công văn góp ý dự thảo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D04",
        "name": "Báo cáo rà soát văn bản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D05",
        "name": "Kế hoạch phổ biến pháp luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D06",
        "name": "Báo cáo chuẩn tiếp cận pháp luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D07",
        "name": "Biên bản hòa giải",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D08",
        "name": "Báo cáo kết quả hòa giải",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D09",
        "name": "Quyết định công nhận hòa giải viên",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D10",
        "name": "Sổ theo dõi xử lý vi phạm hành chính",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U10-D11",
        "name": "Báo cáo thi hành pháp luật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U11",
    "group": "UBND",
    "title": "Ngân sách, kế toán và quyết toán",
    "owner": "kt",
    "ownerLabel": "Phòng Kinh tế",
    "departmentName": "Phòng Kinh tế",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Kế toán, chủ tài khoản và đơn vị sử dụng ngân sách; xác nhận nơi giữ chứng từ gốc.",
    "businessFields": "Năm/kỳ; nguồn kinh phí; mục/tiểu mục; số chứng từ; ngày; đối tượng; số tiền; dự án nếu có.",
    "filingRule": "Theo kỳ kế toán, nguồn kinh phí và bộ chứng từ; số tiền phải đối chiếu ảnh gốc trước duyệt.",
    "documentTypes": [
      {
        "id": "U11-D01",
        "name": "Dự toán thu, chi ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D02",
        "name": "Phương án phân bổ ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D03",
        "name": "Quyết định giao dự toán",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D04",
        "name": "Quyết định điều chỉnh dự toán",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D05",
        "name": "Phiếu thu",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D06",
        "name": "Phiếu chi",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D07",
        "name": "Giấy đề nghị thanh toán",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D08",
        "name": "Ủy nhiệm chi",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D09",
        "name": "Hóa đơn",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D10",
        "name": "Bảng kê chứng từ",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D11",
        "name": "Sổ kế toán",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D12",
        "name": "Biên bản đối chiếu số liệu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D13",
        "name": "Báo cáo tài chính",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D14",
        "name": "Báo cáo quyết toán",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U11-D15",
        "name": "Biên bản kiểm toán",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U12",
    "group": "UBND",
    "title": "Tài sản công, mua sắm và hợp đồng",
    "owner": "kt",
    "ownerLabel": "Phòng Kinh tế",
    "departmentName": "Phòng Kinh tế",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Văn phòng, đơn vị sử dụng tài sản; chủ đầu tư hoặc bên mời thầu theo phân công.",
    "businessFields": "Mã tài sản/gói thầu; hợp đồng; nhà cung cấp; giá trị; ngày nghiệm thu; đơn vị sử dụng.",
    "filingRule": "Theo tài sản hoặc gói mua sắm; liên kết hợp đồng với nghiệm thu, thanh toán và bảo hành.",
    "documentTypes": [
      {
        "id": "U12-D01",
        "name": "Sổ tài sản công",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D02",
        "name": "Biên bản kiểm kê tài sản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D03",
        "name": "Tờ trình đề nghị mua sắm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D04",
        "name": "Dự toán mua sắm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D05",
        "name": "Kế hoạch lựa chọn nhà thầu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D06",
        "name": "Báo cáo đánh giá hồ sơ dự thầu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D07",
        "name": "Quyết định phê duyệt kết quả lựa chọn nhà thầu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D08",
        "name": "Hợp đồng mua sắm",
        "fields": [
          "Số hợp đồng",
          "Ngày ký",
          "Các bên ký kết",
          "Nội dung hợp đồng",
          "Giá trị",
          "Thời hạn thực hiện"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số hợp đồng",
              "Ngày ký",
              "Các bên ký kết",
              "Nội dung hợp đồng",
              "Giá trị",
              "Thời hạn thực hiện"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D09",
        "name": "Phụ lục hợp đồng",
        "fields": [
          "Số hợp đồng",
          "Ngày ký",
          "Các bên ký kết",
          "Nội dung hợp đồng",
          "Giá trị",
          "Thời hạn thực hiện"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số hợp đồng",
              "Ngày ký",
              "Các bên ký kết",
              "Nội dung hợp đồng",
              "Giá trị",
              "Thời hạn thực hiện"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D10",
        "name": "Biên bản giao nhận tài sản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D11",
        "name": "Biên bản nghiệm thu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D12",
        "name": "Biên bản thanh lý hợp đồng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D13",
        "name": "Quyết định điều chuyển tài sản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U12-D14",
        "name": "Quyết định xử lý tài sản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U13",
    "group": "UBND",
    "title": "Kế hoạch phát triển và đầu tư công",
    "owner": "kt",
    "ownerLabel": "Phòng Kinh tế",
    "departmentName": "Phòng Kinh tế",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Ban quản lý dự án và Phòng Hạ tầng - Nông nghiệp và Môi trường; giữ đúng cơ quan tạo lập từng tài liệu.",
    "businessFields": "Mã dự án; tên dự án; chủ đầu tư; nguồn vốn; tổng mức; giai đoạn; tiến độ; số quyết định.",
    "filingRule": "Theo dự án và giai đoạn; bản vẽ khổ lớn, bảng tính, phụ lục được liên kết thành phần riêng.",
    "documentTypes": [
      {
        "id": "U13-D01",
        "name": "Kế hoạch phát triển kinh tế - xã hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D02",
        "name": "Kế hoạch đầu tư công",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D03",
        "name": "Tờ trình chủ trương đầu tư",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D04",
        "name": "Quyết định chủ trương đầu tư",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D05",
        "name": "Báo cáo đề xuất dự án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D06",
        "name": "Báo cáo thẩm định dự án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D07",
        "name": "Quyết định đầu tư",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D08",
        "name": "Dự toán công trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D09",
        "name": "Quyết định điều chỉnh dự án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D10",
        "name": "Báo cáo tiến độ dự án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D11",
        "name": "Báo cáo giải ngân",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D12",
        "name": "Biên bản nghiệm thu công trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D13",
        "name": "Biên bản bàn giao công trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U13-D14",
        "name": "Báo cáo quyết toán dự án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U14",
    "group": "UBND",
    "title": "Hộ kinh doanh, thương mại và dịch vụ",
    "owner": "kt",
    "ownerLabel": "Phòng Kinh tế",
    "departmentName": "Phòng Kinh tế",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đầu mối tiếp nhận TTHC, cơ quan thuế và đơn vị chuyên ngành; không nhập thay toàn bộ cơ sở dữ liệu thuế.",
    "businessFields": "Mã hồ sơ/đăng ký; tên cơ sở; chủ hộ; địa điểm; ngành nghề; trạng thái; ngày cấp/thay đổi.",
    "filingRule": "Theo cơ sở hoặc vụ việc; đối chiếu hệ thống đăng ký sẵn có, không nhân bản dữ liệu không cần thiết.",
    "documentTypes": [
      {
        "id": "U14-D01",
        "name": "Giấy đề nghị đăng ký hộ kinh doanh",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D02",
        "name": "Thông báo thay đổi nội dung đăng ký hộ kinh doanh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D03",
        "name": "Thông báo tạm ngừng kinh doanh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D04",
        "name": "Thông báo chấm dứt hoạt động hộ kinh doanh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D05",
        "name": "Giấy chứng nhận đăng ký hộ kinh doanh bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D06",
        "name": "Danh sách cơ sở kinh doanh",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D07",
        "name": "Biên bản kiểm tra cơ sở kinh doanh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D08",
        "name": "Kế hoạch hỗ trợ kinh tế",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D09",
        "name": "Báo cáo hoạt động thương mại, dịch vụ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U14-D10",
        "name": "Công văn phối hợp cơ quan thuế",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U15",
    "group": "UBND",
    "title": "Đất đai và hồ sơ địa chính",
    "owner": "ht",
    "ownerLabel": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentName": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Cơ quan đăng ký đất đai; điểm tiếp nhận; tổ dân phố và các bên liên quan.",
    "businessFields": "Số thửa đất; tờ bản đồ; địa chỉ; diện tích và đơn vị đo; người sử dụng; số giấy chứng nhận; loại biến động.",
    "filingRule": "Theo hồ sơ/thửa và lịch sử biến động; lưu cơ quan ban hành cũ, không dùng địa chỉ hiện tại để ghi đè nguồn gốc.",
    "documentTypes": [
      {
        "id": "U15-D01",
        "name": "Đơn đăng ký đất đai",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D02",
        "name": "Đơn đăng ký biến động đất đai",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận",
          "Ngày sinh người đề nghị",
          "Giấy tờ định danh người đề nghị",
          "Địa chỉ người đề nghị",
          "Số giấy chứng nhận",
          "Số thửa đất",
          "Số tờ bản đồ",
          "Diện tích đất",
          "Địa chỉ thửa đất"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận",
              "Ngày sinh người đề nghị",
              "Giấy tờ định danh người đề nghị",
              "Địa chỉ người đề nghị",
              "Số giấy chứng nhận",
              "Số thửa đất",
              "Số tờ bản đồ",
              "Diện tích đất",
              "Địa chỉ thửa đất"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh người đề nghị": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      },
      {
        "id": "U15-D03",
        "name": "Giấy tờ nguồn gốc sử dụng đất",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D04",
        "name": "Bản sao giấy chứng nhận quyền sử dụng đất",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D05",
        "name": "Trích lục bản đồ địa chính",
        "fields": [
          "Tên bản vẽ/ảnh",
          "Vị trí hoặc công trình",
          "Tỷ lệ nếu có",
          "Ngày lập/chụp",
          "Đơn vị lập",
          "Số tờ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bản vẽ/ảnh",
              "Vị trí hoặc công trình",
              "Tỷ lệ nếu có",
              "Ngày lập/chụp",
              "Đơn vị lập",
              "Số tờ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D06",
        "name": "Bản trích đo địa chính",
        "fields": [
          "Tên bản vẽ/ảnh",
          "Vị trí hoặc công trình",
          "Tỷ lệ nếu có",
          "Ngày lập/chụp",
          "Đơn vị lập",
          "Số tờ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bản vẽ/ảnh",
              "Vị trí hoặc công trình",
              "Tỷ lệ nếu có",
              "Ngày lập/chụp",
              "Đơn vị lập",
              "Số tờ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D07",
        "name": "Biên bản kiểm tra hiện trạng đất",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D08",
        "name": "Phiếu lấy ý kiến khu dân cư",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D09",
        "name": "Thông báo niêm yết hồ sơ đất đai",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D10",
        "name": "Biên bản kết thúc niêm yết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D11",
        "name": "Phiếu chuyển hồ sơ đất đai",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D12",
        "name": "Biên bản hòa giải tranh chấp đất đai",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D13",
        "name": "Sổ theo dõi đất công",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U15-D14",
        "name": "Hợp đồng chuyển nhượng quyền sử dụng đất",
        "fields": [
          "Bên chuyển nhượng",
          "Giấy tờ định danh bên chuyển nhượng",
          "Địa chỉ bên chuyển nhượng",
          "Bên nhận chuyển nhượng",
          "Giấy tờ định danh bên nhận chuyển nhượng",
          "Địa chỉ bên nhận chuyển nhượng",
          "Số thửa đất",
          "Số tờ bản đồ",
          "Địa chỉ thửa đất",
          "Diện tích đất",
          "Số giấy chứng nhận",
          "Giá chuyển nhượng",
          "Phương thức thanh toán",
          "Ngày lập hợp đồng",
          "Ngày sinh bên chuyển nhượng",
          "Ngày cấp giấy tờ bên chuyển nhượng",
          "Nơi cấp giấy tờ bên chuyển nhượng",
          "Ngày sinh bên nhận chuyển nhượng",
          "Ngày cấp giấy tờ bên nhận chuyển nhượng",
          "Nơi cấp giấy tờ bên nhận chuyển nhượng"
        ],
        "fieldGroups": [
          {
            "title": "Bên chuyển nhượng",
            "fields": [
              "Bên chuyển nhượng",
              "Ngày sinh bên chuyển nhượng",
              "Giấy tờ định danh bên chuyển nhượng",
              "Ngày cấp giấy tờ bên chuyển nhượng",
              "Nơi cấp giấy tờ bên chuyển nhượng",
              "Địa chỉ bên chuyển nhượng"
            ]
          },
          {
            "title": "Bên nhận chuyển nhượng",
            "fields": [
              "Bên nhận chuyển nhượng",
              "Ngày sinh bên nhận chuyển nhượng",
              "Giấy tờ định danh bên nhận chuyển nhượng",
              "Ngày cấp giấy tờ bên nhận chuyển nhượng",
              "Nơi cấp giấy tờ bên nhận chuyển nhượng",
              "Địa chỉ bên nhận chuyển nhượng"
            ]
          },
          {
            "title": "Thửa đất",
            "fields": [
              "Số thửa đất",
              "Số tờ bản đồ",
              "Địa chỉ thửa đất",
              "Diện tích đất",
              "Số giấy chứng nhận"
            ]
          },
          {
            "title": "Chuyển nhượng",
            "fields": [
              "Giá chuyển nhượng",
              "Phương thức thanh toán",
              "Ngày lập hợp đồng"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh bên chuyển nhượng": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng.",
          "Giấy tờ định danh bên nhận chuyển nhượng": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      }
    ]
  },
  {
    "code": "U16",
    "group": "UBND",
    "title": "Thu hồi đất, bồi thường và giải phóng mặt bằng",
    "owner": "ht",
    "ownerLabel": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentName": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Ban quản lý dự án, đơn vị thực hiện bồi thường, Phòng Kinh tế và cơ quan chuyên ngành.",
    "businessFields": "Dự án; hộ/tổ chức; thửa đất; diện tích thu hồi; loại tài sản; khoản bồi thường; quyết định; đợt chi trả.",
    "filingRule": "Theo dự án → đối tượng → đợt xử lý; bảng nhiều trang giữ cấu trúc hàng/cột, kiểm tra số tiền từng dòng.",
    "documentTypes": [
      {
        "id": "U16-D01",
        "name": "Thông báo thu hồi đất",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D02",
        "name": "Quyết định thu hồi đất",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D03",
        "name": "Biên bản kiểm đếm đất, tài sản",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D04",
        "name": "Bảng kê tài sản trên đất",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D05",
        "name": "Phương án bồi thường, hỗ trợ, tái định cư",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D06",
        "name": "Bảng tính tiền bồi thường",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D07",
        "name": "Thông báo niêm yết phương án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D08",
        "name": "Biên bản đối thoại",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D09",
        "name": "Quyết định phê duyệt phương án bồi thường",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D10",
        "name": "Chứng từ chi trả bồi thường",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U16-D11",
        "name": "Biên bản bàn giao mặt bằng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U17",
    "group": "UBND",
    "title": "Quy hoạch, xây dựng và trật tự xây dựng",
    "owner": "ht",
    "ownerLabel": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentName": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đơn vị chuyên ngành, chủ đầu tư, chủ công trình và đầu mối tiếp nhận.",
    "businessFields": "Địa chỉ công trình; chủ đầu tư; số phép; quy mô; thửa đất; vi phạm; thời hạn khắc phục.",
    "filingRule": "Theo công trình/vụ việc; tách bản vẽ và ảnh hiện trạng khỏi văn bản nhưng giữ liên kết.",
    "documentTypes": [
      {
        "id": "U17-D01",
        "name": "Phiếu cung cấp thông tin quy hoạch",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D02",
        "name": "Bản vẽ quy hoạch",
        "fields": [
          "Tên bản vẽ/ảnh",
          "Vị trí hoặc công trình",
          "Tỷ lệ nếu có",
          "Ngày lập/chụp",
          "Đơn vị lập",
          "Số tờ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bản vẽ/ảnh",
              "Vị trí hoặc công trình",
              "Tỷ lệ nếu có",
              "Ngày lập/chụp",
              "Đơn vị lập",
              "Số tờ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D03",
        "name": "Đơn đề nghị cấp giấy phép xây dựng",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D04",
        "name": "Bản vẽ thiết kế công trình",
        "fields": [
          "Tên bản vẽ/ảnh",
          "Vị trí hoặc công trình",
          "Tỷ lệ nếu có",
          "Ngày lập/chụp",
          "Đơn vị lập",
          "Số tờ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bản vẽ/ảnh",
              "Vị trí hoặc công trình",
              "Tỷ lệ nếu có",
              "Ngày lập/chụp",
              "Đơn vị lập",
              "Số tờ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D05",
        "name": "Giấy phép xây dựng bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D06",
        "name": "Biên bản kiểm tra công trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D07",
        "name": "Ảnh hiện trạng công trình",
        "fields": [
          "Tên bản vẽ/ảnh",
          "Vị trí hoặc công trình",
          "Tỷ lệ nếu có",
          "Ngày lập/chụp",
          "Đơn vị lập",
          "Số tờ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bản vẽ/ảnh",
              "Vị trí hoặc công trình",
              "Tỷ lệ nếu có",
              "Ngày lập/chụp",
              "Đơn vị lập",
              "Số tờ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D08",
        "name": "Biên bản vi phạm hành chính về xây dựng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D09",
        "name": "Quyết định xử phạt vi phạm xây dựng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D10",
        "name": "Thông báo yêu cầu khắc phục",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U17-D11",
        "name": "Biên bản kiểm tra an toàn công trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U18",
    "group": "UBND",
    "title": "Hạ tầng đô thị, giao thông và dịch vụ công ích",
    "owner": "ht",
    "ownerLabel": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentName": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Ban quản lý dự án, đơn vị vận hành, Phòng Kinh tế và tổ dân phố.",
    "businessFields": "Tuyến/vị trí; mã công trình; loại hạ tầng; khối lượng; đơn vị thực hiện; thời gian; nghiệm thu.",
    "filingRule": "Theo công trình, tuyến hoặc hợp đồng; ảnh, bản đồ và biên bản khối lượng là thành phần hồ sơ.",
    "documentTypes": [
      {
        "id": "U18-D01",
        "name": "Danh mục công trình hạ tầng",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D02",
        "name": "Biên bản kiểm tra đường, ngõ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D03",
        "name": "Biên bản kiểm tra chiếu sáng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D04",
        "name": "Biên bản kiểm tra thoát nước",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D05",
        "name": "Kế hoạch duy tu, sửa chữa",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D06",
        "name": "Hợp đồng dịch vụ công ích",
        "fields": [
          "Số hợp đồng",
          "Ngày ký",
          "Các bên ký kết",
          "Nội dung hợp đồng",
          "Giá trị",
          "Thời hạn thực hiện"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số hợp đồng",
              "Ngày ký",
              "Các bên ký kết",
              "Nội dung hợp đồng",
              "Giá trị",
              "Thời hạn thực hiện"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D07",
        "name": "Bảng xác nhận khối lượng hoàn thành",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D08",
        "name": "Biên bản nghiệm thu duy tu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D09",
        "name": "Giấy phép sử dụng hè đường bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D10",
        "name": "Phiếu phản ánh sự cố",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U18-D11",
        "name": "Biên bản khắc phục sự cố",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U19",
    "group": "UBND",
    "title": "Môi trường, nước và chất thải",
    "owner": "ht",
    "ownerLabel": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentName": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Cơ quan chuyên ngành, đơn vị dịch vụ và chủ cơ sở.",
    "businessFields": "Tên cơ sở; địa điểm; nguồn thải; chỉ tiêu đo; ngày kiểm tra; kết quả; thời hạn xử lý.",
    "filingRule": "Theo cơ sở/vụ việc; giữ đơn vị đo, phương pháp và đơn vị phát hành kết quả xét nghiệm/quan trắc.",
    "documentTypes": [
      {
        "id": "U19-D01",
        "name": "Bản đăng ký môi trường thuộc phạm vi lưu giữ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D02",
        "name": "Kế hoạch vệ sinh môi trường",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D03",
        "name": "Hợp đồng thu gom chất thải",
        "fields": [
          "Số hợp đồng",
          "Ngày ký",
          "Các bên ký kết",
          "Nội dung hợp đồng",
          "Giá trị",
          "Thời hạn thực hiện"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số hợp đồng",
              "Ngày ký",
              "Các bên ký kết",
              "Nội dung hợp đồng",
              "Giá trị",
              "Thời hạn thực hiện"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D04",
        "name": "Biên bản kiểm tra môi trường",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D05",
        "name": "Phiếu kết quả quan trắc",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D06",
        "name": "Đơn phản ánh ô nhiễm",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D07",
        "name": "Báo cáo xác minh ô nhiễm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D08",
        "name": "Quyết định xử phạt vi phạm môi trường",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D09",
        "name": "Báo cáo khắc phục vi phạm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U19-D10",
        "name": "Báo cáo quản lý nguồn nước",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U20",
    "group": "UBND",
    "title": "Nông nghiệp, thủy lợi và phòng chống thiên tai",
    "owner": "ht",
    "ownerLabel": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentName": "Phòng Hạ tầng - Nông nghiệp và Môi trường",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đơn vị chuyên ngành, ban chỉ huy liên quan, tổ dân phố; chỉ đưa vào danh mục khi có hồ sơ thực tế.",
    "businessFields": "Địa bàn; đợt/sự kiện; đối tượng; diện tích/số lượng; thiệt hại; mức hỗ trợ; thời gian.",
    "filingRule": "Theo vụ việc hoặc đợt thiên tai; tài liệu thống kê và quyết định hỗ trợ cần đối chiếu.",
    "documentTypes": [
      {
        "id": "U20-D01",
        "name": "Kế hoạch sản xuất nông nghiệp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D02",
        "name": "Báo cáo sản xuất nông nghiệp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D03",
        "name": "Biên bản kiểm tra dịch động vật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D04",
        "name": "Biên bản kiểm tra thủy lợi",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D05",
        "name": "Phương án ứng phó thiên tai",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D06",
        "name": "Báo cáo tình hình thiên tai",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D07",
        "name": "Biên bản xác nhận thiệt hại",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D08",
        "name": "Danh sách đề nghị hỗ trợ thiệt hại",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D09",
        "name": "Quyết định hỗ trợ khắc phục thiên tai",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U20-D10",
        "name": "Biên bản nghiệm thu khắc phục",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U21",
    "group": "UBND",
    "title": "Giáo dục và đào tạo",
    "owner": "vx",
    "ownerLabel": "Phòng Văn hóa - Xã hội",
    "departmentName": "Phòng Văn hóa - Xã hội",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Trường học, cơ quan giáo dục và các đầu mối liên quan; không mặc nhiên thu toàn bộ học bạ của trường.",
    "businessFields": "Năm học; trường/cơ sở; loại nhiệm vụ; đối tượng chính sách; số quyết định; kỳ hỗ trợ.",
    "filingRule": "Theo năm học, nhiệm vụ hoặc cơ sở; danh sách trẻ em/học sinh phân quyền riêng.",
    "documentTypes": [
      {
        "id": "U21-D01",
        "name": "Kế hoạch tuyển sinh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D02",
        "name": "Báo cáo năm học",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D03",
        "name": "Danh sách cơ sở giáo dục",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D04",
        "name": "Báo cáo phổ cập giáo dục",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D05",
        "name": "Biên bản kiểm tra cơ sở giáo dục",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D06",
        "name": "Biên bản kiểm tra an toàn trường học",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D07",
        "name": "Đơn đề nghị hỗ trợ học sinh",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D08",
        "name": "Danh sách học sinh đề nghị hỗ trợ",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D09",
        "name": "Quyết định hỗ trợ học sinh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U21-D10",
        "name": "Báo cáo thống kê giáo dục",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U22",
    "group": "UBND",
    "title": "Y tế, dân số và an toàn thực phẩm",
    "owner": "vx",
    "ownerLabel": "Phòng Văn hóa - Xã hội",
    "departmentName": "Phòng Văn hóa - Xã hội",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Trạm y tế, cơ quan chuyên ngành và đoàn kiểm tra; hồ sơ bệnh án không mặc nhiên thuộc kho UBND.",
    "businessFields": "Cơ sở; địa điểm; đợt kiểm tra/dịch; chỉ tiêu; kết quả; số quyết định; thời hạn.",
    "filingRule": "Theo đợt/cơ sở/vụ việc; giới hạn dữ liệu sức khỏe cá nhân theo nhu cầu và quyền được giao.",
    "documentTypes": [
      {
        "id": "U22-D01",
        "name": "Kế hoạch phòng chống dịch",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D02",
        "name": "Báo cáo dịch bệnh tổng hợp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D03",
        "name": "Báo cáo dân số",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D04",
        "name": "Danh sách cơ sở thực phẩm",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D05",
        "name": "Quyết định thành lập đoàn kiểm tra ATTP",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D06",
        "name": "Biên bản kiểm tra an toàn thực phẩm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D07",
        "name": "Phiếu kết quả kiểm nghiệm thực phẩm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D08",
        "name": "Quyết định xử phạt vi phạm ATTP",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D09",
        "name": "Báo cáo khắc phục vi phạm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U22-D10",
        "name": "Kế hoạch truyền thông sức khỏe",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U23",
    "group": "UBND",
    "title": "Văn hóa, thể thao, thông tin và di tích",
    "owner": "vx",
    "ownerLabel": "Phòng Văn hóa - Xã hội",
    "departmentName": "Phòng Văn hóa - Xã hội",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Tổ dân phố, đơn vị văn hóa, cơ quan chuyên ngành; xác nhận đầu mối với từng nhiệm vụ tín ngưỡng, tôn giáo nếu phát sinh.",
    "businessFields": "Tên hoạt động/cơ sở; địa điểm; thời gian; di tích/danh hiệu; quyết định; kết quả kiểm tra.",
    "filingRule": "Theo sự kiện, cơ sở hoặc năm xét danh hiệu; ảnh và phụ lục là thành phần đính kèm.",
    "documentTypes": [
      {
        "id": "U23-D01",
        "name": "Kế hoạch hoạt động văn hóa, thể thao",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D02",
        "name": "Kế hoạch tổ chức lễ hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D03",
        "name": "Báo cáo tổ chức sự kiện",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D04",
        "name": "Danh mục di tích",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D05",
        "name": "Biên bản kiểm kê di tích",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D06",
        "name": "Danh sách đề nghị danh hiệu văn hóa",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D07",
        "name": "Biên bản xét danh hiệu văn hóa",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D08",
        "name": "Quyết định công nhận danh hiệu văn hóa",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D09",
        "name": "Biên bản kiểm tra cơ sở dịch vụ văn hóa",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U23-D10",
        "name": "Báo cáo công tác thông tin, tuyên truyền",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U24",
    "group": "UBND",
    "title": "An sinh, bảo trợ xã hội, giảm nghèo và trẻ em",
    "owner": "vx",
    "ownerLabel": "Phòng Văn hóa - Xã hội",
    "departmentName": "Phòng Văn hóa - Xã hội",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đầu mối tiếp nhận, đơn vị chi trả, tổ dân phố và cơ quan liên quan; đối chiếu phân công sau tổ chức lại.",
    "businessFields": "Mã đối tượng; diện trợ giúp; thời điểm hưởng; mức; kỳ chi trả; quyết định; tình trạng hồ sơ.",
    "filingRule": "Theo đối tượng/đợt hỗ trợ; tách quyền truy cập dữ liệu trẻ em, khuyết tật và hoàn cảnh cá nhân.",
    "documentTypes": [
      {
        "id": "U24-D01",
        "name": "Tờ khai đề nghị trợ giúp xã hội",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D02",
        "name": "Biên bản họp xét trợ cấp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D03",
        "name": "Biên bản xác định mức độ khuyết tật",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D04",
        "name": "Quyết định trợ cấp xã hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D05",
        "name": "Quyết định điều chỉnh trợ cấp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D06",
        "name": "Danh sách chi trả trợ cấp",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D07",
        "name": "Giấy xác nhận đã nhận trợ cấp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D08",
        "name": "Quyết định dừng trợ cấp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D09",
        "name": "Phiếu rà soát hộ nghèo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D10",
        "name": "Danh sách hộ nghèo, cận nghèo",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D11",
        "name": "Đơn đề nghị hỗ trợ đột xuất",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U24-D12",
        "name": "Biên bản xác minh vụ việc trẻ em",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U25",
    "group": "UBND",
    "title": "Người có công, lao động và chính sách việc làm",
    "owner": "nv",
    "ownerLabel": "Phòng Nội vụ - Tư pháp",
    "departmentName": "Phòng Nội vụ - Tư pháp",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Đề xuất đầu mối Nội vụ - Tư pháp cho lĩnh vực nội vụ/lao động; phối hợp Văn hóa - Xã hội và đơn vị chuyên ngành, cần xác nhận phân công cụ thể.",
    "businessFields": "Loại chính sách; mã đối tượng; quyết định; kỳ hưởng; mức hỗ trợ; trạng thái chuyển xử lý.",
    "filingRule": "Theo đối tượng và chính sách; không mặc nhiên sao chép hồ sơ bảo hiểm do cơ quan BHXH quản lý.",
    "documentTypes": [
      {
        "id": "U25-D01",
        "name": "Đơn đề nghị chế độ người có công",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D02",
        "name": "Biên bản xác minh đối tượng chính sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D03",
        "name": "Quyết định trợ cấp người có công",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D04",
        "name": "Danh sách chi trả chế độ",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D05",
        "name": "Quyết định hỗ trợ mai táng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D06",
        "name": "Danh sách điều dưỡng người có công",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D07",
        "name": "Kế hoạch hỗ trợ việc làm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D08",
        "name": "Danh sách người được hỗ trợ đào tạo nghề",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D09",
        "name": "Báo cáo thị trường lao động",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U25-D10",
        "name": "Phiếu chuyển hồ sơ phối hợp BHXH",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U26",
    "group": "UBND",
    "title": "Khoa học, công nghệ, thông tin và chuyển đổi số",
    "owner": "vx",
    "ownerLabel": "Phòng Văn hóa - Xã hội",
    "departmentName": "Phòng Văn hóa - Xã hội",
    "departmentRole": "Phòng chuyên môn",
    "responsibility": "Văn phòng, đơn vị quản trị CNTT, Phòng Kinh tế và nhà cung cấp theo phân công.",
    "businessFields": "Hệ thống/dự án; phiên bản; đơn vị phụ trách; kỳ báo cáo; thời điểm sự cố; biên bản nghiệm thu.",
    "filingRule": "Theo hệ thống/dự án; không đưa mật khẩu, khóa bí mật hay thông tin xác thực vào chỉ mục OCR.",
    "documentTypes": [
      {
        "id": "U26-D01",
        "name": "Kế hoạch chuyển đổi số",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D02",
        "name": "Báo cáo chuyển đổi số",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D03",
        "name": "Danh mục hệ thống thông tin",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D04",
        "name": "Danh mục dữ liệu",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D05",
        "name": "Quyết định phân quyền hệ thống",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D06",
        "name": "Biên bản kiểm thử phần mềm",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D07",
        "name": "Biên bản nghiệm thu hệ thống",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D08",
        "name": "Biên bản đào tạo người dùng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D09",
        "name": "Phiếu tiếp nhận sự cố",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D10",
        "name": "Biên bản khắc phục sự cố",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U26-D11",
        "name": "Báo cáo kiểm tra an toàn thông tin",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "U27",
    "group": "UBND",
    "title": "Hồ sơ tiếp nhận và trả kết quả TTHC",
    "owner": "mc",
    "ownerLabel": "Điểm Phục vụ hành chính công / đơn vị giải quyết",
    "departmentName": "Điểm Phục vụ hành chính công / đơn vị giải quyết",
    "departmentRole": "Đầu mối liên thông, không gán là phòng chuyên môn",
    "responsibility": "Điểm Phục vụ hành chính công phối hợp phòng giải quyết; là luồng liên thông, không mặc định là một phòng thuộc UBND phường.",
    "businessFields": "Mã hồ sơ một cửa; mã TTHC; người nộp; ngày nhận/hẹn/trả; cơ quan xử lý; trạng thái; kết quả.",
    "filingRule": "Ưu tiên đối soát dữ liệu hệ thống một cửa; liên kết về hồ sơ hộ tịch, đất đai… tương ứng để tránh quét và lưu trùng.",
    "documentTypes": [
      {
        "id": "U27-D01",
        "name": "Đơn đề nghị giải quyết thủ tục hành chính",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D02",
        "name": "Tờ khai thủ tục hành chính",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D03",
        "name": "Phiếu tiếp nhận và hẹn trả kết quả",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D04",
        "name": "Phiếu chuyển xử lý hồ sơ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D05",
        "name": "Phiếu yêu cầu bổ sung hồ sơ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D06",
        "name": "Phiếu kiểm soát quá trình giải quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D07",
        "name": "Văn bản liên thông cơ quan xử lý",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D08",
        "name": "Kết quả giải quyết thủ tục hành chính bản lưu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D09",
        "name": "Phiếu xác nhận trả kết quả",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D10",
        "name": "Biên lai phí, lệ phí",
        "fields": [
          "Số chứng từ",
          "Ngày chứng từ",
          "Bên thu/chi",
          "Nội dung thanh toán",
          "Số tiền",
          "Đơn vị tiền tệ"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số chứng từ",
              "Ngày chứng từ",
              "Bên thu/chi",
              "Nội dung thanh toán",
              "Số tiền",
              "Đơn vị tiền tệ"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D11",
        "name": "Phiếu đánh giá chất lượng phục vụ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D12",
        "name": "Giấy khai đăng ký xe",
        "fields": [
          "Tên chủ xe",
          "Địa chỉ chủ xe",
          "Mã định danh chủ xe",
          "Người làm thủ tục",
          "Loại đăng ký",
          "Biển số cũ",
          "Biển số mới",
          "Nhãn hiệu",
          "Số loại",
          "Loại xe",
          "Màu sơn",
          "Số máy",
          "Số khung",
          "Giấy tờ kèm theo",
          "Ngày kê khai",
          "Ngày sinh chủ xe",
          "Ngày cấp giấy tờ chủ xe",
          "Nơi cấp giấy tờ chủ xe"
        ],
        "fieldGroups": [
          {
            "title": "Chủ xe",
            "fields": [
              "Tên chủ xe",
              "Ngày sinh chủ xe",
              "Địa chỉ chủ xe",
              "Mã định danh chủ xe",
              "Ngày cấp giấy tờ chủ xe",
              "Nơi cấp giấy tờ chủ xe",
              "Người làm thủ tục"
            ]
          },
          {
            "title": "Thông tin xe",
            "fields": [
              "Biển số cũ",
              "Biển số mới",
              "Nhãn hiệu",
              "Số loại",
              "Loại xe",
              "Màu sơn",
              "Số máy",
              "Số khung"
            ]
          },
          {
            "title": "Đăng ký",
            "fields": [
              "Loại đăng ký",
              "Giấy tờ kèm theo",
              "Ngày kê khai"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D13",
        "name": "Giấy khai thu hồi chứng nhận đăng ký xe, biển số xe",
        "fields": [
          "Tên chủ xe",
          "Địa chỉ chủ xe",
          "Mã định danh chủ xe",
          "Người làm thủ tục",
          "Biển số xe",
          "Lý do thu hồi",
          "Chủ xe mới",
          "Địa chỉ chủ xe mới",
          "Nhãn hiệu",
          "Số loại",
          "Loại xe",
          "Số máy",
          "Số khung",
          "Giấy tờ kèm theo",
          "Ngày kê khai",
          "Ngày sinh chủ xe",
          "Ngày cấp giấy tờ chủ xe",
          "Nơi cấp giấy tờ chủ xe",
          "Ngày sinh chủ xe mới"
        ],
        "fieldGroups": [
          {
            "title": "Chủ xe cũ",
            "fields": [
              "Tên chủ xe",
              "Ngày sinh chủ xe",
              "Địa chỉ chủ xe",
              "Mã định danh chủ xe",
              "Ngày cấp giấy tờ chủ xe",
              "Nơi cấp giấy tờ chủ xe",
              "Người làm thủ tục"
            ]
          },
          {
            "title": "Chủ xe mới",
            "fields": [
              "Chủ xe mới",
              "Ngày sinh chủ xe mới",
              "Địa chỉ chủ xe mới"
            ]
          },
          {
            "title": "Thông tin xe",
            "fields": [
              "Biển số xe",
              "Nhãn hiệu",
              "Số loại",
              "Loại xe",
              "Số máy",
              "Số khung"
            ]
          },
          {
            "title": "Thu hồi",
            "fields": [
              "Lý do thu hồi",
              "Giấy tờ kèm theo",
              "Ngày kê khai"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U27-D14",
        "name": "Hợp đồng mua bán xe",
        "fields": [
          "Bên bán xe",
          "Giấy tờ định danh bên bán",
          "Địa chỉ bên bán",
          "Bên mua xe",
          "Giấy tờ định danh bên mua",
          "Địa chỉ bên mua",
          "Biển số xe",
          "Nhãn hiệu",
          "Loại xe",
          "Số máy",
          "Số khung",
          "Số giấy đăng ký xe",
          "Giá mua bán",
          "Phương thức thanh toán",
          "Ngày lập hợp đồng",
          "Ngày sinh bên bán",
          "Ngày cấp giấy tờ bên bán",
          "Nơi cấp giấy tờ bên bán",
          "Ngày sinh bên mua",
          "Ngày cấp giấy tờ bên mua",
          "Nơi cấp giấy tờ bên mua",
          "Màu sơn"
        ],
        "fieldGroups": [
          {
            "title": "Bên bán",
            "fields": [
              "Bên bán xe",
              "Ngày sinh bên bán",
              "Giấy tờ định danh bên bán",
              "Ngày cấp giấy tờ bên bán",
              "Nơi cấp giấy tờ bên bán",
              "Địa chỉ bên bán"
            ]
          },
          {
            "title": "Bên mua",
            "fields": [
              "Bên mua xe",
              "Ngày sinh bên mua",
              "Giấy tờ định danh bên mua",
              "Ngày cấp giấy tờ bên mua",
              "Nơi cấp giấy tờ bên mua",
              "Địa chỉ bên mua"
            ]
          },
          {
            "title": "Thông tin xe",
            "fields": [
              "Biển số xe",
              "Nhãn hiệu",
              "Loại xe",
              "Màu sơn",
              "Số máy",
              "Số khung",
              "Số giấy đăng ký xe"
            ]
          },
          {
            "title": "Giao dịch",
            "fields": [
              "Giá mua bán",
              "Phương thức thanh toán",
              "Ngày lập hợp đồng"
            ]
          }
        ],
        "fieldHints": {
          "Giấy tờ định danh bên bán": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng.",
          "Giấy tờ định danh bên mua": "Chỉ ghi số giấy tờ; ngày cấp và nơi cấp có trường riêng."
        }
      }
    ]
  },
  {
    "code": "U28",
    "group": "UBND",
    "title": "Quốc phòng, an ninh và phòng cháy phối hợp UBND",
    "owner": "qp",
    "ownerLabel": "Ban Chỉ huy quân sự / Công an phối hợp UBND",
    "departmentName": "Ban Chỉ huy quân sự / Công an phối hợp UBND",
    "departmentRole": "Đơn vị phối hợp; chỉ tiếp nhận hồ sơ trong phạm vi được giao",
    "responsibility": "Ban Chỉ huy quân sự, Công an và đơn vị liên quan xác nhận phạm vi. Không coi các đơn vị này là phòng chuyên môn của UBND.",
    "businessFields": "Loại nhiệm vụ; đợt/năm; đơn vị hình thành; địa bàn; số văn bản; chế độ truy cập đã xác định.",
    "filingRule": "Chỉ tiếp nhận tài liệu được phép đưa vào dự án; hồ sơ nghiệp vụ chuyên ngành và tài liệu mật phải có phạm vi, môi trường riêng.",
    "documentTypes": [
      {
        "id": "U28-D01",
        "name": "Kế hoạch phối hợp quốc phòng, an ninh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D02",
        "name": "Báo cáo quốc phòng, an ninh thuộc UBND lưu giữ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D03",
        "name": "Kế hoạch tuyển quân",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D04",
        "name": "Danh sách phục vụ tuyển quân được phép bàn giao",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D05",
        "name": "Quyết định liên quan dân quân thuộc phạm vi giao",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D06",
        "name": "Kế hoạch phòng cháy, cứu nạn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D07",
        "name": "Biên bản kiểm tra phòng cháy được phép bàn giao",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "U28-D08",
        "name": "Báo cáo tình huống phối hợp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H01",
    "group": "HĐND",
    "title": "Tổ chức kỳ họp HĐND",
    "owner": "tt",
    "ownerLabel": "Thường trực HĐND",
    "departmentName": "Thường trực HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "responsibility": "Văn phòng HĐND và UBND phục vụ; các Ban thẩm tra; cơ quan trình chịu trách nhiệm tài liệu của mình.",
    "businessFields": "Khóa; nhiệm kỳ; số/kỳ họp; ngày; nội dung; cơ quan trình; số tờ trình; nghị quyết liên quan.",
    "filingRule": "Một kỳ họp có nhiều nội dung; gom theo kỳ họp → nội dung → từng tài liệu, không gộp mọi trang thành một văn bản.",
    "documentTypes": [
      {
        "id": "H01-D01",
        "name": "Kế hoạch tổ chức kỳ họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D02",
        "name": "Thông báo triệu tập kỳ họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D03",
        "name": "Giấy mời kỳ họp HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D04",
        "name": "Chương trình kỳ họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D05",
        "name": "Danh sách đại biểu tham dự",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D06",
        "name": "Tờ trình của UBND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D07",
        "name": "Báo cáo thẩm tra của Ban HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D08",
        "name": "Biên bản kỳ họp",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D09",
        "name": "Biên bản thảo luận",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D10",
        "name": "Biên bản kết quả biểu quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D11",
        "name": "Nghị quyết được thông qua",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H01-D12",
        "name": "Phụ lục nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H02",
    "group": "HĐND",
    "title": "Ban hành và theo dõi nghị quyết",
    "owner": "tt",
    "ownerLabel": "Thường trực HĐND",
    "departmentName": "Thường trực HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "responsibility": "Ban thẩm tra theo lĩnh vực; UBND và đơn vị được giao thực hiện; Văn phòng lưu hồ sơ phục vụ.",
    "businessFields": "Số, ký hiệu; ngày; trích yếu; khóa/kỳ họp; người ký; ngày hiệu lực nếu nêu; văn bản bị sửa/thay thế.",
    "filingRule": "Theo nghị quyết và chuỗi dự thảo → thẩm tra → thông qua → thực hiện; cơ quan ban hành HĐND tách với cơ quan trình UBND.",
    "documentTypes": [
      {
        "id": "H02-D01",
        "name": "Tờ trình đề nghị ban hành nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D02",
        "name": "Dự thảo nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D03",
        "name": "Công văn góp ý dự thảo nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D04",
        "name": "Báo cáo tiếp thu, giải trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D05",
        "name": "Báo cáo thẩm tra nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D06",
        "name": "Biên bản biểu quyết thông qua nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D07",
        "name": "Nghị quyết HĐND bản chính",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D08",
        "name": "Phụ lục nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D09",
        "name": "Công văn gửi nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D10",
        "name": "Báo cáo thực hiện nghị quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H02-D11",
        "name": "Nghị quyết sửa đổi, thay thế hoặc bãi bỏ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H03",
    "group": "HĐND",
    "title": "Thẩm tra kinh tế, ngân sách và đầu tư",
    "owner": "bkt",
    "ownerLabel": "Ban Kinh tế - Ngân sách HĐND",
    "departmentName": "Ban Kinh tế - Ngân sách HĐND",
    "departmentRole": "Ban của HĐND, khác Phòng Kinh tế thuộc UBND",
    "responsibility": "Phòng Kinh tế, phòng phụ trách hạ tầng, UBND và đơn vị trình; Ban HĐND là đầu mối thẩm tra.",
    "businessFields": "Kỳ họp; loại báo cáo; năm/kỳ ngân sách; dự án; chỉ tiêu; số tiền; kết luận/kiến nghị.",
    "filingRule": "Theo từng nội dung thẩm tra; Ban Kinh tế - Ngân sách và Phòng Kinh tế là hai chủ thể khác nhau.",
    "documentTypes": [
      {
        "id": "H03-D01",
        "name": "Tờ trình về dự toán, phân bổ ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D02",
        "name": "Dự thảo nghị quyết kinh tế - ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D03",
        "name": "Báo cáo thu, chi ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D04",
        "name": "Báo cáo quyết toán ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D05",
        "name": "Kế hoạch đầu tư công trình HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D06",
        "name": "Báo cáo giải ngân dự án",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D07",
        "name": "Phiếu yêu cầu cung cấp thông tin thẩm tra",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D08",
        "name": "Biên bản họp Ban Kinh tế - Ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D09",
        "name": "Báo cáo thẩm tra kinh tế - ngân sách",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H03-D10",
        "name": "Báo cáo giải trình của cơ quan trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H04",
    "group": "HĐND",
    "title": "Thẩm tra văn hóa, xã hội và lĩnh vực được giao",
    "owner": "bvx",
    "ownerLabel": "Ban Văn hóa - Xã hội HĐND",
    "departmentName": "Ban Văn hóa - Xã hội HĐND",
    "departmentRole": "Ban của HĐND, khác Phòng Văn hóa - Xã hội thuộc UBND",
    "responsibility": "Phòng Văn hóa - Xã hội, Nội vụ - Tư pháp và đơn vị trình tùy lĩnh vực.",
    "businessFields": "Kỳ họp; lĩnh vực; đối tượng chính sách; chỉ tiêu; nội dung thẩm tra; kiến nghị; đơn vị trả lời.",
    "filingRule": "Theo nội dung được giao thẩm tra; phân biệt Ban Văn hóa - Xã hội HĐND với phòng cùng lĩnh vực của UBND.",
    "documentTypes": [
      {
        "id": "H04-D01",
        "name": "Tờ trình chính sách văn hóa - xã hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D02",
        "name": "Dự thảo nghị quyết văn hóa - xã hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D03",
        "name": "Báo cáo chuyên đề giáo dục, y tế hoặc an sinh",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D04",
        "name": "Kế hoạch khảo sát phục vụ thẩm tra",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D05",
        "name": "Biên bản khảo sát của Ban",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D06",
        "name": "Biên bản họp Ban Văn hóa - Xã hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D07",
        "name": "Báo cáo thẩm tra văn hóa - xã hội",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H04-D08",
        "name": "Báo cáo tiếp thu kiến nghị thẩm tra",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H05",
    "group": "HĐND",
    "title": "Giám sát, khảo sát và theo dõi kiến nghị",
    "owner": "tt",
    "ownerLabel": "Thường trực HĐND",
    "departmentName": "Thường trực HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "responsibility": "Chủ thể thực tế có thể là Thường trực hoặc một Ban HĐND theo quyết định đoàn; Văn phòng hỗ trợ.",
    "businessFields": "Tên/đợt giám sát; chủ thể; đơn vị chịu giám sát; thời gian; kiến nghị; hạn; kết quả.",
    "filingRule": "Theo đợt/chuyên đề; giữ danh sách kiến nghị và liên kết từng văn bản trả lời, không chỉ lưu báo cáo tổng kết.",
    "documentTypes": [
      {
        "id": "H05-D01",
        "name": "Chương trình giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D02",
        "name": "Kế hoạch giám sát chuyên đề",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D03",
        "name": "Quyết định thành lập đoàn giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D04",
        "name": "Đề cương yêu cầu báo cáo",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D05",
        "name": "Báo cáo của đơn vị chịu giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D06",
        "name": "Biên bản làm việc đoàn giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D07",
        "name": "Báo cáo kết quả giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D08",
        "name": "Thông báo kết luận giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D09",
        "name": "Công văn đôn đốc thực hiện kiến nghị",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H05-D10",
        "name": "Báo cáo thực hiện kiến nghị giám sát",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H06",
    "group": "HĐND",
    "title": "Chất vấn, giải trình và trả lời",
    "owner": "tt",
    "ownerLabel": "Thường trực HĐND",
    "departmentName": "Thường trực HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "responsibility": "Đại biểu/Tổ đại biểu đề nghị; UBND và phòng, đơn vị trả lời theo nội dung.",
    "businessFields": "Người/đơn vị chất vấn; nội dung; người trả lời; ngày; cam kết; hạn; trạng thái theo dõi.",
    "filingRule": "Theo phiên và từng vấn đề; văn bản trả lời phải gắn đúng câu hỏi, giữ cơ quan phát hành gốc.",
    "documentTypes": [
      {
        "id": "H06-D01",
        "name": "Phiếu chất vấn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D02",
        "name": "Văn bản đề nghị giải trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D03",
        "name": "Chương trình phiên chất vấn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D04",
        "name": "Báo cáo trả lời chất vấn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D05",
        "name": "Biên bản phiên chất vấn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D06",
        "name": "Thông báo kết luận phiên giải trình",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D07",
        "name": "Bản cam kết thực hiện sau chất vấn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H06-D08",
        "name": "Báo cáo kết quả thực hiện cam kết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H07",
    "group": "HĐND",
    "title": "Tiếp xúc cử tri và kiến nghị cử tri",
    "owner": "db",
    "ownerLabel": "Tổ đại biểu / đại biểu HĐND",
    "departmentName": "Tổ đại biểu / đại biểu HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng hỗ trợ",
    "responsibility": "Thường trực HĐND, MTTQ phối hợp tổ chức; cơ quan được chuyển xử lý trả lời.",
    "businessFields": "Đợt trước/sau kỳ họp; tổ đại biểu; địa bàn; mã kiến nghị; nội dung; nơi xử lý; hạn; kết quả.",
    "filingRule": "Theo đợt và từng kiến nghị; một văn bản trả lời nhiều kiến nghị cần liên kết nhiều mục.",
    "documentTypes": [
      {
        "id": "H07-D01",
        "name": "Kế hoạch tiếp xúc cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D02",
        "name": "Giấy mời hội nghị tiếp xúc cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D03",
        "name": "Chương trình tiếp xúc cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D04",
        "name": "Biên bản hội nghị tiếp xúc cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D05",
        "name": "Phiếu ghi ý kiến cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D06",
        "name": "Báo cáo tổng hợp kiến nghị cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D07",
        "name": "Công văn chuyển kiến nghị cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D08",
        "name": "Văn bản trả lời kiến nghị cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D09",
        "name": "Bảng theo dõi giải quyết kiến nghị",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H07-D10",
        "name": "Thông báo kết quả tới cử tri",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H08",
    "group": "HĐND",
    "title": "Tiếp công dân và đơn thư gửi HĐND",
    "owner": "tt",
    "ownerLabel": "Thường trực HĐND",
    "departmentName": "Thường trực HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "responsibility": "Đại biểu, Văn phòng và cơ quan có trách nhiệm giải quyết; HĐND theo dõi/giám sát theo nhiệm vụ.",
    "businessFields": "Mã đơn/vụ việc; người gửi; ngày nhận; nơi chuyển; số văn bản trả lời; tình trạng.",
    "filingRule": "Giữ hồ sơ tiếp nhận tại HĐND và liên kết hồ sơ xử lý của UBND; không gộp hai chủ thể thành một.",
    "documentTypes": [
      {
        "id": "H08-D01",
        "name": "Lịch tiếp công dân của HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D02",
        "name": "Sổ tiếp công dân của HĐND",
        "fields": [
          "Tên sổ",
          "Năm/quyển sổ",
          "Số thứ tự đăng ký",
          "Ngày đăng ký",
          "Đối tượng hoặc trích yếu",
          "Số trang"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên sổ",
              "Năm/quyển sổ",
              "Số thứ tự đăng ký",
              "Ngày đăng ký",
              "Đối tượng hoặc trích yếu",
              "Số trang"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D03",
        "name": "Biên bản tiếp công dân của đại biểu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D04",
        "name": "Đơn gửi HĐND",
        "fields": [
          "Loại yêu cầu",
          "Người đề nghị",
          "Ngày lập",
          "Nội dung đề nghị",
          "Giấy tờ kèm theo",
          "Người tiếp nhận"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Loại yêu cầu",
              "Người đề nghị",
              "Ngày lập",
              "Nội dung đề nghị",
              "Giấy tờ kèm theo",
              "Người tiếp nhận"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D05",
        "name": "Phiếu chuyển đơn tới cơ quan giải quyết",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D06",
        "name": "Công văn đôn đốc giải quyết đơn",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D07",
        "name": "Báo cáo của cơ quan xử lý",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H08-D08",
        "name": "Thông báo phản hồi người gửi",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H09",
    "group": "HĐND",
    "title": "Đại biểu, Tổ đại biểu và công tác nhân sự HĐND",
    "owner": "db",
    "ownerLabel": "Tổ đại biểu / đại biểu HĐND",
    "departmentName": "Tổ đại biểu / đại biểu HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng hỗ trợ",
    "responsibility": "Thường trực HĐND, Văn phòng; Nội vụ - Tư pháp phối hợp hồ sơ tổ chức, bầu cử theo phân công.",
    "businessFields": "Khóa; nhiệm kỳ; đại biểu; Tổ/Ban; chức danh; quyết định; thời gian hiệu lực.",
    "filingRule": "Theo nhiệm kỳ và đại biểu/Tổ; tách hồ sơ hoạt động HĐND khỏi bộ hồ sơ tổ chức bầu cử.",
    "documentTypes": [
      {
        "id": "H09-D01",
        "name": "Danh sách đại biểu HĐND",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D02",
        "name": "Văn bản xác nhận tư cách đại biểu thuộc hồ sơ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D03",
        "name": "Nghị quyết phê chuẩn chức danh HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D04",
        "name": "Nghị quyết thành lập Tổ đại biểu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D05",
        "name": "Bảng phân công Tổ đại biểu",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D06",
        "name": "Biên bản sinh hoạt Tổ đại biểu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D07",
        "name": "Báo cáo hoạt động Tổ đại biểu",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D08",
        "name": "Quyết định cử đại biểu đi bồi dưỡng",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H09-D09",
        "name": "Danh sách chi chế độ đại biểu",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  },
  {
    "code": "H10",
    "group": "HĐND",
    "title": "Chương trình công tác, phối hợp và tổng kết nhiệm kỳ",
    "owner": "tt",
    "ownerLabel": "Thường trực HĐND",
    "departmentName": "Thường trực HĐND",
    "departmentRole": "Chủ thể hoạt động HĐND; Văn phòng phục vụ lưu hồ sơ",
    "responsibility": "Các Ban, Tổ đại biểu, Văn phòng và cơ quan phối hợp.",
    "businessFields": "Khóa/nhiệm kỳ; kỳ báo cáo; chương trình; chủ thể; cơ quan phối hợp; ngày bàn giao.",
    "filingRule": "Theo năm/nhiệm kỳ và nhiệm vụ; lưu cả phụ lục thống kê, danh mục hồ sơ bàn giao.",
    "documentTypes": [
      {
        "id": "H10-D01",
        "name": "Quy chế hoạt động HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D02",
        "name": "Bảng phân công Thường trực, các Ban",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D03",
        "name": "Chương trình công tác HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D04",
        "name": "Lịch họp Thường trực HĐND",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D05",
        "name": "Quy chế phối hợp HĐND - UBND - MTTQ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D06",
        "name": "Biên bản giao ban",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D07",
        "name": "Báo cáo hoạt động HĐND định kỳ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D08",
        "name": "Báo cáo tổng kết nhiệm kỳ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày ban hành/lập",
          "Cơ quan ban hành/lập",
          "Trích yếu hoặc nội dung chính",
          "Người ký",
          "Tài liệu liên quan"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày ban hành/lập",
              "Cơ quan ban hành/lập",
              "Trích yếu hoặc nội dung chính",
              "Người ký",
              "Tài liệu liên quan"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D09",
        "name": "Biên bản bàn giao nhiệm kỳ",
        "fields": [
          "Số/ký hiệu nếu có",
          "Ngày, giờ lập",
          "Địa điểm",
          "Thành phần tham gia",
          "Nội dung, kết quả",
          "Người ký"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Số/ký hiệu nếu có",
              "Ngày, giờ lập",
              "Địa điểm",
              "Thành phần tham gia",
              "Nội dung, kết quả",
              "Người ký"
            ]
          }
        ],
        "fieldHints": {}
      },
      {
        "id": "H10-D10",
        "name": "Mục lục hồ sơ bàn giao",
        "fields": [
          "Tên bảng/danh sách",
          "Kỳ lập",
          "Số thứ tự dòng",
          "Đối tượng hoặc mã mục",
          "Giá trị từng cột",
          "Đơn vị lập"
        ],
        "fieldGroups": [
          {
            "title": "Thông tin giấy tờ",
            "fields": [
              "Tên bảng/danh sách",
              "Kỳ lập",
              "Số thứ tự dòng",
              "Đối tượng hoặc mã mục",
              "Giá trị từng cột",
              "Đơn vị lập"
            ]
          }
        ],
        "fieldHints": {}
      }
    ]
  }
];
