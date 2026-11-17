using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Intake;

/// <summary>
/// BE-99. Hàng đợi AI tại một thời điểm: đủ để tính vị trí và thời gian chờ ước tính cho nhiều việc mà chỉ truy vấn một lần.
/// Thời gian chờ chỉ dựa trên số đo THẬT của 24 giờ qua (giây/trang OCR, tỉ lệ trang phải OCR, thời gian gợi ý mỗi job); chưa đủ số đo thì trả null, không đoán.
/// </summary>
public sealed class AiQueueModel
{
    /// <summary>Số trang OCR tối thiểu trong 24 giờ để tin con số trung vị.</summary>
    public const int MinSamples = 3;

    private readonly Entry[] _queued;
    private readonly long[] _prefixPages;
    private readonly long _runningPages, _foregroundRunningPages;
    private readonly int _runningJobs, _foregroundRunningJobs;
    private readonly double? _secondsPerOcrPage;
    private readonly double _ocrShare;
    private readonly double _otherSecondsPerJob;

    internal AiQueueModel(IReadOnlyList<Entry> active, double? secondsPerOcrPage, double ocrShare, double otherSecondsPerJob)
    {
        _queued = active.Where(e => e.Queued).OrderBy(e => e.Priority).ThenBy(e => e.At).ToArray();
        _prefixPages = new long[_queued.Length + 1];
        for (var i = 0; i < _queued.Length; i++) _prefixPages[i + 1] = _prefixPages[i] + _queued[i].PagesLeft;
        var running = active.Where(e => !e.Queued).ToArray();
        _runningPages = running.Sum(e => (long)e.PagesLeft);
        _runningJobs = running.Length;
        _foregroundRunningPages = running.Sum(e => (long)(e.Priority >= QueuePriority.BackgroundFrom ? Math.Min(1, e.PagesLeft) : e.PagesLeft));
        _foregroundRunningJobs = running.Count(e => e.Priority < QueuePriority.BackgroundFrom);
        _secondsPerOcrPage = secondsPerOcrPage;
        _ocrShare = ocrShare;
        _otherSecondsPerJob = otherSecondsPerJob;
    }

    internal sealed record Entry(bool Queued, short Priority, DateTimeOffset At, int PagesLeft);

    /// <summary>Giây trung bình cho một trang (kể cả trang có lớp chữ không cần OCR); null khi chưa đủ số đo.</summary>
    public double? SecondsPerPage => _secondsPerOcrPage is { } s ? s * _ocrShare : null;

    private static bool Before(Entry e, short priority, DateTimeOffset at) => e.Priority < priority || (e.Priority == priority && e.At < at);

    /// <summary>Vị trí trong hàng đợi, đúng thứ tự worker lấy việc: mức ưu tiên, rồi lúc nâng mức (nếu có) hoặc lúc tạo.</summary>
    public int Position(short priority, DateTimeOffset queuedAt) => 1 + BeforeCount(priority, queuedAt);

    private int BeforeCount(short priority, DateTimeOffset at)
    {
        var lo = 0;
        var hi = _queued.Length;
        while (lo < hi)
        {
            var mid = lo + (hi - lo) / 2;
            if (Before(_queued[mid], priority, at)) lo = mid + 1;
            else hi = mid;
        }
        return lo;
    }

    /// <summary>
    /// Giây chờ ước tính tới khi việc này xong. Việc đang chạy luôn ở trước; riêng việc nền đang chạy chỉ chắn một trang nếu việc này là việc ưu tiên
    /// (worker nhường chỗ sau trang hiện tại, AI-15).
    /// </summary>
    public int? EtaSeconds(short priority, DateTimeOffset queuedAt, int ownPages)
    {
        if (SecondsPerPage is not { } perPage) return null;
        var before = BeforeCount(priority, queuedAt);
        var foreground = priority < QueuePriority.BackgroundFrom;
        var pages = Math.Max(1, ownPages) + _prefixPages[before] + (foreground ? _foregroundRunningPages : _runningPages);
        var jobs = 1 + before + (foreground ? _foregroundRunningJobs : _runningJobs);
        return Seconds(pages * perPage + jobs * _otherSecondsPerJob);
    }

    /// <summary>Giây còn lại của việc đang chạy.</summary>
    public int? RemainingSeconds(int pagesLeft) =>
        SecondsPerPage is { } perPage ? Seconds(Math.Max(0, pagesLeft) * perPage + _otherSecondsPerJob) : null;
    private static int Seconds(double value) => (int)Math.Clamp(Math.Round(value), 0, int.MaxValue);
}

public sealed class AiQueueEstimator(IHoSoDb db)
{
    /// <summary>Tên cột theo quy ước snake_case của mô hình dữ liệu (median, samples, ocr_share, other).</summary>
    internal sealed class Rates
    {
        public double? Median { get; set; }
        public long Samples { get; set; }
        public double? OcrShare { get; set; }
        public double? Other { get; set; }
    }

    public async Task<AiQueueModel> LoadAsync(CancellationToken ct)
    {
        var active = await (from j in db.Read<OcrJob>()
                            join f in db.Read<FileRecord>() on j.FileId equals f.Id
                            where j.Status == JobStatus.Queued || j.Status == JobStatus.Running
                            select new { j.Status, j.Priority, At = j.PrioritizedAt ?? j.CreatedAt, Pages = j.PageCount ?? f.PageCount ?? 1, j.ProcessedPages })
            .ToListAsync(ct);
        var entries = active.Select(a => new AiQueueModel.Entry(a.Status == JobStatus.Queued, a.Priority, a.At, Math.Max(0, a.Pages - a.ProcessedPages))).ToList();

        var rates = (await db.Database.SqlQuery<Rates>($"""
            WITH recent AS (
              SELECT p.method, p.status, p.elapsed_seconds::float8 AS seconds
              FROM hoso.ocr_pages p JOIN hoso.ocr_jobs j ON j.id = p.job_id
              WHERE j.finished_at >= now() - interval '24 hours' AND p.status IN ('completed', 'empty')
            ), other AS (
              SELECT greatest(0, extract(epoch FROM j.finished_at - j.started_at)
                              - coalesce((SELECT sum(q.elapsed_seconds)::float8 FROM hoso.ocr_pages q WHERE q.job_id = j.id), 0)) AS seconds
              FROM hoso.ocr_jobs j
              WHERE j.status = 'completed' AND j.job_type = 'read_classify' AND j.started_at IS NOT NULL AND j.finished_at >= now() - interval '24 hours'
            )
            SELECT (SELECT percentile_cont(0.5) WITHIN GROUP (ORDER BY seconds) FROM recent WHERE method = 'ocr' AND status = 'completed')::float8 AS median,
                   (SELECT count(*) FROM recent WHERE method = 'ocr' AND status = 'completed') AS samples,
                   (SELECT (count(*) FILTER (WHERE method = 'ocr'))::float8 / nullif(count(*), 0) FROM recent) AS ocr_share,
                   (SELECT avg(seconds) FROM other)::float8 AS other
            """).ToListAsync(ct)).Single();

        return new AiQueueModel(entries,
            rates.Samples >= AiQueueModel.MinSamples ? rates.Median : null,
            rates.OcrShare ?? 1.0,
            rates.Other ?? 0);
    }
}
