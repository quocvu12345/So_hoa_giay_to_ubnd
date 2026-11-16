using FluentValidation;
using HoSoSo.Application.Admin;
using HoSoSo.Application.Catalog;
using HoSoSo.Application.Documents;
using HoSoSo.Application.Dossiers;
using HoSoSo.Application.Intake;
using HoSoSo.Application.Notifications;
using HoSoSo.Application.Operations;
using HoSoSo.Application.Procedures;
using HoSoSo.Application.Search;
using Microsoft.Extensions.DependencyInjection;

namespace HoSoSo.Application;

public static class DependencyInjection
{
    public static IServiceCollection AddHoSoApplication(this IServiceCollection services)
    {
        services.AddValidatorsFromAssemblyContaining<CreateDossierValidator>(ServiceLifetime.Singleton);
        services.AddScoped<CatalogHandler>();
        services.AddScoped<DossierQueries>();
        services.AddScoped<ProceduresHandler>();
        services.AddScoped<DossierCommands>();
        services.AddScoped<IntakeHandler>();
        services.AddScoped<JobsHandler>();
        services.AddScoped<QualityHandler>();
        services.AddScoped<ReviewHandler>();
        services.AddScoped<RelationsHandler>();
        services.AddScoped<SegmentsHandler>();
        services.AddScoped<SignaturesHandler>();
        services.AddScoped<FileContentHandler>();
        services.AddScoped<PreviewHandler>();
        services.AddScoped<NotificationsHandler>();
        services.AddScoped<AdminHandler>();
        services.AddScoped<AdminOpsHandler>();
        services.AddScoped<BackupMonitor>();
        services.AddScoped<CatalogAdminHandler>();
        services.AddScoped<SearchHandler>();
        services.AddScoped<StorageHandler>();
        services.AddScoped<LoansHandler>();
        services.AddScoped<ArchiveHandler>();
        services.AddScoped<ExportHandler>();
        services.AddScoped<DisposalHandler>();
        return services;
    }
}
