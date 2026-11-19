using HoSoSo.Domain.Catalog;
using HoSoSo.Domain.Entities;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Metadata.Builders;

namespace HoSoSo.Infrastructure.Persistence;

/// <summary>
/// Ánh xạ bảng ↔ lớp (BE-05, BE-06, BE-07). Tên cột do quy ước snake_case; ở đây chỉ khai báo
/// tên bảng, khóa, kiểu đặc biệt (jsonb, mảng, xmin) và cột có giá trị mặc định do CSDL cấp.
/// </summary>
internal static class ModelMapping
{
    public static void Apply(ModelBuilder m)
    {
        m.Entity<Organization>(e => { e.ToTable("organizations"); e.HasKey(x => x.Code); });
        m.Entity<Department>(e => { e.ToTable("departments"); e.HasKey(x => x.Code); });
        m.Entity<DepartmentScope>(e => { e.ToTable("department_scopes"); e.HasKey(x => new { x.DepartmentCode, x.OrganizationCode }); });
        m.Entity<WorkGroup>(e => { e.ToTable("work_groups"); e.HasKey(x => x.Code); });
        m.Entity<DocumentType>(e => { e.ToTable("document_types"); e.HasKey(x => x.Code); });
        m.Entity<FieldDefinition>(e => { e.ToTable("field_definitions"); e.HasKey(x => x.Code); });
        m.Entity<RetentionRule>(e => { e.ToTable("retention_rules"); e.HasKey(x => x.Id); e.Property(x => x.CreatedAt).HasDefaultValueSql("now()"); });
        m.Entity<Procedure>(e => { e.ToTable("procedures"); e.HasKey(x => x.Id); });
        m.Entity<ProcedureComponent>(e => { e.ToTable("procedure_components"); e.HasKey(x => x.Id); });
        m.Entity<FormTemplate>(e => { e.ToTable("form_templates"); e.HasKey(x => x.Id); });
        m.Entity<ProcedureComponentTemplate>(e => { e.ToTable("procedure_component_templates"); e.HasKey(x => new { x.ComponentId, x.TemplateId }); });
        m.Entity<ProcedureTemplate>(e => { e.ToTable("procedure_templates"); e.HasKey(x => new { x.ProcedureId, x.TemplateId }); });
        m.Entity<ProcedureLifecycleEvent>(e =>
        {
            e.ToTable("procedure_lifecycle_events"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.Evidence).HasColumnType("jsonb");
        });
        // BE-06/07: bảng tham chiếu và nhật ký còn lại.
        m.Entity<Role>(e => { e.ToTable("roles"); e.HasKey(x => x.Code); });
        m.Entity<Permission>(e => { e.ToTable("permissions"); e.HasKey(x => x.Code); });
        m.Entity<Source>(e => { e.ToTable("sources"); e.HasKey(x => x.Id); });
        m.Entity<WorkflowDefinition>(e => { e.ToTable("workflow_definitions"); e.HasKey(x => x.Code); });
        m.Entity<OrganizationName>(e => { e.ToTable("organization_names"); e.HasKey(x => x.Id); e.Property(x => x.Id).UseIdentityAlwaysColumn(); });
        m.Entity<PaperType>(e => { e.ToTable("paper_types"); e.HasKey(x => x.Code); e.Property(x => x.Names).HasColumnType("jsonb"); });
        m.Entity<ProcedureDepartment>(e => { e.ToTable("procedure_departments"); e.HasKey(x => new { x.ProcedureId, x.DepartmentCode, x.OrganizationCode }); });
        m.Entity<FormTemplateField>(e => { e.ToTable("form_template_fields"); e.HasKey(x => x.Id); e.Property(x => x.Bbox).HasColumnType("jsonb"); });
        m.Entity<DossierCodeSequence>(e => { e.ToTable("dossier_code_sequences"); e.HasKey(x => new { x.OrganizationCode, x.Year }); });
        m.Entity<DocumentAccessGrant>(e => { e.ToTable("document_access_grants"); e.HasKey(x => x.Id); e.Property(x => x.GrantedAt).HasDefaultValueSql("now()"); });
        m.Entity<AuthSession>(e =>
        {
            e.ToTable("auth_sessions"); e.HasKey(x => x.Id);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.Property(x => x.RenewedAt).HasDefaultValueSql("now()");
        });
        m.Entity<AccessEvent>(e =>
        {
            e.ToTable("access_events"); e.HasKey(x => new { x.Id, x.HappenedAt });
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.HappenedAt).HasDefaultValueSql("now()");
        });
        m.Entity<ErrorEvent>(e =>
        {
            e.ToTable("error_events"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.HappenedAt).HasDefaultValueSql("now()");
        });
        m.Entity<AuditEvent>(e =>
        {
            e.ToTable("audit_events"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.HappenedAt).HasDefaultValueSql("now()");
            e.Property(x => x.OldRow).HasColumnType("jsonb");
            e.Property(x => x.NewRow).HasColumnType("jsonb");
        });
        m.Entity<WorkflowState>(e => { e.ToTable("workflow_states"); e.HasKey(x => x.Code); });
        m.Entity<WorkflowTransition>(e =>
        {
            e.ToTable("workflow_transitions");
            e.HasKey(x => new { x.WorkflowCode, x.FromState, x.Action, x.ActorRole });
        });

