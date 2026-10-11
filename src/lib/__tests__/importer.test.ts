import { describe, expect, it } from "vitest";
import { buildColumnMap, missingRequiredColumns, parseSheet } from "@/lib/importer";

const OPTS = { sourceId: "s1", refLat: null, refLng: null };

describe("buildColumnMap", () => {
  it("matches aliases case-insensitively and trims whitespace", () => {
    const { map } = buildColumnMap([" Name ", "GOOGLE MAPS LINK", "Address"]);
    expect(map.name).toBe(0);
    expect(map.location).toBe(1);
    expect(map.address).toBe(2);
  });
  it("supports lat/lng split columns", () => {
    const { map } = buildColumnMap(["Mandap", "Lat", "Long"]);
    expect(map.name).toBe(0);
    expect(map.latitude).toBe(1);
    expect(map.longitude).toBe(2);
  });
  it("reports missing required columns", () => {
    const { map } = buildColumnMap(["Address", "Notes"]);
    expect(missingRequiredColumns(map)).toContain("name");
  });
});

describe("parseSheet", () => {
  it("imports well-formed rows with coordinates", () => {
    const csv = "name,location,address\nDhakeshwari Temple,\"22.7229, 90.3962\",Dhaka\nRamna Kali,7JCR9RX4+XX,Ramna";
    const out = parseSheet(csv, OPTS);
    expect(out.mandaps).toHaveLength(2);
    expect(out.mandaps[0].lat).toBeCloseTo(22.7229, 4);
    expect(out.mandaps[1].locationKind).toBe("plus-full");
    expect(out.issues).toHaveLength(0);
    expect(out.mandaps[0].row).toBe(2);
  });

  it("flags rows without names with their sheet row number", () => {
    const csv = "name,location\nValid One,\"23.7, 90.4\"\n,\"23.8, 90.5\"";
    const out = parseSheet(csv, OPTS);
    expect(out.mandaps).toHaveLength(1);
    expect(out.issues.some((i) => i.code === "missing-name" && i.row === 3)).toBe(true);
  });

  it("flags invalid locations but keeps the record named", () => {
    const csv = "name,location\nBroken Row,not-a-location";
    const out = parseSheet(csv, OPTS);
    expect(out.mandaps).toHaveLength(1);
    expect(out.mandaps[0].lat).toBeNull();
    expect(out.issues[0].row).toBe(2);
  });

  it("returns missing-columns for structurally invalid sheets", () => {
    const out = parseSheet("foo,bar\n1,2", OPTS);
    expect(out.mandaps).toHaveLength(0);
    expect(out.issues.some((i) => i.code === "missing-columns")).toBe(true);
  });

  it("handles duplicate id values deterministically", () => {
    const csv = "id,name,location\nA,One,\"23.7, 90.4\"\nA,Two,\"23.8, 90.5\"";
    const out = parseSheet(csv, OPTS);
    expect(out.mandaps).toHaveLength(2);
    expect(new Set(out.mandaps.map((m) => m.recordKey)).size).toBe(2);
    expect(out.issues.some((i) => i.code === "duplicate")).toBe(true);
  });

  it("uses the id column as stable identity and row ids otherwise", () => {
    const csv = "id,name,latitude,longitude\nx-9,With Id,23.7,90.4\n,No Id,23.8,90.5";
    const out = parseSheet(csv, OPTS);
    expect(out.mandaps[0].recordKey).toBe("id-x-9");
    expect(out.mandaps[1].recordKey).toBe("row-3");
    expect(out.mandaps[0].locationKind).toBe("columns");
  });
});
