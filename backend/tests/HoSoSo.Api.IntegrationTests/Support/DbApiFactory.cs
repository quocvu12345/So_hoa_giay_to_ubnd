using System.Net;
using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.Hosting;
using Npgsql;

namespace HoSoSo.Api.IntegrationTests.Support;

/// <summary>
/// API chạy trong bộ nhớ trên CSDL PostgreSQL thật (đã migrate + dữ liệu mẫu 004). Mỗi lớp test một CSDL riêng.
/// Viết một test mới chỉ cần: <c>var http = await Api.LoginAsync("demo_cv_ht");</c> rồi gọi API.
/// </summary>
public class DbApiFactory : WebApplicationFactory<Program>, IAsyncLifetime
{
    public static readonly JsonSerializerOptions Json = new(JsonSerializerDefaults.Web);
    private string? _database;
    private string _connection = "Host=127.0.0.1;Port=1;Database=none";
    private readonly string _storage = Path.Combine(Path.GetTempPath(), "hoso-test-" + Guid.NewGuid().ToString("N"));

    public string StorageRoot => _storage;

    public async ValueTask InitializeAsync()
    {
        await TestDatabase.EnsureAsync();
        if (TestDatabase.SkipReason is not null) return;
        (_database, _connection) = await TestDatabase.CreateAsync();
    }

    public override async ValueTask DisposeAsync()
    {
        await base.DisposeAsync();
        if (_database is not null) await TestDatabase.DropAsync(_database);
        if (Directory.Exists(_storage)) Directory.Delete(_storage, true);
        GC.SuppressFinalize(this);
    }

    protected override void ConfigureWebHost(IWebHostBuilder builder)
    {
        builder.UseEnvironment("Development");
        builder.UseSetting("ConnectionStrings:HoSo", _connection);
        builder.UseSetting("Auth:Mode", "Dev");
        builder.UseSetting("Auth:CookieName", "hoso_session_test");
        builder.UseSetting("Auth:SecureCookie", "false");
        builder.UseSetting("Auth:PublicOrigin", "http://localhost");
        builder.UseSetting("Storage:Root", _storage);
        // Phần lớn test chạy xử lý PDF ngay trong tiến trình cho nhanh; PdfSandboxTests chạy tiến trình con thật (mặc định của hệ thống là Process).
        builder.UseSetting("PdfSandbox:Mode", "InProcess");
        // Nhật ký test chỉ hiện cảnh báo trở lên để kết quả dễ đọc.
        builder.UseSetting("Serilog:MinimumLevel:Default", "Warning");
        builder.UseSetting("Serilog:MinimumLevel:Override:Microsoft.EntityFrameworkCore.Database.Command", "Warning");
        builder.UseSetting("Serilog:MinimumLevel:Override:Microsoft.AspNetCore", "Warning");
    }

    /// <summary>Bỏ qua test (không đỏ giả) khi máy không có PostgreSQL.</summary>
    public void RequireDatabase() => Assert.SkipUnless(TestDatabase.SkipReason is null, TestDatabase.SkipReason ?? "");

    /// <summary>Đăng nhập bằng người dùng giả lập; trả HttpClient đã có cookie phiên và header X-CSRF.</summary>
    public async Task<HttpClient> LoginAsync(string username, string? assignmentId = null)
    {
        RequireDatabase();
        var http = CreateClient(new WebApplicationFactoryClientOptions { AllowAutoRedirect = false, HandleCookies = true });
        var login = await http.GetAsync($"/api/v1/auth/dev-login?username={username}", TestContext.Current.CancellationToken);
        login.StatusCode.ShouldBe(HttpStatusCode.Redirect, $"đăng nhập {username}");
        http.DefaultRequestHeaders.Add("X-CSRF", "1");
        if (assignmentId is not null) http.DefaultRequestHeaders.Add("X-Assignment-Id", assignmentId);
        return http;
    }

    public NpgsqlDataSource Data => Services.GetRequiredService<NpgsqlDataSource>();

