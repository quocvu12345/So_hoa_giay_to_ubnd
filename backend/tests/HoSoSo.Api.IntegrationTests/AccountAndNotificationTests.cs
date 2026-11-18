using System.Net;
using HoSoSo.Api.IntegrationTests.Support;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-123 (lịch sử đăng nhập của chính mình, FE-42) và BE-124 (phân trang thông báo, FE-40).</summary>
public sealed class AccountAndNotificationTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record LoginEvent(DateTimeOffset At, string? ClientIp);
    private sealed record Item(Guid Id, string Title, DateTimeOffset CreatedAt, bool Read);
    private sealed record NotificationPage(List<Item> Items, int Unread, string? NextCursor);

    [Fact]
    public async Task Lich_su_dang_nhap_chi_cua_chinh_minh_moi_nhat_truoc()
    {
        await api.LoginAsync("demo_head_kt");
        await api.LoginAsync("demo_head_kt");
        var other = await api.LoginAsync("demo_cv_ht");
        var me = await api.LoginAsync("demo_head_kt");
        var mine = await api.UserIdAsync("demo_head_kt");
        var expected = await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE user_id = $1 AND action = 'login'", mine);

        var logins = await (await me.GetAsync("/api/v1/me/logins?limit=100")).ReadAsync<List<LoginEvent>>();
        logins.Count.ShouldBe((int)expected);
        logins.Count.ShouldBeGreaterThanOrEqualTo(3);
        logins.Select(l => l.At).ShouldBeInOrder(SortDirection.Descending);
        logins[0].At.ShouldBe(DateTimeOffset.UtcNow, TimeSpan.FromMinutes(1));
        (await (await me.GetAsync("/api/v1/me/logins?limit=2")).ReadAsync<List<LoginEvent>>()).Count.ShouldBe(2);
        // Người khác chỉ thấy của họ.
        var theirs = await (await other.GetAsync("/api/v1/me/logins?limit=100")).ReadAsync<List<LoginEvent>>();
        theirs.Count.ShouldBe((int)await api.ScalarAsync<long>("SELECT count(*) FROM hoso.access_events WHERE user_id = $1 AND action = 'login'", await api.UserIdAsync("demo_cv_ht")));
    }

    [Fact]
    public async Task Thong_bao_phan_trang_bang_con_tro_khong_sot_khong_trung()
    {
        var http = await api.LoginAsync("demo_clerk_ubnd");
        var user = await api.UserIdAsync("demo_clerk_ubnd");
        // 5 thông báo, hai cái cùng thời điểm để thử khóa phụ là id; một cái đã đọc.
        await api.ExecuteAsync("""
            INSERT INTO hoso.notifications(user_id, kind, title, created_at, read_at) VALUES
              ($1, 'test', 'TB-1', now() - interval '5 minutes', NULL),
              ($1, 'test', 'TB-2', now() - interval '4 minutes', now()),
              ($1, 'test', 'TB-3', now() - interval '3 minutes', NULL),
              ($1, 'test', 'TB-4', '2026-11-18 01:00:00+00', NULL),
              ($1, 'test', 'TB-5', '2026-11-18 01:00:00+00', NULL)
            """, user);
        var expected = await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications WHERE user_id = $1", user);

        var seen = new List<Item>();
        string? cursor = null;
        var pages = 0;
        do
        {
            var page = await (await http.GetAsync($"/api/v1/notifications?limit=2{(cursor is null ? "" : $"&cursor={cursor}")}")).ReadAsync<NotificationPage>();
            page.Items.Count.ShouldBeLessThanOrEqualTo(2);
            seen.AddRange(page.Items);
            cursor = page.NextCursor;
            pages++;
        } while (cursor is not null && pages < 50);
        seen.Count.ShouldBe((int)expected);
        seen.Select(i => i.Id).ShouldBeUnique();
        seen.Select(i => i.CreatedAt).ShouldBeInOrder(SortDirection.Descending);

        // Chỉ chưa đọc: con trỏ vẫn đi đúng trong tập đã lọc.
        var unread = await (await http.GetAsync("/api/v1/notifications?unread=true&limit=100")).ReadAsync<NotificationPage>();
        unread.Items.ShouldAllBe(i => !i.Read);
        unread.Items.Count.ShouldBe(unread.Unread);
        unread.NextCursor.ShouldBeNull();
        (await http.GetAsync("/api/v1/notifications?cursor=khong_hop_le")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}
