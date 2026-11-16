using HoSoSo.Application.Documents;

namespace HoSoSo.Application.Tests;

/// <summary>DB-09: trường ngày được chuẩn hóa sang ISO; chuỗi gốc không bị đụng tới, giờ đi kèm không làm hỏng việc đọc ngày.</summary>
public sealed class DateNormalizationTests
{
    [Theory]
    [InlineData("20/01/2026", "2026-01-20")]
    [InlineData("  5/3/2025  ", "2025-03-05")]
    [InlineData("20/01/2026 14:30", "2026-01-20")]
    [InlineData("20/01/2026, 14h30", "2026-01-20")]
    [InlineData("20/01/2026 lúc 8:05", "2026-01-20")]
    [InlineData("29/02/2024", "2024-02-29")]           // năm nhuận
    public void Doc_duoc_ngay_ke_ca_khi_kem_gio(string input, string expected) =>
        ReviewHandler.Normalize(input, isDate: true).ShouldBe(expected);

    [Theory]
    [InlineData("31/02/2026")]          // ngày không có thật
    [InlineData("29/02/2025")]
    [InlineData("32/01/2026")]
    [InlineData("20-01-2026")]          // sai dạng: không đoán
    [InlineData("2026-01-20")]
    [InlineData("20/01/26")]
    [InlineData("ngày 20 tháng 01 năm 2026")]
    [InlineData("20/01/2026 25:99 rác")]
    [InlineData("")]
    [InlineData("   ")]
    public void Khong_doan_khi_sai_dang_hoac_ngay_khong_co_that(string input) =>
        ReviewHandler.Normalize(input, isDate: true).ShouldBeNull();

    [Fact]
    public void Truong_khong_phai_ngay_thi_khong_chuan_hoa() =>
        ReviewHandler.Normalize("20/01/2026", isDate: false).ShouldBeNull();
}
