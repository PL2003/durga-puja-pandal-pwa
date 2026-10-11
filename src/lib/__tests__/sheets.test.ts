import { describe, expect, it } from "vitest";
import { parseSheetUrl, revisionOf } from "@/lib/sheets";

describe("parseSheetUrl", () => {
  it("parses standard edit links with gid in the hash", () => {
    const r = parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd/edit#gid=42");
    expect(r.ok).toBe(true);
    expect(r.kind).toBe("standard");
    expect(r.gid).toBe("42");
    expect(r.csvUrl).toContain("/export?format=csv&gid=42");
  });
  it("parses published links", () => {
    const r = parseSheetUrl(
      "https://docs.google.com/spreadsheets/d/e/2PACX-1vAbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcdefghij/pubhtml?gid=7&single=true"
    );
    expect(r.ok).toBe(true);
    expect(r.kind).toBe("published");
    expect(r.gid).toBe("7");
    expect(r.csvUrl).toContain("/pub?gid=7&single=true&output=csv");
  });
  it("defaults gid to 0", () => {
    const r = parseSheetUrl("https://docs.google.com/spreadsheets/d/1AbCdEfGhIjKlMnOpQrStUvWxYz1234567890abcd");
    expect(r.ok).toBe(true);
    expect(r.gid).toBe("0");
  });
  it("rejects non-Google hosts", () => {
    expect(parseSheetUrl("https://evil.example/spreadsheets/d/x").ok).toBe(false);
  });
  it("rejects garbage input", () => {
    expect(parseSheetUrl("hello world").ok).toBe(false);
    expect(parseSheetUrl("").ok).toBe(false);
  });
});

describe("revisionOf", () => {
  it("is stable and change-sensitive", () => {
    const a = revisionOf("a,b,c\n1,2,3");
    expect(revisionOf("a,b,c\n1,2,3")).toBe(a);
    expect(revisionOf("a,b,c\n1,2,4")).not.toBe(a);
  });
});
