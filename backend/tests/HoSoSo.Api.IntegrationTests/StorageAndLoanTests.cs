using System.Net;
using System.Xml.Linq;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Infrastructure.Messaging;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using UglyToad.PdfPig;

namespace HoSoSo.Api.IntegrationTests;

/// <summary>BE-81 kho và mã QR, BE-82 vị trí hồ sơ, BE-83 mượn trả.</summary>
public sealed class StorageAndLoanTests(DbApiFactory api) : IClassFixture<DbApiFactory>
{
    private sealed record Node(Guid Id, Guid? ParentId, string Kind, string Code, string Name, string Path, int Depth, bool Active, string QrPayload, int DossierCount);
    private sealed record Placed(Guid DossierId, Guid? LocationId, string? Path);
    private sealed record LoanItem(Guid Id, Guid DossierId, string DossierCode, Guid BorrowerId, string BorrowerName, string Purpose, string Status, DateOnly? DueOn, string ConditionNote, string DecisionNote, bool Overdue);
    private sealed record NotificationItem(string Kind, string Title, Guid? DossierId);
    private sealed record Notifications(List<NotificationItem> Items);

    private static readonly string Tag = Guid.NewGuid().ToString("N")[..6].ToUpperInvariant();

    private async Task<Node> AddAsync(HttpClient http, Guid? parent, string kind, string code, string name)
    {
        var response = await http.PostJsonAsync("/api/v1/storage-locations", new { parentId = parent, kind, code = $"{code}-{Tag}", name });
        return await response.ReadAsync<Node>();
    }

    /// <summary>Kho › phòng › tủ › kệ › hộp; trả về mọi cấp.</summary>
    private async Task<List<Node>> BuildChainAsync(HttpClient clerk, string prefix)
    {
        var warehouse = await AddAsync(clerk, null, "warehouse", $"{prefix}KHO", $"Kho {prefix}");
        var room = await AddAsync(clerk, warehouse.Id, "room", $"{prefix}P1", "Phòng 1");
        var cabinet = await AddAsync(clerk, room.Id, "cabinet", $"{prefix}T1", "Tủ 1");
        var shelf = await AddAsync(clerk, cabinet.Id, "shelf", $"{prefix}K1", "Kệ 1");
        var box = await AddAsync(clerk, shelf.Id, "box", $"{prefix}H1", "Hộp 1");
        return [warehouse, room, cabinet, shelf, box];
    }

