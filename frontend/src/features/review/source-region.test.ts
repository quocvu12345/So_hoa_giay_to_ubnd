import { describe, expect, it } from "vitest";
import { encodeRegionParam, isValidRegion, parseRegionParam, regionStyle, regionTarget, type SourceRegion } from "./source-region";

const region: SourceRegion = { page: 2, x: 0.58, y: 0.84, width: 0.32, height: 0.025, approximate: false };

describe("isValidRegion", () => {
  it("nhận vùng nằm trong trang", () => {
    expect(isValidRegion(region)).toBe(true);
    expect(isValidRegion({ ...region, x: 0.6, width: 0.4 })).toBe(true);
  });

  it("từ chối vùng sai: ngoài trang, không diện tích, không phải số, trang < 1", () => {
    for (const bad of [{ ...region, x: -0.1 }, { ...region, width: 0 }, { ...region, height: -1 }, { ...region, x: 0.9, width: 0.3 }, { ...region, y: 1.2 }, { ...region, page: 0 }, { ...region, page: 1.5 }, { ...region, x: Number.NaN }]) {
      expect(isValidRegion(bad)).toBe(false);
    }
    expect(isValidRegion(null)).toBe(false);
    expect(isValidRegion(undefined)).toBe(false);
  });
});

describe("regionStyle", () => {
  it("đặt khung theo phần trăm, có đệm nhỏ và không tràn ra ngoài trang", () => {
    const style = regionStyle(region);
    expect(style).toEqual({ left: "57.60%", top: "83.60%", width: "32.80%", height: "3.30%" });
    const edge = regionStyle({ ...region, x: 0, y: 0, width: 1, height: 1 });
    expect(edge).toEqual({ left: "0.00%", top: "0.00%", width: "100.00%", height: "100.00%" });
  });
});

describe("tham số ?vung=", () => {
  it("mã hóa rồi đọc lại ra đúng vùng, giữ cờ ước", () => {
    expect(encodeRegionParam(region)).toBe("0.58,0.84,0.32,0.025");
    expect(parseRegionParam(encodeRegionParam(region), 2)).toEqual(region);
    const approx = { ...region, approximate: true };
    expect(encodeRegionParam(approx)).toBe("0.58,0.84,0.32,0.025,u");
    expect(parseRegionParam(encodeRegionParam(approx), 2)).toEqual(approx);
  });

  it("bỏ qua tham số hỏng thay vì dựng khung sai", () => {
    for (const bad of [undefined, "", "1,2,3", "a,b,c,d", "0.1,0.1,2,0.1", "0.1,0.1,0.1,0.1,x,y", "0.1,0.1,0,0.1"]) expect(parseRegionParam(bad, 1)).toBeNull();
    expect(parseRegionParam("0.1,0.1,0.2,0.2,u", 3)?.page).toBe(3);
  });
});

describe("regionTarget", () => {
  const field = { sourceRegion: region, sourcePages: [2] };

  it("vùng trên bản hiện hành (hoặc không ghi bản) thì dựng khung ở trang của vùng", () => {
    expect(regionTarget(field, "file-2")).toEqual({ region, page: 2, olderScanId: null });
    expect(regionTarget({ ...field, sourceFileId: "file-2" }, "file-2")).toEqual({ region, page: 2, olderScanId: null });
    expect(regionTarget({ ...field, sourceFileId: null }, "file-2").region).toEqual(region);
  });

  it("vùng trên bản quét cũ thì không dựng khung và không nhảy sang trang của bản cũ", () => {
    expect(regionTarget({ ...field, sourceFileId: "file-1" }, "file-2")).toEqual({ region: null, page: 2, olderScanId: "file-1" });
  });

  it("trường không có vùng (AI không biết) vẫn nhảy tới trang nguồn; vùng hỏng bị bỏ", () => {
    expect(regionTarget({ sourceRegion: null, sourcePages: [3] }, "file-2")).toEqual({ region: null, page: 3, olderScanId: null });
    expect(regionTarget({ sourceRegion: { ...region, width: 0 }, sourcePages: [3] }, "file-2")).toEqual({ region: null, page: 3, olderScanId: null });
    expect(regionTarget({ sourcePages: [] }, undefined)).toEqual({ region: null, page: null, olderScanId: null });
  });
});