        m.Entity<User>(e =>
        {
            e.ToTable("users"); e.HasKey(x => x.Id);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });
        m.Entity<UserRole>(e =>
        {
            e.ToTable("user_roles"); e.HasKey(x => x.Id);
            e.Property(x => x.ValidFrom).HasDefaultValueSql("now()");
        });
        m.Entity<Delegation>(e =>
        {
            e.ToTable("delegations"); e.HasKey(x => x.Id);
            e.Property(x => x.ValidFrom).HasDefaultValueSql("now()");
        });
        m.Entity<RolePermission>(e => { e.ToTable("role_permissions"); e.HasKey(x => new { x.RoleCode, x.PermissionCode }); });

        m.Entity<Document>(e =>
        {
            e.ToTable("documents"); e.HasKey(x => x.Id);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
            Xmin(e.Property(x => x.Version));
        });
        m.Entity<FileRecord>(e => { e.ToTable("files"); e.HasKey(x => x.Id); });
        m.Entity<DocumentClassification>(e =>
        {
            e.ToTable("document_classifications");
            e.HasKey(x => new { x.DocumentId, x.WorkGroupCode });
        });
        m.Entity<DocumentRelation>(e =>
        {
            e.ToTable("document_relations");
            e.HasKey(x => new { x.FromDocumentId, x.ToDocumentId, x.Relation });
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });
        m.Entity<DocumentSegment>(e => { e.ToTable("document_segments"); e.HasKey(x => x.Id); e.Property(x => x.CreatedAt).HasDefaultValueSql("now()"); });
        m.Entity<FileSignature>(e =>
        {
            e.ToTable("file_signatures"); e.HasKey(x => x.Id);
            e.Property(x => x.Details).HasColumnType("jsonb");
            e.Property(x => x.VerifiedAt).HasDefaultValueSql("now()");
        });
        m.Entity<DocumentFieldValue>(e =>
        {
            e.ToTable("document_field_values");
            e.HasKey(x => new { x.DocumentId, x.FieldDefinitionCode });
            e.Property(x => x.SourceRegion).HasColumnType("jsonb");
            Xmin(e.Property(x => x.Version));
        });

        m.Entity<Dossier>(e =>
        {
            e.ToTable("dossiers"); e.HasKey(x => x.Id);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.Property(x => x.UpdatedAt).HasDefaultValueSql("now()");
            Xmin(e.Property(x => x.Version));
        });
        m.Entity<DossierDocument>(e =>
        {
            e.ToTable("dossier_documents");
            e.HasKey(x => new { x.DossierId, x.DocumentId });
            e.Property(x => x.AddedAt).HasDefaultValueSql("now()");
        });
        m.Entity<DossierAssignment>(e =>
        {
            e.ToTable("dossier_assignments"); e.HasKey(x => x.Id);
            e.Property(x => x.AssignedAt).HasDefaultValueSql("now()");
        });
        m.Entity<WorkflowEvent>(e =>
        {
            e.ToTable("workflow_events"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.HappenedAt).HasDefaultValueSql("now()");
        });