    private async Task<DossierDetailDto> NewDossierAsync(HttpClient http, string title) =>
        await (await http.PostJsonAsync("/api/v1/dossiers", new { title, workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();

    [Fact]
    public async Task Cay_kho_dung_theo_cap_dung_duong_dan_va_chan_sai_cap_trung_ma_va_nguoi_khong_co_quyen()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chain = await BuildChainAsync(clerk, "A");
        chain[4].QrPayload.ShouldBe($"HOSO-LOC:AH1-{Tag}");

        var tree = await (await clerk.GetAsync("/api/v1/storage-locations")).ReadAsync<List<Node>>();
        var mine = tree.Where(n => n.Code.EndsWith(Tag)).ToList();
        mine.Select(n => n.Code).ShouldBe(chain.Select(n => n.Code).ToList(), "cha trước con");
        mine[4].Path.ShouldBe("Kho A › Phòng 1 › Tủ 1 › Kệ 1 › Hộp 1");
        mine[4].Depth.ShouldBe(5);

        // Hộp không chứa được kệ; mã trùng bị từ chối; kho không có cha; cha không tồn tại.
        (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = chain[4].Id, kind = "shelf", code = $"BAD1-{Tag}", name = "Sai cấp" })).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = chain[0].Id, kind = "room", code = chain[1].Code, name = "Trùng mã" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await clerk.PostJsonAsync("/api/v1/storage-locations", new { parentId = Guid.NewGuid(), kind = "room", code = $"BAD2-{Tag}", name = "Cha ma" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var invalid = await clerk.PostJsonAsync("/api/v1/storage-locations", new { kind = "sân", code = "a b", name = "" });
        invalid.StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await invalid.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("Nhập tên vị trí");

        // Chuyên viên không có quyền quản lý kho; văn thư cơ quan khác không thấy kho của cơ quan này.
        var employee = await api.LoginAsync("demo_cv_ht");
        (await employee.GetAsync("/api/v1/storage-locations")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        var other = await api.LoginAsync("demo_clerk_hdnd");
        (await (await other.GetAsync("/api/v1/storage-locations")).ReadAsync<List<Node>>()).ShouldNotContain(n => n.Code.EndsWith(Tag));
        (await other.GetAsync($"/api/v1/storage-locations/{chain[0].Id}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await other.PatchJsonAsync($"/api/v1/storage-locations/{chain[0].Id}", new { name = "Chiếm quyền" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Ma_qr_la_svg_hop_le_quet_ra_dung_vi_tri_va_nhan_in_ra_pdf_co_chu_tieng_viet()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chain = await BuildChainAsync(clerk, "Q");

        var svg = await clerk.GetAsync($"/api/v1/storage-locations/{chain[4].Id}/qr");
        svg.StatusCode.ShouldBe(HttpStatusCode.OK);
        svg.Content.Headers.ContentType!.MediaType.ShouldBe("image/svg+xml");
        var xml = XDocument.Parse(await svg.Content.ReadAsStringAsync(TestContext.Current.CancellationToken));
        xml.Root!.Name.LocalName.ShouldBe("svg");
        // QRCoder gộp các ô đen vào một đường vẽ (path) nên đếm độ dài đường vẽ thay vì đếm phần tử.
        xml.Descendants().Where(e => e.Name.LocalName == "path").Sum(e => ((string?)e.Attribute("d"))?.Length ?? 0).ShouldBeGreaterThan(500, "có các ô mã QR");
        xml.Root.Attribute("viewBox").ShouldNotBeNull();
        if (Environment.GetEnvironmentVariable("HOSO_TEST_DUMP_DIR") is { Length: > 0 } dump)   // để giải mã độc lập bằng công cụ khác (cv2)
        {
            Directory.CreateDirectory(dump);
            await File.WriteAllTextAsync(Path.Combine(dump, "kho-qr.svg"), xml.ToString(), TestContext.Current.CancellationToken);
        }

        var scanned = await (await clerk.GetAsync($"/api/v1/storage-locations/by-qr?payload={Uri.EscapeDataString(chain[4].QrPayload)}")).ReadAsync<Node>();
        scanned.Id.ShouldBe(chain[4].Id);
        (await clerk.GetAsync("/api/v1/storage-locations/by-qr?payload=HOSO-LOC:KHONG-CO")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await clerk.GetAsync("/api/v1/storage-locations/by-qr?payload=https://example.com")).StatusCode.ShouldBe(HttpStatusCode.NotFound);

        var labels = await clerk.GetAsync($"/api/v1/storage-locations/labels?ids={chain[3].Id},{chain[4].Id}");
        labels.StatusCode.ShouldBe(HttpStatusCode.OK);
        labels.Content.Headers.ContentType!.MediaType.ShouldBe("application/pdf");
        var bytes = await labels.Content.ReadAsByteArrayAsync(TestContext.Current.CancellationToken);
        if (Environment.GetEnvironmentVariable("HOSO_TEST_DUMP_DIR") is { Length: > 0 } dumpDir)
        {
            Directory.CreateDirectory(dumpDir);
            await File.WriteAllBytesAsync(Path.Combine(dumpDir, "kho-nhan.pdf"), bytes, TestContext.Current.CancellationToken);
        }
        using var pdf = PdfDocument.Open(bytes);
        pdf.NumberOfPages.ShouldBe(1);
        var text = pdf.GetPage(1).Text;
        text.ShouldContain($"QH1-{Tag}");
        text.ShouldContain($"QK1-{Tag}");
        text.ShouldContain("Hộp 1");

        (await clerk.GetAsync("/api/v1/storage-locations/labels?ids=khong-phai-guid")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await clerk.GetAsync($"/api/v1/storage-locations/labels?ids={Guid.NewGuid()}")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
    }

    [Fact]
    public async Task Dat_ho_so_vao_hop_ghi_lich_su_chuyen_cho_khac_va_khong_cho_ngung_dung_vi_tri_dang_chua_ho_so()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var employee = await api.LoginAsync("demo_cv_ht");
        var chain = await BuildChainAsync(clerk, "M");
        var second = await AddAsync(clerk, chain[3].Id, "box", "MH2", "Hộp 2");
        var dossier = await NewDossierAsync(employee, "Hồ sơ cần xếp vào kho");

        // Chuyên viên không được xếp kho. Không đặt thẳng vào kho/phòng/tủ.
        (await employee.PutJsonAsync($"/api/v1/dossiers/{dossier.Id}/location", new { locationId = chain[4].Id })).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PutJsonAsync($"/api/v1/dossiers/{dossier.Id}/location", new { locationId = chain[1].Id })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);

        var placed = await (await clerk.PutJsonAsync($"/api/v1/dossiers/{dossier.Id}/location", new { locationId = chain[4].Id, note = "Nhập kho lần đầu" })).ReadAsync<Placed>();
        placed.Path.ShouldBe("Kho M › Phòng 1 › Tủ 1 › Kệ 1 › Hộp 1");
        await clerk.PutJsonAsync($"/api/v1/dossiers/{dossier.Id}/location", new { locationId = second.Id, note = "Chuyển sang hộp 2" });

        var history = await (await clerk.GetAsync($"/api/v1/dossiers/{dossier.Id}/history")).ReadAsync<List<HistoryDto>>();
        var moves = history.Where(h => h.Action == "location.moved").ToList();
        moves.Count.ShouldBe(2);
        moves[0].Note.ShouldContain("Hộp 1 → Kho M › Phòng 1 › Tủ 1 › Kệ 1 › Hộp 2");   // mới nhất đứng đầu
        moves[0].Note.ShouldContain("Chuyển sang hộp 2");
        moves[0].ActorName.ShouldBe("GIẢ LẬP · demo_clerk_ubnd");
        moves[1].Note.ShouldStartWith("chưa xếp → ");

        // Hộp 1 đã trống, hộp 2 còn hồ sơ.
        var tree = await (await clerk.GetAsync("/api/v1/storage-locations")).ReadAsync<List<Node>>();
        tree.Single(n => n.Id == second.Id).DossierCount.ShouldBe(1);
        tree.Single(n => n.Id == chain[4].Id).DossierCount.ShouldBe(0);
        (await clerk.PatchJsonAsync($"/api/v1/storage-locations/{second.Id}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await clerk.PatchJsonAsync($"/api/v1/storage-locations/{chain[3].Id}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // còn hộp con đang dùng

        // Bỏ vị trí rồi mới ngừng dùng được; hộp ngừng dùng không nhận hồ sơ nữa.
        (await clerk.PutJsonAsync($"/api/v1/dossiers/{dossier.Id}/location", new { locationId = (Guid?)null })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.PatchJsonAsync($"/api/v1/storage-locations/{second.Id}", new { active = false })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.PutJsonAsync($"/api/v1/dossiers/{dossier.Id}/location", new { locationId = second.Id })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.dossier_location_moves WHERE dossier_id = $1", dossier.Id)).ShouldBe(3);
    }

    [Fact]
    public async Task Muon_tra_de_nghi_duyet_giao_tra_va_chi_mot_khoan_hieu_luc_moi_ho_so()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var employee = await api.LoginAsync("demo_cv_ht");
        var dossier = await NewDossierAsync(employee, "Hồ sơ cho mượn bản giấy");
        var borrower = await api.UserIdAsync("demo_cv_ht");

        (await employee.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "ab" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await employee.PostJsonAsync("/api/v1/loans", new { dossierId = Guid.NewGuid(), purpose = "Đối chiếu số liệu" })).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var loan = await (await employee.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "Đối chiếu số liệu với kết luận thanh tra" })).ReadAsync<LoanItem>();
        loan.Status.ShouldBe("requested");
        loan.BorrowerId.ShouldBe(borrower);

        // Văn thư nhận thông báo (qua outbox); người mượn không tự duyệt được.
        await api.DrainOutboxAsync();
        var clerkNotes = await (await clerk.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        clerkNotes.Items.ShouldContain(n => n.Kind == "loan.requested" && n.DossierId == dossier.Id);
        (await employee.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve")).StatusCode.ShouldBe(HttpStatusCode.Forbidden);
        (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/lend")).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // chưa duyệt không giao được

        // Hạn trả quá 90 ngày bị từ chối; duyệt hợp lệ.
        var tooLong = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).AddDays(120));
        (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve", new { dueOn = tooLong })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        var approved = await (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve", new { note = "Nhớ trả đúng hạn" })).ReadAsync<LoanItem>();
        approved.Status.ShouldBe("approved");
        approved.DueOn.ShouldBe(DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).AddDays(14)));
        (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve")).StatusCode.ShouldBe(HttpStatusCode.Conflict);   // duyệt hai lần

        // Người khác đề nghị trong lúc đã có khoản được duyệt: 409 loan_conflict.
        var rival = await api.LoginAsync("demo_head_ht");
        var conflict = await rival.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "Cũng cần xem hồ sơ này" });
        conflict.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await conflict.ProblemCodeAsync()).ShouldBe("loan_conflict");

        var lent = await (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/lend")).ReadAsync<LoanItem>();
        lent.Status.ShouldBe("lent");
        (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/lend")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var conflict2 = await rival.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "Lại muốn mượn khi đang cho mượn" });
        (await conflict2.ProblemCodeAsync()).ShouldBe("loan_conflict");
        (await conflict2.Content.ReadAsStringAsync(TestContext.Current.CancellationToken)).ShouldContain("đang được mượn");

        var returned = await (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/return", new { conditionNote = "Nguyên vẹn, đủ 24 trang" })).ReadAsync<LoanItem>();
        returned.Status.ShouldBe("returned");
        returned.ConditionNote.ShouldBe("Nguyên vẹn, đủ 24 trang");
        (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/return")).StatusCode.ShouldBe(HttpStatusCode.Conflict);

        // Sau khi trả, người khác mượn được; từ chối cần lý do; thông báo của người mượn.
        var next = await (await rival.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "Mượn sau khi hồ sơ đã được trả" })).ReadAsync<LoanItem>();
        (await clerk.PostJsonAsync($"/api/v1/loans/{next.Id}/reject", new { note = "x" })).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
        (await (await clerk.PostJsonAsync($"/api/v1/loans/{next.Id}/reject", new { note = "Hồ sơ đang được kiểm tra nội bộ" })).ReadAsync<LoanItem>()).Status.ShouldBe("rejected");
        await api.DrainOutboxAsync();
        var mine = await (await employee.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        mine.Items.Where(n => n.DossierId == dossier.Id).Select(n => n.Kind).ShouldBeSubsetOf(["loan.approved", "loan.lent", "dossier.assigned", "loan.rejected"]);
        mine.Items.Count(n => n.DossierId == dossier.Id && n.Kind is "loan.approved" or "loan.lent").ShouldBe(2);
        var rivalNotes = await (await rival.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        rivalNotes.Items.ShouldContain(n => n.Kind == "loan.rejected");

        // Người mượn chỉ thấy khoản của mình; văn thư thấy của cơ quan.
        (await (await employee.GetAsync("/api/v1/loans")).ReadAsync<List<LoanItem>>()).ShouldAllBe(l => l.BorrowerId == borrower);
        (await (await clerk.GetAsync($"/api/v1/loans?status=rejected")).ReadAsync<List<LoanItem>>()).ShouldContain(l => l.Id == next.Id);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name = 'loans' AND coalesce(new_row, old_row) ->> 'id' = $1", loan.Id.ToString())).ShouldBeGreaterThanOrEqualTo(4);   // đề nghị, duyệt, giao, trả
    }

    [Fact]
    public async Task Khoan_dang_muon_qua_han_chuyen_overdue_mot_lan_bao_nguoi_muon_va_van_thu_va_van_tra_duoc()
    {
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var employee = await api.LoginAsync("demo_cv_ht");
        var dossier = await NewDossierAsync(employee, "Hồ sơ mượn quá hạn");
        var loan = await (await employee.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "Tra cứu để lập báo cáo" })).ReadAsync<LoanItem>();
        var due = DateOnly.FromDateTime(DateTime.UtcNow.AddHours(7).AddDays(3));
        await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve", new { dueOn = due });
        await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/lend");

        var service = api.Services.GetServices<IHostedService>().OfType<DueReminderService>().Single();
        var beforeDue = new DateTimeOffset(due.ToDateTime(new TimeOnly(8, 0)), TimeSpan.FromHours(7));
        await service.RunOnceAsync(beforeDue, TestContext.Current.CancellationToken);           // đúng hạn: chưa quá hạn
        (await api.ScalarAsync<string>("SELECT status FROM hoso.loans WHERE id = $1", loan.Id)).ShouldBe("lent");

        var afterDue = beforeDue.AddDays(1);
        await service.RunOnceAsync(afterDue, TestContext.Current.CancellationToken);
        await service.RunOnceAsync(afterDue.AddHours(2), TestContext.Current.CancellationToken);   // chạy lại cùng ngày: không báo trùng
        (await api.ScalarAsync<string>("SELECT status FROM hoso.loans WHERE id = $1", loan.Id)).ShouldBe("overdue");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.notifications WHERE dossier_id = $1 AND kind = 'loan.overdue'", dossier.Id)).ShouldBeGreaterThanOrEqualTo(2);   // người mượn + văn thư
        var mine = await (await employee.GetAsync("/api/v1/notifications?unread=true")).ReadAsync<Notifications>();
        mine.Items.Count(n => n.Kind == "loan.overdue" && n.DossierId == dossier.Id).ShouldBe(1);

        // Vẫn là khoản hiệu lực nên không ai mượn thêm được; trả xong thì hết.
        var rival = await api.LoginAsync("demo_head_ht");
        (await rival.PostJsonAsync("/api/v1/loans", new { dossierId = dossier.Id, purpose = "Muốn mượn khi quá hạn" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var overdueList = await (await clerk.GetAsync("/api/v1/loans?status=overdue")).ReadAsync<List<LoanItem>>();
        overdueList.Single(l => l.Id == loan.Id).Overdue.ShouldBeTrue();
        (await (await clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/return", new { conditionNote = "Trả muộn 1 ngày" })).ReadAsync<LoanItem>()).Status.ShouldBe("returned");
    }
}