    /// <summary>
    /// Xử lý hết outbox đã đến hạn rồi mới trả về. Vòng nền của OutboxDispatcher cũng đang chạy; nếu nó đang giữ khóa lô thì
    /// một lần ProcessBatchAsync thủ công thấy rỗng và trả về ngay, còn thông báo mới được ghi sau đó. Vì vậy phải chờ tới khi không còn việc đến hạn.
    /// </summary>
    public async Task DrainOutboxAsync()
    {
        var dispatcher = Services.GetServices<IHostedService>().OfType<HoSoSo.Infrastructure.Messaging.OutboxDispatcher>().Single();
        var pending = await Eventually.ForAsync(async () =>
        {
            await dispatcher.ProcessBatchAsync(TestContext.Current.CancellationToken);
            return await ScalarAsync<long>("SELECT count(*) FROM hoso.outbox_messages WHERE processed_at IS NULL AND next_attempt_at <= now()");
        }, n => n == 0, TimeSpan.FromSeconds(20));
        pending.ShouldBe(0, "outbox còn việc đến hạn chưa xử lý");
    }

    public async Task<T?> ScalarAsync<T>(string sql, params object[] parameters)
    {
        await using var command = Data.CreateCommand(sql);
        foreach (var value in parameters) command.Parameters.Add(new NpgsqlParameter { Value = value });
        var result = await command.ExecuteScalarAsync(TestContext.Current.CancellationToken);
        return result is null or DBNull ? default : (T)result;
    }

    public async Task<int> ExecuteAsync(string sql, params object[] parameters)
    {
        await using var command = Data.CreateCommand(sql);
        foreach (var value in parameters) command.Parameters.Add(new NpgsqlParameter { Value = value });
        return await command.ExecuteNonQueryAsync(TestContext.Current.CancellationToken);
    }

    public Task<Guid> UserIdAsync(string username) => ScalarAsync<Guid>("SELECT id FROM hoso.users WHERE username = $1", username);

    public Task<string> AssignmentIdAsync(string username, string role) =>
        ScalarAsync<Guid>("SELECT ur.id FROM hoso.user_roles ur JOIN hoso.users u ON u.id = ur.user_id WHERE u.username = $1 AND ur.role_code = $2 ORDER BY ur.valid_from LIMIT 1", username, role)
            .ContinueWith(t => t.Result.ToString(), TaskScheduler.Default);
}

public static class HttpTestExtensions
{
    public static async Task<T> ReadAsync<T>(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        response.IsSuccessStatusCode.ShouldBeTrue($"HTTP {(int)response.StatusCode}: {body}");
        return JsonSerializer.Deserialize<T>(body, DbApiFactory.Json)!;
    }

    public static async Task<string> ProblemCodeAsync(this HttpResponseMessage response)
    {
        var body = await response.Content.ReadAsStringAsync(TestContext.Current.CancellationToken);
        using var doc = JsonDocument.Parse(body);
        var type = doc.RootElement.GetProperty("type").GetString()!;
        return type[(type.LastIndexOf('/') + 1)..];
    }

    public static Task<HttpResponseMessage> PostJsonAsync(this HttpClient http, string url, object? body = null) =>
        http.PostAsJsonAsync(url, body ?? new { }, DbApiFactory.Json, TestContext.Current.CancellationToken);

    public static Task<HttpResponseMessage> PutJsonAsync(this HttpClient http, string url, object body) =>
        http.PutAsJsonAsync(url, body, DbApiFactory.Json, TestContext.Current.CancellationToken);

    public static Task<HttpResponseMessage> PatchJsonAsync(this HttpClient http, string url, object body) =>
        http.PatchAsync(url, JsonContent.Create(body, options: DbApiFactory.Json), TestContext.Current.CancellationToken);

    public static Task<HttpResponseMessage> GetAsync(this HttpClient http, string url) =>
        http.GetAsync(url, TestContext.Current.CancellationToken);
}
