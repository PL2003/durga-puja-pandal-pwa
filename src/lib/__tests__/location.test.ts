import { describe, expect, it } from "vitest";
import { OpenLocationCode } from "open-location-code";
import { extractFromGoogleMapsUrl, parseDecimalPair, resolveLocation } from "@/lib/location";
import { haversineMeters } from "@/lib/geo";

const DHAKA = { lat: 22.3569, lng: 91.7832 };
const REF = { lat: 22.356, lng: 91.783 };
const base = { location: "", latitude: "", longitude: "", refLat: null, refLng: null };

describe("parseDecimalPair", () => {
  it("parses comma-separated coordinates", () => {
    expect(parseDecimalPair("22.3569, 91.7832")).toEqual(DHAKA);
  });
  it("parses without trailing zeroes and with semicolons", () => {
    expect(parseDecimalPair("23.78; 90.407")).toEqual({ lat: 23.78, lng: 90.407 });
  });
  it("rejects out-of-range values", () => {
    expect(parseDecimalPair("123.5, 200")).toBeNull();
  });
  it("swaps clearly reversed lng,lat input", () => {
    expect(parseDecimalPair("91.7832, 22.3569")).toEqual(DHAKA);
  });
  it("returns null for non-numeric text", () => {
    expect(parseDecimalPair("Chattogram")).toBeNull();
  });
});

describe("extractFromGoogleMapsUrl", () => {
  it("extracts from ?q= links", () => {
    const u = new URL("https://www.google.com/maps?q=22.3569,91.7832");
    expect(extractFromGoogleMapsUrl(u)).toEqual(DHAKA);
  });
  it("prefers !3d/!4d place coordinates", () => {
    const u = new URL(
      "https://www.google.com/maps/place/X/@22.4,91.8,15z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d22.3569!4d91.7832"
    );
    expect(extractFromGoogleMapsUrl(u)).toEqual(DHAKA);
  });
  it("falls back to the @lat,lng viewport", () => {
    const u = new URL("https://www.google.com/maps/@22.3569,91.7832,17z");
    expect(extractFromGoogleMapsUrl(u)).toEqual(DHAKA);
  });
  it("returns null for place links without coordinates", () => {
    const u = new URL("https://www.google.com/maps/place/Some+Mandap/");
    expect(extractFromGoogleMapsUrl(u)).toBeNull();
  });
});

describe("resolveLocation", () => {
  it("prefers valid lat/lng columns", () => {
    const out = resolveLocation({ ...base, latitude: "22.3569", longitude: "91.7832" });
    expect(out).toMatchObject({ ok: true, lat: DHAKA.lat, lng: DHAKA.lng, kind: "columns" });
  });
  it("flags conflicting columns vs location field", () => {
    const out = resolveLocation({
      ...base,
      latitude: "22.3569",
      longitude: "91.7832",
      location: "23.7808, 90.4071",
    });
    if (out.ok) {
      expect(out.conflict).toBe(true);
    } else {
      throw new Error("expected ok outcome");
    }
  });
  it("decodes a full Plus Code near the encoded point", () => {
    const full = OpenLocationCode.encode(DHAKA.lat, DHAKA.lng);
    const out = resolveLocation({ ...base, location: full });
    if (!out.ok) throw new Error("expected ok");
    expect(haversineMeters(out, DHAKA)).toBeLessThan(20);
    expect(out.kind).toBe("plus-full");
  });
  it("refuses a short Plus Code without a reference", () => {
    const full = OpenLocationCode.encode(DHAKA.lat, DHAKA.lng);
    const short = OpenLocationCode.shorten(full, DHAKA.lat, DHAKA.lng);
    const out = resolveLocation({ ...base, location: short });
    expect(out.ok).toBe(false);
    if (!out.ok) expect(out.code).toBe("shortcode-no-reference");
  });
  it("recovers a short Plus Code with a reference coordinate", () => {
    const full = OpenLocationCode.encode(DHAKA.lat, DHAKA.lng);
    const short = OpenLocationCode.shorten(full, DHAKA.lat, DHAKA.lng);
    const out = resolveLocation({ ...base, location: short, refLat: REF.lat, refLng: REF.lng });
    if (!out.ok) throw new Error("expected ok");
    expect(out.kind).toBe("plus-short");
    expect(haversineMeters(out, DHAKA)).toBeLessThan(250);
  });
  it("rejects malformed Plus Codes", () => {
    const out = resolveLocation({ ...base, location: "9RW8+ZZZZ" });
    expect(out.ok).toBe(false);
  });
  it("rejects non-Google URLs", () => {
    const out = resolveLocation({ ...base, location: "https://example.com/x" });
    expect(!out.ok && out.code === "invalid-url").toBe(true);
  });
  it("reads coordinates from Google Maps URLs", () => {
    const out = resolveLocation({ ...base, location: "https://www.google.com/maps?q=22.3569,91.7832" });
    expect(out).toMatchObject({ ok: true, kind: "gmaps" });
  });
  it("reports missing location", () => {
    const out = resolveLocation(base);
    expect(!out.ok && out.code === "missing-location").toBe(true);
  });
});
