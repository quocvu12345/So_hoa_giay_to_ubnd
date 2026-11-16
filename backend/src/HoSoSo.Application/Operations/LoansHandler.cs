using FluentValidation;
using HoSoSo.Application.Common;
using HoSoSo.Domain.Entities;
using HoSoSo.Domain.Identity;
using Microsoft.EntityFrameworkCore;

namespace HoSoSo.Application.Operations;

public sealed record LoanDto(Guid Id, Guid DossierId, string DossierCode, string DossierTitle, Guid BorrowerId, string BorrowerName, string Purpose, string Status,
    DateTimeOffset RequestedAt, DateOnly? DueOn, DateTimeOffset? LentAt, DateTimeOffset? ReturnedAt, string ConditionNote, string DecisionNote, bool Overdue);
public sealed record RequestLoanRequest(Guid DossierId, string Purpose, DateOnly? DueOn);
public sealed record ApproveLoanRequest(DateOnly? DueOn, string? Note);
public sealed record RejectLoanRequest(string Note);
public sealed record ReturnLoanRequest(string? ConditionNote);

/// <summary>
/// BE-83. Mượn trả bản giấy: đề nghị → duyệt → giao → trả (hoặc từ chối). Một hồ sơ chỉ có một khoản mượn đang hiệu lực (chỉ mục duy nhất,
/// nên hai người cùng đề nghị cũng chỉ một người được duyệt). Khoản đang mượn quá hạn được chuyển "overdue" mỗi ngày (DueReminderService).
/// </summary>
public sealed class LoansHandler(IHoSoDb db, IScopeFilter scope, ICurrentUser user, IClock clock)
{
    public static readonly TimeSpan MaxLoan = TimeSpan.FromDays(90);
    public static readonly TimeSpan DefaultLoan = TimeSpan.FromDays(14);
    private static readonly TimeSpan Vietnam = TimeSpan.FromHours(7);

    public async Task<IReadOnlyList<LoanDto>> ListAsync(string? status, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var canApprove = user.Has(Permissions.LoanApprove);
        var organization = user.OrganizationCode;
        var query = from l in db.Read<Loan>()
                    join d in db.Read<Dossier>() on l.DossierId equals d.Id
                    join b in db.Read<User>() on l.BorrowerId equals b.Id
                    where l.BorrowerId == me || (canApprove && d.OrganizationCode == organization)
                    select new { l, d, b };
        if (status is { Length: > 0 }) query = query.Where(x => x.l.Status == status);
        var rows = await query.OrderByDescending(x => x.l.RequestedAt).Take(300).ToListAsync(ct);
        return rows.Select(x => ToDto(x.l, x.d, x.b)).ToList();
    }

    public async Task<LoanDto> RequestAsync(RequestLoanRequest r, CancellationToken ct)
    {
        var me = user.RequireUserId();
        var dossier = await scope.Dossiers(db.Read<Dossier>()).SingleOrDefaultAsync(d => d.Id == r.DossierId, ct) ?? throw AppException.NotFound("hồ sơ");
        var active = await db.Read<Loan>().Where(l => l.DossierId == r.DossierId && (l.Status == LoanStatus.Approved || l.Status == LoanStatus.Lent || l.Status == LoanStatus.Overdue))
            .Select(l => new { l.Status, l.DueOn }).FirstOrDefaultAsync(ct);
        if (active is not null) throw LoanConflict(active.Status, active.DueOn);
        if (r.DueOn is { } due && due < Today()) throw new ValidationFailedException(new Dictionary<string, string[]> { ["dueOn"] = ["Hạn trả phải từ hôm nay trở đi."] });
        var loan = new Loan { DossierId = r.DossierId, BorrowerId = me, Purpose = r.Purpose.Trim(), DueOn = r.DueOn };
        db.Set<Loan>().Add(loan);
        Notify("loan.requested", loan, dossier.OrganizationCode);
        await db.SaveChangesAsync(ct);
        return await GetAsync(loan.Id, ct);
    }

    public async Task<LoanDto> ApproveAsync(Guid id, ApproveLoanRequest r, CancellationToken ct)
    {
        var (loan, dossier) = await LoadAsync(id, ct);
        Require(loan, LoanStatus.Requested, "Chỉ duyệt được đề nghị đang chờ.");
        var due = r.DueOn ?? Today().AddDays((int)DefaultLoan.TotalDays);
        if (due < Today() || due > Today().AddDays((int)MaxLoan.TotalDays))
            throw new ValidationFailedException(new Dictionary<string, string[]> { ["dueOn"] = [$"Hạn trả từ hôm nay đến tối đa {MaxLoan.TotalDays:0} ngày."] });
        loan.Status = LoanStatus.Approved;
        loan.ApprovedBy = user.RequireUserId();
        loan.ApprovedAt = clock.UtcNow;
        loan.DueOn = due;
        loan.DecisionNote = r.Note?.Trim() ?? "";
        Notify("loan.approved", loan, dossier.OrganizationCode);
        await db.SaveChangesAsync(ct);      // đã có khoản khác đang hiệu lực: chỉ mục duy nhất → 409 loan_conflict
        return await GetAsync(id, ct);
    }

