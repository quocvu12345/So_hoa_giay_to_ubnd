using HoSoSo.Application.Admin;

namespace HoSoSo.Application.Tests;

/// <summary>BE-100: so mô hình worker thật sự chạy (ocr_jobs.model_version) với dòng classifier của ai_models.</summary>
public sealed class ModelMismatchTests
{
    private static readonly ModelInfo IfStruct = new("classifier", "ChetanDhembreAI/Qwen3-4B-Instruct-2507-ifstruct",
        "00161de525486e01ba505e6c24f39472fdfe4a23", "Gợi ý nhóm, loại giấy tờ và trích trường", true);

    private static string? Detect(string modelVersion, ModelInfo recorded) =>
        AdminOpsHandler.DetectModelMismatch([new RunningModel(modelVersion, 1, DateTimeOffset.UtcNow)], [recorded]);

    [Fact]
    public void Ban_tu_chuyen_4bit_khop_voi_repo_nguon_cung_commit()
    {
        Detect("ocr=PaddleOCR-VL-1.6@132c45f classifier=Qwen3-4B-Instruct-2507-ifstruct-4bit@00161de/short", IfStruct).ShouldBeNull();
    }

    [Fact]
    public void Ten_hoac_commit_khac_thi_bao_lech()
    {
        Detect("classifier=Qwen3-1.7B-4bit@3b1b176/production", IfStruct).ShouldNotBeNull().ShouldContain("Qwen3-4B-Instruct-2507-ifstruct@00161de");
        Detect("classifier=Qwen3-4B-Instruct-2507-ifstruct-4bit@1234567/short", IfStruct).ShouldNotBeNull();
        Detect("classifier=Qwen3-4B-Instruct-2507-ifstruct-extra@00161de/short", IfStruct).ShouldNotBeNull("chỉ bỏ hậu tố lượng tử hóa, không bỏ phần tên khác");
    }

    [Fact]
    public void Repo_mlx_community_van_so_dung_ten_thu_muc()
    {
        var mlx = IfStruct with { Repo = "mlx-community/Qwen3-1.7B-4bit", Revision = "3b1b1768f8f8cf8351c712464f906e86c2b8269e" };
        Detect("classifier=Qwen3-1.7B-4bit@3b1b176/short", mlx).ShouldBeNull();
    }
}
