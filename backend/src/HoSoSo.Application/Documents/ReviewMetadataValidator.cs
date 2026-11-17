using FluentValidation;

namespace HoSoSo.Application.Documents;

public sealed class ReviewMetadataValidator : AbstractValidator<ReviewMetadataRequest>
{
    public ReviewMetadataValidator()
    {
        RuleFor(x => x.Version).GreaterThan(0u);
        RuleFor(x => x.Title).NotEmpty().MaximumLength(2000);
        RuleFor(x => x.DocumentForm).NotEmpty().MaximumLength(200);
        RuleFor(x => x.DocumentNumber).MaximumLength(200);
        RuleFor(x => x.Note).MaximumLength(2000);
    }
}
