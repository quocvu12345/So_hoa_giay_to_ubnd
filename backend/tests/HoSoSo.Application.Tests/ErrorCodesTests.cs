using HoSoSo.Application.Common;

namespace HoSoSo.Application.Tests;

public sealed class ErrorCodesTests
{
    [Fact]
    public void Loi_khong_tim_thay_khong_tiet_lo_ho_so_co_ton_tai()
    {
        var error = AppException.NotFound("hồ sơ");
        error.Status.ShouldBe(404);
        error.Message.ShouldContain("không thuộc phạm vi");
    }
}
