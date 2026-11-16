using FluentValidation;

namespace HoSoSo.Application.Dossiers;

/// <summary>BE-10. Thông điệp tiếng Việt, nói rõ sửa thế nào.</summary>
public sealed class CreateDossierValidator : AbstractValidator<CreateDossierRequest>
{
    public static readonly string[] AccessLevels = ["internal", "restricted", "public"];
    public static readonly string[] Workflows = ["in_progress", "digitize_closed", "council"];

    public CreateDossierValidator()
    {
        RuleFor(x => x.Title).NotEmpty().WithMessage("Nhập tên hồ sơ.")
            .MinimumLength(5).WithMessage("Tên hồ sơ cần ít nhất 5 ký tự.")
            .MaximumLength(300).WithMessage("Tên hồ sơ tối đa 300 ký tự.");
        RuleFor(x => x.WorkGroupCode).NotEmpty().WithMessage("Chọn nhóm hồ sơ.");
        RuleFor(x => x.AccessLevel).Must(v => v is null || AccessLevels.Contains(v)).WithMessage("Mức truy cập chỉ nhận internal, restricted hoặc public.");
        RuleFor(x => x.WorkflowCode).Must(v => v is null || Workflows.Contains(v)).WithMessage("Quy trình không hợp lệ.");
        RuleFor(x => x.Notes).MaximumLength(4000).WithMessage("Ghi chú tối đa 4000 ký tự.");
        RuleFor(x => x.Year).InclusiveBetween(1900, 2200).When(x => x.Year is not null).WithMessage("Năm không hợp lệ.");
    }
}

public sealed class UpdateDossierValidator : AbstractValidator<UpdateDossierRequest>
{
    public UpdateDossierValidator()
    {
        RuleFor(x => x.Title).MinimumLength(5).MaximumLength(300).When(x => x.Title is not null).WithMessage("Tên hồ sơ từ 5 đến 300 ký tự.");
        RuleFor(x => x.AccessLevel).Must(v => v is null || CreateDossierValidator.AccessLevels.Contains(v)).WithMessage("Mức truy cập chỉ nhận internal, restricted hoặc public.");
        RuleFor(x => x.Notes).MaximumLength(4000).WithMessage("Ghi chú tối đa 4000 ký tự.");
    }
}

public sealed class AddDocumentValidator : AbstractValidator<AddDocumentRequest>
{
    public AddDocumentValidator()
    {
        RuleFor(x => x.DocumentId).NotEmpty().WithMessage("Chọn giấy tờ.");
        RuleFor(x => x.Direction).Must(v => v is null or "incoming" or "outgoing" or "internal").WithMessage("Chiều luân chuyển chỉ nhận incoming, outgoing hoặc internal.");
    }
}

public sealed class TransitionValidator : AbstractValidator<TransitionRequest>
{
    public TransitionValidator()
    {
        RuleFor(x => x.Action).Must(a => a is "submit" or "accept" or "escalate" or "return" or "decide" or "archive").WithMessage("Thao tác không hợp lệ.");
        RuleFor(x => x.Note).MaximumLength(4000).WithMessage("Ý kiến tối đa 4000 ký tự.");
    }
}

public sealed class AssignValidator : AbstractValidator<AssignRequest>
{
    public AssignValidator()
    {
        RuleFor(x => x.UserId).NotEmpty().WithMessage("Chọn người chủ trì.");
        RuleFor(x => x.Note).MaximumLength(1000).WithMessage("Ghi chú tối đa 1000 ký tự.");
    }
}
