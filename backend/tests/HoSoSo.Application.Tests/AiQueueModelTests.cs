using System.Diagnostics;
using HoSoSo.Application.Intake;

namespace HoSoSo.Application.Tests;

public sealed class AiQueueModelTests(ITestOutputHelper output)
{
    [Fact]
    public void Indexed_queue_matches_full_scan_with_priorities_ties_and_preemption()
    {
        var random = new Random(10108);
        var now = DateTimeOffset.UtcNow;
        var entries = Enumerable.Range(0, 10000).Select(i => new AiQueueModel.Entry(
            i >= 3, (short)random.Next(0, 1000), now.AddSeconds(random.Next(0, 100)), random.Next(0, 50))).ToArray();
        var queries = entries.Skip(3).Take(1000).ToArray();
        var watch = Stopwatch.StartNew();
        var expected = queries.Select(q =>
        {
            var ahead = entries.Where(e => !e.Queued || e.Priority < q.Priority || e.Priority == q.Priority && e.At < q.At).ToArray();
            var pages = Math.Max(1, q.PagesLeft);
            var jobs = 1;
            foreach (var e in ahead)
            {
                var yields = !e.Queued && e.Priority >= QueuePriority.BackgroundFrom && q.Priority < QueuePriority.BackgroundFrom;
                pages += yields ? Math.Min(1, e.PagesLeft) : e.PagesLeft;
                if (!yields) jobs++;
            }
            return (Position: 1 + ahead.Count(e => e.Queued), Eta: (int)Math.Round(pages * 7.5 + jobs * 2.5));
        }).ToArray();
        var fullScan = watch.Elapsed.TotalMilliseconds;
        watch.Restart();
        var model = new AiQueueModel(entries, 10, .75, 2.5);
        var actual = queries.Select(q => (Position: model.Position(q.Priority, q.At), Eta: model.EtaSeconds(q.Priority, q.At, q.PagesLeft)!.Value)).ToArray();
        var indexed = watch.Elapsed.TotalMilliseconds;
        actual.ShouldBe(expected);
        output.WriteLine($"10,000 jobs / 1,000 lookups: full scan {fullScan:F2} ms; index build + lookups {indexed:F2} ms. No timing threshold.");
    }

    [Fact]
    public void No_samples_returns_unknown_and_large_estimate_does_not_overflow()
    {
        var now = DateTimeOffset.UtcNow;
        new AiQueueModel([], null, 1, 0).EtaSeconds(1, now, 1).ShouldBeNull();
        var model = new AiQueueModel([new(true, 0, now, int.MaxValue)], 30, 1, 0);
        model.EtaSeconds(1, now, 1).ShouldBe(int.MaxValue);
    }
}
