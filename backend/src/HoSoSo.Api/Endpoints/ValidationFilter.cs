using System.Text.Json;
using FluentValidation;

namespace HoSoSo.Api.Endpoints;

/// <summary>BE-10. Chạy FluentValidation cho nội dung gửi lên; lỗi trả 400 kèm errors theo tên trường camelCase.</summary>
internal sealed class ValidationFilter<T> : IEndpointFilter where T : class
{
    public async ValueTask<object?> InvokeAsync(EndpointFilterInvocationContext context, EndpointFilterDelegate next)
    {
        var argument = context.Arguments.OfType<T>().FirstOrDefault()
            ?? throw new ValidationFailedException(new Dictionary<string, string[]> { ["body"] = ["Thiếu nội dung yêu cầu."] });
        var validator = context.HttpContext.RequestServices.GetService<IValidator<T>>();
        if (validator is not null)
        {
            var result = await validator.ValidateAsync(argument, context.HttpContext.RequestAborted);
            if (!result.IsValid)
            {
                var errors = result.Errors.GroupBy(e => JsonNamingPolicy.CamelCase.ConvertName(e.PropertyName))
                    .ToDictionary(g => g.Key, g => g.Select(e => e.ErrorMessage).Distinct().ToArray());
                throw new ValidationFailedException(errors);
            }
        }
        return await next(context);
    }
}

internal static class ValidationExtensions
{
    public static RouteHandlerBuilder Validate<T>(this RouteHandlerBuilder builder) where T : class =>
        builder.AddEndpointFilter<ValidationFilter<T>>();
}
