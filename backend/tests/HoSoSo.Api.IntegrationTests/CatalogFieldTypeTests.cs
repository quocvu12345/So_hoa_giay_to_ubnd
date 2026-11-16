using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>DB-09: kiểu của trường danh mục nằm trong dữ liệu (migration 028), không phải đoán theo nhãn trong code.</summary>
public sealed class CatalogFieldTypeTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    [Fact]
    public async Task Moi_truong_co_nhan_bat_dau_bang_Ngay_la_kieu_date_va_khong_truong_nao_khac_bi_doi()
    {
        api.RequireDatabase();
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.field_definitions")).ShouldBe(2624, "danh mục chuẩn có 2.624 trường");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.field_definitions WHERE label LIKE 'Ngày%' AND value_type <> 'date'")).ShouldBe(0);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.field_definitions WHERE label NOT LIKE 'Ngày%' AND value_type <> 'text'")).ShouldBe(0,
            "chỉ các trường ngày được gán kiểu; không ép kiểu số cho 'Số ...' vì đó là số hiệu dạng chữ");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.field_definitions WHERE value_type = 'date'")).ShouldBeGreaterThan(300);
        // Cả trường ngày có kèm giờ cũng là date (giờ nằm lại ở chuỗi gốc).
        (await api.ScalarAsync<string>("SELECT value_type FROM hoso.field_definitions WHERE code = 'U15-D07-F02'")).ShouldBe("date");
    }
}
