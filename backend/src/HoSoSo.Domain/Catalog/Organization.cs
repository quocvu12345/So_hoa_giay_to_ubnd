namespace HoSoSo.Domain.Catalog;

/// <summary>Bảng hoso.organizations. Mã: tl-ubnd, tl-hdnd.</summary>
public sealed class Organization
{
    public required string Code { get; init; }
    public required string Name { get; set; }
    /// <summary>UBND hoặc HDND.</summary>
    public required string Kind { get; init; }
    public required string Locality { get; set; }
}
