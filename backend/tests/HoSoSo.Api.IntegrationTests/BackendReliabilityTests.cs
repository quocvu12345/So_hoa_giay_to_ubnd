using System.Net;
using System.Net.Http.Headers;
using HoSoSo.Api.IntegrationTests.Support;
using HoSoSo.Application.Search;
using HoSoSo.Application.Intake;
using HoSoSo.Application.Documents;
using HoSoSo.Application.Operations;
using Microsoft.Extensions.DependencyInjection;
using Npgsql;
using Microsoft.AspNetCore.Hosting;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace HoSoSo.Api.IntegrationTests;

// BE-101–107: hồi quy từ tám lỗi đã tái hiện trong đợt rà soát backend.
public sealed class BackendReliabilityTests(BackendReliabilityFactory api) : IClassFixture<BackendReliabilityFactory>
{
    private sealed record LoanResult(Guid Id, string Status);

    private async Task<(HttpClient Client, Guid Document, Guid Dossier)> ReviewedAsync(string metadata = "unverified")
    {
        var client = await api.LoginAsync("demo_cv_ht");
        var user = await api.UserIdAsync("demo_cv_ht");
        var doc = Guid.NewGuid();
        await api.ExecuteAsync("INSERT INTO hoso.documents(id,origin,title,document_form,intake_status,uploaded_by,metadata_status) VALUES ($1,'internal','Review probe','Biên bản','inbox',$2,$3)", doc, user, metadata);
        var classified = await (await client.PutJsonAsync($"/api/v1/documents/{doc}/classification", new { workGroupCode = "U15", documentTypeCode = "U15-D07" })).ReadAsync<ReviewDto>();
        (await client.PatchJsonAsync($"/api/v1/documents/{doc}/fields", new { fields = classified.Fields.Select(f => new { fieldCode = f.FieldCode, value = "Đã đối chiếu", verify = true }).ToArray() })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.PostJsonAsync($"/api/v1/documents/{doc}/verify")).StatusCode.ShouldBe(HttpStatusCode.OK);
        var dossier = await (await client.PostJsonAsync("/api/v1/dossiers", new { title = "Hồ sơ kiểm chứng backend", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await client.PostJsonAsync($"/api/v1/dossiers/{dossier.Id}/documents", new { documentId = doc })).StatusCode.ShouldBe(HttpStatusCode.OK);
        return (client, doc, dossier.Id);
    }

    private async Task WaitLocksAsync(int count)
    {
        for (var n = 0; n < 200; n++)
        {
            var waiting = await api.ScalarAsync<long>("SELECT count(*) FROM pg_stat_activity WHERE datname=current_database() AND wait_event_type='Lock'");
            if (waiting >= count) return;
            await Task.Delay(25, TestContext.Current.CancellationToken);
        }
        throw new TimeoutException("Expected blocked database request did not arrive.");
    }

    [Fact]
    public async Task Metadata_blocks_submit_until_explicit_confirmation()
    {
        var (client, doc, dossier) = await ReviewedAsync("needs_review");
        var detail = await (await client.GetAsync($"/api/v1/dossiers/{dossier}")).ReadAsync<DossierDetailDto>();
        detail.Completeness.Ready.ShouldBeFalse();
        var actions = await (await client.GetAsync($"/api/v1/dossiers/{dossier}/actions")).ReadAsync<List<ActionDto>>();
        actions.Single(a => a.Action == "submit").Enabled.ShouldBeFalse();
        (await api.ScalarAsync<string>("SELECT metadata_status FROM hoso.documents WHERE id=$1", doc)).ShouldBe("needs_review");
        var response = await client.PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "submit" });
        response.StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await response.ProblemCodeAsync()).ShouldBe("dossier_incomplete");
        var review = await (await client.GetAsync($"/api/v1/documents/{doc}/review")).ReadAsync<ReviewData>();
        var metadata = new { version = review.Document.Version, title = review.Document.Title, documentForm = review.Document.DocumentForm, note = "Đã kiểm tra trên bản gốc" };
        var confirmed = await (await client.PutJsonAsync($"/api/v1/documents/{doc}/metadata", metadata)).ReadAsync<ReviewData>();
        confirmed.Document.MetadataStatus.ShouldBe("header_checked");
        confirmed.Document.MetadataReviewedBy.ShouldBe(await api.UserIdAsync("demo_cv_ht"));
        confirmed.Document.MetadataReviewedAt.ShouldNotBeNull();
        confirmed.Document.MetadataReviewNote.ShouldBe(metadata.note);
        (await client.PutJsonAsync($"/api/v1/documents/{doc}/metadata", metadata)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await (await client.GetAsync($"/api/v1/dossiers/{dossier}")).ReadAsync<DossierDetailDto>()).Completeness.Ready.ShouldBeTrue();
        (await client.PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await client.PutJsonAsync($"/api/v1/documents/{doc}/metadata", metadata)).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Submit_waits_for_field_edit_and_rechecks_completeness()
    {
        var (client, doc, dossier) = await ReviewedAsync();
        await using var connection = await api.Data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand("SELECT id FROM hoso.documents WHERE id=$1 FOR UPDATE", connection, transaction))
        {
            cmd.Parameters.AddWithValue(doc);
            await cmd.ExecuteScalarAsync();
        }
        var edit = client.PatchJsonAsync($"/api/v1/documents/{doc}/fields", new { fields = new[] { new { fieldCode = "U15-D07-F01", value = "Thay đổi sau khi trình", verify = false } } });
        Task<HttpResponseMessage>? submit = null;
        try
        {
            await WaitLocksAsync(1);
            submit = client.PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "submit" });
            await WaitLocksAsync(2);
        }
        finally { await transaction.RollbackAsync(); }
        (await edit).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await submit!).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.dossiers WHERE id=$1", dossier)).ShouldBe("draft");
        (await api.ScalarAsync<string>("SELECT data_review_status FROM hoso.documents WHERE id=$1", doc)).ShouldBe("pending");
    }

    [Fact]
    public async Task Edit_waits_for_submit_then_rejects_locked_dossier()
    {
        var (client, doc, dossier) = await ReviewedAsync();
        await using var connection = await api.Data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand("SELECT id FROM hoso.dossiers WHERE id=$1 FOR UPDATE", connection, transaction))
        {
            cmd.Parameters.AddWithValue(dossier);
            await cmd.ExecuteScalarAsync();
        }
        var submit = client.PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "submit" });
        Task<HttpResponseMessage>? edit = null;
        try
        {
            await WaitLocksAsync(1);
            edit = client.PatchJsonAsync($"/api/v1/documents/{doc}/fields", new { fields = new[] { new { fieldCode = "U15-D07-F01", value = "Không được ghi", verify = false } } });
            await WaitLocksAsync(2);
        }
        finally { await transaction.RollbackAsync(); }
        (await submit).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await edit!).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.ScalarAsync<string>("SELECT data_review_status FROM hoso.documents WHERE id=$1", doc)).ShouldBe("verified");
    }

    [Fact]
    public async Task Correcting_metadata_invalidates_review_and_preserves_scope()
    {
        var (client, doc, _) = await ReviewedAsync();
        var review = await (await client.GetAsync($"/api/v1/documents/{doc}/review")).ReadAsync<ReviewData>();
        var body = new { version = review.Document.Version, title = "Tiêu đề đã sửa theo bản gốc", documentForm = "Biên bản", documentNumber = "01/BB", issuedOn = "2026-01-20", note = "Sửa lỗi nhập liệu" };
        var outsider = await api.LoginAsync("demo_cv_kt");
        (await outsider.PutJsonAsync($"/api/v1/documents/{doc}/metadata", body)).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        var changed = await (await client.PutJsonAsync($"/api/v1/documents/{doc}/metadata", body)).ReadAsync<ReviewData>();
        changed.Document.ReviewStatus.ShouldBe("pending");
        changed.Document.MetadataStatus.ShouldBe("header_checked");
        changed.Document.DocumentNumber.ShouldBe("01/BB");
        changed.Document.IssuedOn.ShouldBe(new DateOnly(2026, 1, 20));
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.audit_events WHERE table_name='documents' AND new_row->>'id'=$1 AND new_row->>'metadata_review_note'='Sửa lỗi nhập liệu' AND actor_subject=$2", doc.ToString(), (await api.UserIdAsync("demo_cv_ht")).ToString())).ShouldBe(1);
    }

    [Fact]
    public async Task Same_loan_has_only_one_decision_under_concurrency()
    {
        var (client, _, dossier) = await ReviewedAsync();
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var loan = await (await client.PostJsonAsync("/api/v1/loans", new { dossierId = dossier, purpose = "Mượn để kiểm chứng" })).ReadAsync<LoanResult>();
        await using var connection = await api.Data.OpenConnectionAsync();
        await using var transaction = await connection.BeginTransactionAsync();
        await using (var cmd = new NpgsqlCommand("SELECT id FROM hoso.loans WHERE id=$1 FOR UPDATE", connection, transaction))
        {
            cmd.Parameters.AddWithValue(loan.Id);
            await cmd.ExecuteScalarAsync();
        }
        var approve = clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/approve");
        Task<HttpResponseMessage>? reject = null;
        try
        {
            await WaitLocksAsync(1);
            reject = clerk.PostJsonAsync($"/api/v1/loans/{loan.Id}/reject", new { note = "Từ chối trong lúc người khác đang duyệt" });
            await WaitLocksAsync(2);
        }
        finally { await transaction.RollbackAsync(); }
        (await approve).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await reject!).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.loans WHERE id=$1", loan.Id)).ShouldBe("approved");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.outbox_messages WHERE payload->>'loanId'=$1 AND type IN ('loan.approved','loan.rejected')", loan.Id.ToString())).ShouldBe(1);
    }

    [Fact]
    public async Task Search_finds_visible_document_after_5000_invisible_matches()
    {
        var client = await api.LoginAsync("demo_cv_ht");
        var owner = await api.UserIdAsync("demo_cv_ht");
        var other = await api.UserIdAsync("demo_cv_kt");
        const string token = "reviewprobefindunique";
        await api.ExecuteAsync("INSERT INTO hoso.documents(origin,title,document_form,document_number,intake_status,uploaded_by) SELECT 'internal','Hidden probe','Biên bản',$1,'inbox',$2 FROM generate_series(1,5001)", token, other);
        var doc = Guid.NewGuid();
        await api.ExecuteAsync("INSERT INTO hoso.documents(id,origin,title,document_form,intake_status,uploaded_by) VALUES ($1,'internal',$2,'Biên bản','inbox',$3)", doc, token + " visible", owner);
        (await client.GetAsync($"/api/v1/documents/{doc}")).StatusCode.ShouldBe(HttpStatusCode.OK);
        var search = await (await client.GetAsync($"/api/v1/search?q={token}&kind=documents")).ReadAsync<SearchResult>();
        search.TotalDocuments.ShouldBe(1);
        search.Hits.Single().Id.ShouldBe(doc);
    }

    [Fact]
    public async Task Non_default_preview_does_not_persist_orphan_blobs()
    {
        var client = await api.LoginAsync("demo_cv_ht");
        var sample = Path.Combine(TestDatabase.MigrationsPath, "..", "..", "..", "database", "samples", "public-016.pdf");
        using var form = new MultipartFormDataContent();
        var content = new ByteArrayContent(await File.ReadAllBytesAsync(sample));
        content.Headers.ContentType = new MediaTypeHeaderValue("application/pdf");
        form.Add(content, "file", "preview-probe.pdf");
        var up = await (await client.PostAsync("/api/v1/intake/files", form)).ReadAsync<UploadDto>();
        var before = Directory.GetFiles(Path.Combine(api.StorageRoot, "blobs"), "*", SearchOption.AllDirectories).Length;
        (await client.GetAsync($"/api/v1/files/{up.FileId}/pages/1/preview?w=360")).StatusCode.ShouldBe(HttpStatusCode.OK);
        Directory.GetFiles(Path.Combine(api.StorageRoot, "blobs"), "*", SearchOption.AllDirectories).Length.ShouldBe(before);
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.page_images WHERE file_id=$1 AND preview_storage_key IS NOT NULL", up.FileId)).ShouldBe(0);
    }

    private async Task<(HttpClient Client, HttpClient Clerk, Guid Dossier, Guid Disposal, Guid Document)> ApprovedDisposalAsync()
    {
        var (client, document, dossier) = await ReviewedAsync();
        var clerk = await api.LoginAsync("demo_clerk_ubnd");
        var chair = await api.LoginAsync("demo_chair");
        (await client.PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "submit" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await (await api.LoginAsync("demo_head_ht")).PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "accept" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await clerk.PostJsonAsync($"/api/v1/dossiers/{dossier}/transitions", new { action = "archive" })).StatusCode.ShouldBe(HttpStatusCode.OK);
        var rule = Guid.NewGuid();
        var confirmer = await api.UserIdAsync("demo_chair");
        await api.ExecuteAsync("INSERT INTO hoso.retention_rules(id,work_group_code,retention_label,retention_years,legal_reference,status,confirmed_by,confirmed_at) VALUES ($1,'U15','10 năm',10,'Căn cứ kiểm thử','confirmed',$2,now())", rule, confirmer);
        await api.ExecuteAsync("UPDATE hoso.dossiers SET archived_at=now()-interval '12 years', retention_rule_id=$2 WHERE id=$1", dossier, rule);
        var requested = await (await clerk.PostJsonAsync("/api/v1/disposals", new { dossierId = dossier, reason = "Hết thời hạn bảo quản kiểm thử" })).ReadAsync<LoanResult>();
        var decision = await api.ScalarAsync<Guid>("SELECT id FROM hoso.documents WHERE external_key='public-016'");
        (await chair.PostJsonAsync($"/api/v1/disposals/{requested.Id}/approve", new { decisionDocumentId = decision })).StatusCode.ShouldBe(HttpStatusCode.OK);
        return (client, clerk, dossier, requested.Id, document);
    }

    [Fact]
    public async Task Disposed_dossier_blocks_new_and_preexisting_loan_requests()
    {
        var s = await ApprovedDisposalAsync();
        var pending = await (await s.Client.PostJsonAsync("/api/v1/loans", new { dossierId = s.Dossier, purpose = "Mượn trước khi hủy" })).ReadAsync<LoanResult>();
        (await s.Clerk.PostJsonAsync($"/api/v1/disposals/{s.Disposal}/execute")).StatusCode.ShouldBe(HttpStatusCode.OK);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.disposal_requests WHERE id=$1", s.Disposal)).ShouldBe("executed");
        var request = await s.Client.PostJsonAsync("/api/v1/loans", new { dossierId = s.Dossier, purpose = "Mượn hồ sơ đã bị hủy" });
        request.StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await request.ProblemCodeAsync()).ShouldBe("dossier_disposed");
        (await s.Clerk.PostJsonAsync($"/api/v1/loans/{pending.Id}/approve")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        (await s.Clerk.PostJsonAsync($"/api/v1/loans/{pending.Id}/lend")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
    }

    [Fact]
    public async Task Disposal_finalization_failure_keeps_durable_work_for_retry()
    {
        var s = await ApprovedDisposalAsync();
        var storage = api.Services.GetRequiredService<IFileStorage>();
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("Review fixture " + Guid.NewGuid()));
        var stored = await storage.SaveAsync(stream, TestContext.Current.CancellationToken);
        var file = Guid.NewGuid();
        await api.ExecuteAsync("INSERT INTO hoso.files(id,document_id,version_no,file_role,original_name,media_type,byte_size,sha256,storage_key) VALUES ($1,$2,1,'scan','probe.pdf','application/pdf',$3,$4,$5)", file, s.Document, stored.ByteSize, stored.Sha256, stored.StorageKey);
        // Inject a failure at COMMIT, after storage deletion, in this isolated test database.
        await api.ExecuteAsync("CREATE FUNCTION hoso.review_fail_disposal_commit() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected commit failure'; END $$; CREATE CONSTRAINT TRIGGER review_fail_disposal_commit AFTER UPDATE ON hoso.disposal_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status='executed') EXECUTE FUNCTION hoso.review_fail_disposal_commit()");
        try
        {
            (await s.Clerk.PostJsonAsync($"/api/v1/disposals/{s.Disposal}/execute")).StatusCode.ShouldBe(HttpStatusCode.OK);
            (await api.ScalarAsync<string>("SELECT status FROM hoso.disposal_requests WHERE id=$1", s.Disposal)).ShouldBe("executing");
            (await api.ScalarAsync<bool>("SELECT disposed_at IS NOT NULL AND storage_key IS NULL FROM hoso.files WHERE id=$1", file)).ShouldBeTrue();
            (await storage.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeFalse();
        }
        finally { await api.ExecuteAsync("DROP TRIGGER review_fail_disposal_commit ON hoso.disposal_requests; DROP FUNCTION hoso.review_fail_disposal_commit()"); }
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.disposal_blob_deletions WHERE request_id=$1 AND completed_at IS NULL", s.Disposal)).ShouldBe(1);
        await api.Services.GetRequiredService<IDisposalProcessor>().ProcessAsync(s.Disposal, TestContext.Current.CancellationToken);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.disposal_requests WHERE id=$1", s.Disposal)).ShouldBe("executed");
        (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.disposal_blob_deletions WHERE request_id=$1 AND completed_at IS NULL", s.Disposal)).ShouldBe(0);
    }

    [Fact]
    public async Task Disposal_preparation_commit_failure_preserves_file_and_blob()
    {
        var s = await ApprovedDisposalAsync();
        var storage = api.Services.GetRequiredService<IFileStorage>();
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("Commit rollback " + Guid.NewGuid()));
        var stored = await storage.SaveAsync(stream, TestContext.Current.CancellationToken);
        var file = Guid.NewGuid();
        await api.ExecuteAsync("INSERT INTO hoso.files(id,document_id,version_no,file_role,original_name,media_type,byte_size,sha256,storage_key) VALUES ($1,$2,1,'scan','probe.pdf','application/pdf',$3,$4,$5)", file, s.Document, stored.ByteSize, stored.Sha256, stored.StorageKey);
        await api.ExecuteAsync("CREATE FUNCTION hoso.fail_disposal_preparation() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'Injected preparation failure'; END $$; CREATE CONSTRAINT TRIGGER fail_disposal_preparation AFTER UPDATE ON hoso.disposal_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.status='executing') EXECUTE FUNCTION hoso.fail_disposal_preparation()");
        try
        {
            (await s.Clerk.PostJsonAsync($"/api/v1/disposals/{s.Disposal}/execute")).StatusCode.ShouldBe(HttpStatusCode.UnprocessableEntity);
            (await api.ScalarAsync<string>("SELECT status FROM hoso.disposal_requests WHERE id=$1", s.Disposal)).ShouldBe("approved");
            (await api.ScalarAsync<bool>("SELECT disposed_at IS NULL AND storage_key IS NOT NULL FROM hoso.files WHERE id=$1", file)).ShouldBeTrue();
            (await storage.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeTrue();
            (await api.ScalarAsync<long>("SELECT count(*) FROM hoso.disposal_blob_deletions WHERE request_id=$1", s.Disposal)).ShouldBe(0);
        }
        finally { await api.ExecuteAsync("DROP TRIGGER fail_disposal_preparation ON hoso.disposal_requests; DROP FUNCTION hoso.fail_disposal_preparation()"); }
    }

    [Fact]
    public async Task Storage_failure_retries_and_disposed_files_cannot_restart_OCR()
    {
        var s = await ApprovedDisposalAsync();
        var storage = api.Services.GetRequiredService<IFileStorage>();
        using var stream = new MemoryStream(System.Text.Encoding.UTF8.GetBytes("Storage retry " + Guid.NewGuid()));
        var stored = await storage.SaveAsync(stream, TestContext.Current.CancellationToken);
        var file = Guid.NewGuid();
        await api.ExecuteAsync("INSERT INTO hoso.files(id,document_id,version_no,file_role,original_name,media_type,byte_size,sha256,storage_key) VALUES ($1,$2,1,'scan','probe.pdf','application/pdf',$3,$4,$5)", file, s.Document, stored.ByteSize, stored.Sha256, stored.StorageKey);
        var job = await api.ScalarAsync<Guid>("INSERT INTO hoso.ocr_jobs(file_id,requested_by) VALUES ($1,$2) RETURNING id", file, await api.UserIdAsync("demo_cv_ht"));
        using var failingApi = api.WithWebHostBuilder(b => b.ConfigureServices(services =>
        {
            services.RemoveAll<IFileStorage>();
            services.AddSingleton<IFileStorage>(new FailingDeleteStorage(storage));
        }));
        using var clerk = failingApi.CreateClient(new() { AllowAutoRedirect = false });
        (await clerk.GetAsync("/api/v1/auth/dev-login?username=demo_clerk_ubnd")).StatusCode.ShouldBe(HttpStatusCode.Redirect);
        clerk.DefaultRequestHeaders.Add("X-CSRF", "1");
        var pending = await (await clerk.PostJsonAsync($"/api/v1/disposals/{s.Disposal}/execute")).ReadAsync<DisposalResult>();
        pending.Disposal.Status.ShouldBe("executing");
        pending.FilesDisposed.ShouldBe(1);
        pending.BlobsDeleted.ShouldBe(0);
        (await storage.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeTrue();
        (await api.ScalarAsync<bool>("SELECT attempts=1 AND completed_at IS NULL AND next_attempt_at > now() AND last_error='IOException' FROM hoso.disposal_blob_deletions WHERE request_id=$1", s.Disposal)).ShouldBeTrue();
        (await s.Client.GetAsync($"/api/v1/files/{file}/content")).StatusCode.ShouldBe(HttpStatusCode.NotFound);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.ocr_jobs WHERE id=$1", job)).ShouldBe("cancelled");
        (await s.Client.PostJsonAsync($"/api/v1/jobs/{job}/pages/1/retry")).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var extracted = await (await s.Client.PostJsonAsync($"/api/v1/documents/{s.Document}/ai/extract", new { force = true })).ReadAsync<AiExtractResult>();
        extracted.Skipped.ShouldBe(1);
        (await s.Client.PostJsonAsync("/api/v1/loans", new { dossierId = s.Dossier, purpose = "Mượn khi đang hủy" })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        var newDossier = await (await s.Client.PostJsonAsync("/api/v1/dossiers", new { title = "Không nhận giấy tờ đã hủy", workGroupCode = "U15" })).ReadAsync<DossierDetailDto>();
        (await s.Client.PostJsonAsync($"/api/v1/dossiers/{newDossier.Id}/documents", new { documentId = s.Document })).StatusCode.ShouldBe(HttpStatusCode.Conflict);
        await api.ExecuteAsync("UPDATE hoso.disposal_blob_deletions SET next_attempt_at=now()-interval '1 second' WHERE request_id=$1", s.Disposal);
        await api.Services.GetRequiredService<IDisposalProcessor>().ProcessAsync(s.Disposal, TestContext.Current.CancellationToken);
        (await api.ScalarAsync<string>("SELECT status FROM hoso.disposal_requests WHERE id=$1", s.Disposal)).ShouldBe("executed");
        (await storage.ExistsAsync(stored.StorageKey, TestContext.Current.CancellationToken)).ShouldBeFalse();
    }

    private sealed class FailingDeleteStorage(IFileStorage inner) : IFileStorage
    {
        public Task<StoredFile> SaveAsync(Stream content, CancellationToken ct) => inner.SaveAsync(content, ct);
        public Task<Stream> OpenReadAsync(string key, CancellationToken ct) => inner.OpenReadAsync(key, ct);
        public Task<bool> ExistsAsync(string key, CancellationToken ct) => inner.ExistsAsync(key, ct);
        public Task<bool> DeleteAsync(string key, CancellationToken ct) => throw new IOException("Injected storage outage");
    }

    [Fact]
    public async Task Inbox_cursor_reaches_all_items_with_equal_upload_timestamps()
    {
        var client = await api.LoginAsync("demo_cv_ht_02");
        var owner = await api.UserIdAsync("demo_cv_ht_02");
        await api.ExecuteAsync("WITH docs AS (INSERT INTO hoso.documents(origin,title,document_form,intake_status,uploaded_by) SELECT 'internal','Inbox probe','Biên bản','inbox',$1 FROM generate_series(1,201) RETURNING id) INSERT INTO hoso.files(document_id,version_no,file_role,original_name,media_type,byte_size,sha256,storage_key,uploaded_at) SELECT id,1,'scan','probe.pdf','application/pdf',1,md5(id::text)||md5(id::text),'fixture/'||id,now() FROM docs", owner);
        var seen = new HashSet<Guid>();
        string? cursor = null;
        do
        {
            var page = await (await client.GetAsync("/api/v1/intake/inbox?limit=50&cursor=" + Uri.EscapeDataString(cursor ?? ""))).ReadAsync<PageDto<InboxDto>>();
            page.Items.Count.ShouldBeLessThanOrEqualTo(50);
            foreach (var item in page.Items) seen.Add(item.FileId).ShouldBeTrue("mỗi tệp chỉ xuất hiện một lần");
            cursor = page.NextCursor;
        } while (cursor is not null);
        seen.Count.ShouldBe(201);
        (await client.GetAsync("/api/v1/intake/inbox?cursor=invalid")).StatusCode.ShouldBe(HttpStatusCode.BadRequest);
    }
}

// Thử lại chủ động trong test; không để vòng nền tranh xử lý lỗi được tiêm vào.
public sealed class BackendReliabilityFactory : DbApiFactory
{
    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        base.ConfigureWebHost(builder);
        builder.UseSetting("Background:Enabled", "false");
    }
}
