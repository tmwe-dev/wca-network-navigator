import { describe, it, expect } from "vitest";
import { buildDeterministicId } from "@/lib/messageDedup";
import { capitalizeFirst } from "@/lib/capitalize";
import { queryKeys } from "@/lib/queryKeys";

describe("messageDedup — buildDeterministicId", () => {
  it("produce stesso ID per stesso input", () => {
    const a = buildDeterministicId("wa", "Mario", "Ciao", "2026-04-08");
    const b = buildDeterministicId("wa", "Mario", "Ciao", "2026-04-08");
    expect(a).toBe(b);
  });

  it("ID diverso al cambio di prefix, contact, text, timestamp", () => {
    const base = buildDeterministicId("wa", "Mario", "ciao", "ts1");
    expect(base).not.toBe(buildDeterministicId("li", "Mario", "ciao", "ts1"));
    expect(base).not.toBe(buildDeterministicId("wa", "Luca", "ciao", "ts1"));
    expect(base).not.toBe(buildDeterministicId("wa", "Mario", "addio", "ts1"));
    expect(base).not.toBe(buildDeterministicId("wa", "Mario", "ciao", "ts2"));
  });

  it("normalizza spazi e case nel contact/text", () => {
    const a = buildDeterministicId("wa", "  Mario  Rossi  ", "Hello world", "");
    const b = buildDeterministicId("wa", "mario rossi", "hello   world", "");
    expect(a).toBe(b);
  });

  it("gestisce caratteri unicode (CJK, arabo, thai, emoji)", () => {
    expect(() => buildDeterministicId("wa", "山田", "こんにちは 🎉", "")).not.toThrow();
    const cjk = buildDeterministicId("wa", "山田", "こんにちは", "ts");
    const arabic = buildDeterministicId("wa", "محمد", "مرحبا", "ts");
    expect(cjk).not.toBe(arabic);
    expect(cjk.length).toBeGreaterThan(0);
  });

  it("inizia col prefix e contiene il contact normalizzato", () => {
    const id = buildDeterministicId("wa_out", "Acme Logistics", "Hi", "");
    expect(id.startsWith("wa_out_")).toBe(true);
    expect(id).toContain("acme logistics");
  });

  it("rimuove pipe dai contact per evitare collisioni con separator", () => {
    const a = buildDeterministicId("wa", "Mario|Rossi", "x", "");
    expect(a).not.toContain("|");
  });

  it("tronca contact lunghi (≥50 char)", () => {
    const long = "a".repeat(200);
    const id = buildDeterministicId("wa", long, "x", "");
    // safeContact tronca a 50
    const parts = id.split("_");
    const contactPart = parts.slice(1, -1).join("_");
    expect(contactPart.length).toBeLessThanOrEqual(50);
  });
});

describe("capitalizeFirst", () => {
  it("capitalizza primo carattere", () => {
    expect(capitalizeFirst("hello")).toBe("Hello");
    expect(capitalizeFirst("ITALY")).toBe("ITALY");
  });

  it("ritorna input invariato su empty/null", () => {
    expect(capitalizeFirst("")).toBe("");
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- test mock
    expect(capitalizeFirst(null as any)).toBeNull();
  });

  it("preserva il resto della stringa", () => {
    expect(capitalizeFirst("mario rossi")).toBe("Mario rossi");
  });
});

describe("queryKeys factory", () => {
  it("partners.all è una tupla stabile", () => {
    expect(queryKeys.partners.all).toEqual(["partners"]);
  });

  it("partners.filtered include i filtri", () => {
    const k = queryKeys.partners.filtered({ country: "IT" });
    expect(k).toEqual(["partners", { country: "IT" }]);
  });

  it("partner(id) ritorna tupla con id", () => {
    expect(queryKeys.partner("abc")).toEqual(["partner", "abc"]);
  });

  it("countryStats e partnerStats sono tuple costanti", () => {
    expect(queryKeys.countryStats).toEqual(["country-stats"]);
    expect(queryKeys.partnerStats).toEqual(["partner-stats"]);
  });

  it("directoryCache include entrambi gli array", () => {
    const k = queryKeys.directoryCache(["IT", "DE"], ["WCA First"]);
    expect(k).toEqual(["directory-cache", ["IT", "DE"], ["WCA First"]]);
  });

  it("dbPartnersForCountries / noProfileWcaIds sono parametriche", () => {
    expect(queryKeys.dbPartnersForCountries(["IT"])).toEqual(["db-partners-for-countries", ["IT"]]);
    expect(queryKeys.noProfileWcaIds(["DE"])).toEqual(["no-profile-wca-ids", ["DE"]]);
  });

  it("downloadJobs e userCredits sono tuple costanti", () => {
    expect(queryKeys.downloadJobs).toEqual(["download-jobs"]);
    expect(queryKeys.userCredits).toEqual(["user-credits"]);
  });
});