        m.Entity<ScanBatch>(e =>
        {
            e.ToTable("scan_batches"); e.HasKey(x => x.Id);
            e.Property(x => x.OpenedAt).HasDefaultValueSql("now()");
        });
        m.Entity<QualityIssue>(e => { e.ToTable("quality_issues"); e.HasKey(x => x.Id); e.Property(x => x.RaisedAt).HasDefaultValueSql("now()"); });
        m.Entity<PageImage>(e => { e.ToTable("page_images"); e.HasKey(x => new { x.FileId, x.PageNo }); });
        m.Entity<OcrJob>(e =>
        {
            e.ToTable("ocr_jobs"); e.HasKey(x => x.Id);
            e.Property(x => x.Options).HasColumnType("jsonb");
            e.Property(x => x.Warnings).HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });
        m.Entity<OcrPage>(e => { e.ToTable("ocr_pages"); e.HasKey(x => new { x.JobId, x.PageNo }); });
        m.Entity<AiWorker>(e => { e.ToTable("ai_workers"); e.HasKey(x => x.WorkerId); });
        m.Entity<AiSuggestion>(e =>
        {
            e.ToTable("ai_suggestions"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });
        m.Entity<AiFieldSuggestion>(e =>
        {
            e.ToTable("ai_field_suggestions"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.SourceRegion).HasColumnType("jsonb");
        });

        m.Entity<SystemSetting>(e => { e.ToTable("system_settings"); e.HasKey(x => x.Key); e.Property(x => x.Value).HasColumnType("jsonb"); e.Property(x => x.UpdatedAt).HasDefaultValueSql("now()"); });
        m.Entity<AiModel>(e => { e.ToTable("ai_models"); e.HasKey(x => x.Key); });
        m.Entity<BackupRun>(e => { e.ToTable("backup_runs"); e.HasKey(x => x.Id); e.Property(x => x.StartedAt).HasDefaultValueSql("now()"); });
        m.Entity<StorageLocation>(e => { e.ToTable("storage_locations"); e.HasKey(x => x.Id); e.Property(x => x.CreatedAt).HasDefaultValueSql("now()"); });
        m.Entity<DossierLocationMove>(e =>
        {
            e.ToTable("dossier_location_moves"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.MovedAt).HasDefaultValueSql("now()");
        });
        m.Entity<Loan>(e => { e.ToTable("loans"); e.HasKey(x => x.Id); Xmin(e.Property(x => x.Version)); e.Property(x => x.RequestedAt).HasDefaultValueSql("now()"); });
        m.Entity<ArchiveSubmission>(e => { e.ToTable("archive_submissions"); e.HasKey(x => x.Id); Xmin(e.Property(x => x.Version)); e.Property(x => x.CreatedAt).HasDefaultValueSql("now()"); });
        m.Entity<ArchiveSubmissionItem>(e => { e.ToTable("archive_submission_items"); e.HasKey(x => new { x.SubmissionId, x.DossierId }); });
        m.Entity<ExportPackage>(e =>
        {
            e.ToTable("export_packages"); e.HasKey(x => x.Id);
            e.Property(x => x.Scope).HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });
        m.Entity<DisposalBlobDeletion>(e => { e.ToTable("disposal_blob_deletions"); e.HasKey(x => new { x.RequestId, x.StorageKey }); e.Property(x => x.NextAttemptAt).HasDefaultValueSql("now()"); });
        m.Entity<DisposalRequest>(e => { e.ToTable("disposal_requests"); e.HasKey(x => x.Id); Xmin(e.Property(x => x.Version)); e.Property(x => x.RequestedAt).HasDefaultValueSql("now()"); });
        m.Entity<Notification>(e =>
        {
            e.ToTable("notifications"); e.HasKey(x => x.Id);
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
        });
        m.Entity<OutboxMessage>(e =>
        {
            e.ToTable("outbox_messages"); e.HasKey(x => x.Id);
            e.Property(x => x.Id).UseIdentityAlwaysColumn();
            e.Property(x => x.Payload).HasColumnType("jsonb");
            e.Property(x => x.CreatedAt).HasDefaultValueSql("now()");
            e.Property(x => x.NextAttemptAt).HasDefaultValueSql("now()");
        });
    }

    /// <summary>xmin của PostgreSQL làm khóa lạc quan: không cần thêm cột, đổi sau mỗi lần sửa dòng.</summary>
    private static void Xmin(PropertyBuilder<uint> property) =>
        property.HasColumnName("xmin").HasColumnType("xid").ValueGeneratedOnAddOrUpdate().IsConcurrencyToken();
}