    public async Task<LoanDto> RejectAsync(Guid id, RejectLoanRequest r, CancellationToken ct)
    {
        var (loan, dossier) = await LoadAsync(id, ct);
        Require(loan, LoanStatus.Requested, "Chỉ từ chối được đề nghị đang chờ.");
        loan.Status = LoanStatus.Rejected;
        loan.DecisionNote = r.Note.Trim();
        Notify("loan.rejected", loan, dossier.OrganizationCode);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<LoanDto> LendAsync(Guid id, CancellationToken ct)
    {
        var (loan, dossier) = await LoadAsync(id, ct);
        Require(loan, LoanStatus.Approved, "Chỉ giao được khoản mượn đã duyệt.");
        loan.Status = LoanStatus.Lent;
        loan.LentAt = clock.UtcNow;
        Notify("loan.lent", loan, dossier.OrganizationCode);
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<LoanDto> ReturnAsync(Guid id, ReturnLoanRequest r, CancellationToken ct)
    {
        var (loan, _) = await LoadAsync(id, ct);
        if (loan.Status is not (LoanStatus.Lent or LoanStatus.Overdue)) throw AppException.Conflict("Chỉ nhận trả được khoản đang mượn hoặc quá hạn.");
        loan.Status = LoanStatus.Returned;
        loan.ReturnedAt = clock.UtcNow;
        loan.ConditionNote = r.ConditionNote?.Trim() ?? "";
        await db.SaveChangesAsync(ct);
        return await GetAsync(id, ct);
    }

    public async Task<LoanDto> GetAsync(Guid id, CancellationToken ct)
    {
        var x = await (from l in db.Read<Loan>() join d in db.Read<Dossier>() on l.DossierId equals d.Id join b in db.Read<User>() on l.BorrowerId equals b.Id
                       where l.Id == id select new { l, d, b }).SingleOrDefaultAsync(ct) ?? throw AppException.NotFound("khoản mượn");
        return ToDto(x.l, x.d, x.b);
    }

    // ---- nội bộ ----
    /// <summary>Thao tác của người duyệt: khoản mượn phải thuộc hồ sơ của cơ quan mình.</summary>
    private async Task<(Loan Loan, Dossier Dossier)> LoadAsync(Guid id, CancellationToken ct)
    {
        var loan = await db.Set<Loan>().SingleOrDefaultAsync(l => l.Id == id, ct) ?? throw AppException.NotFound("khoản mượn");
        var dossier = await db.Read<Dossier>().SingleAsync(d => d.Id == loan.DossierId, ct);
        if (dossier.OrganizationCode != user.OrganizationCode) throw AppException.NotFound("khoản mượn");
        return (loan, dossier);
    }

    private static void Require(Loan loan, string status, string message)
    {
        if (loan.Status != status) throw AppException.Conflict(message);
    }

    private void Notify(string type, Loan loan, string organization) =>
        db.Set<OutboxMessage>().Add(new OutboxMessage
        {
            Type = type,
            Payload = System.Text.Json.JsonSerializer.Serialize(new { loanId = loan.Id, dossierId = loan.DossierId, borrowerId = loan.BorrowerId, organization, actorId = user.UserId }),
        });

    private DateOnly Today() => DateOnly.FromDateTime(clock.UtcNow.ToOffset(Vietnam).DateTime);

    private static AppException LoanConflict(string status, DateOnly? due) => new(409, "loan_conflict",
        status == LoanStatus.Approved ? "Hồ sơ này đã có khoản mượn được duyệt, chờ giao." : $"Hồ sơ này đang được mượn{(due is { } d ? $" (hạn trả {d:dd/MM/yyyy})" : "")}. Đề nghị lại sau khi hồ sơ được trả.");

    private LoanDto ToDto(Loan l, Dossier d, User b) => new(l.Id, l.DossierId, d.Code, d.Title, l.BorrowerId, b.DisplayName, l.Purpose, l.Status, l.RequestedAt,
        l.DueOn, l.LentAt, l.ReturnedAt, l.ConditionNote, l.DecisionNote, l.Status == LoanStatus.Overdue);
}

public sealed class RequestLoanValidator : AbstractValidator<RequestLoanRequest>
{
    public RequestLoanValidator()
    {
        RuleFor(x => x.DossierId).NotEmpty().WithMessage("Chọn hồ sơ cần mượn.");
        RuleFor(x => x.Purpose).Must(v => v is not null && v.Trim().Length >= 5).WithMessage("Nêu mục đích mượn (ít nhất 5 ký tự).").MaximumLength(500).WithMessage("Mục đích tối đa 500 ký tự.");
    }
}

public sealed class RejectLoanValidator : AbstractValidator<RejectLoanRequest>
{
    public RejectLoanValidator() => RuleFor(x => x.Note).Must(v => v is not null && v.Trim().Length >= 5).WithMessage("Từ chối cần ghi lý do (ít nhất 5 ký tự).");
}
