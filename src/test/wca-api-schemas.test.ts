import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { DiscoverResultSchema, CheckIdsResultSchema, JobStartResultSchema, WcaMemberSchema, ScrapeProfileSchema, safeParseDiscover, safeParseScrape, safeParseCheckIds, safeParseJobStart } from "@/lib/api/wcaAppApi.schemas";

/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
describe("wcaAppApi.schemas — runtime validation (Vol. II §5.3)", () => {
  describe("WcaMemberSchema", () => {
    it("accetta member minimo (id + name)", () => {
      expect(WcaMemberSchema.safeParse({ id: 1, name: "Acme" }).success).toBe(true);
    });

    it("rifiuta member senza id", () => {
      expect(WcaMemberSchema.safeParse({ name: "Acme" }).success).toBe(false);
    });

    it("accetta networks come array di stringhe", () => {
      const ok = WcaMemberSchema.safeParse({ id: 1, name: "X", networks: ["WCA First"] });
      expect(ok.success).toBe(true);
    });
  });

  describe("ScrapeProfileSchema", () => {
    it("passthrough campi sconosciuti", () => {
      const r = ScrapeProfileSchema.safeParse({
        wca_id: 1,
        company_name: "X",
        custom_extra_field_2030: "futuro",
      });
      expect(r.success).toBe(true);
      expect((r.success && r.data) as any).toMatchObject({ custom_extra_field_2030: "futuro" });
    });

    it("logo_url può essere null", () => {
      expect(ScrapeProfileSchema.safeParse({ wca_id: 1, logo_url: null }).success).toBe(true);
    });

    it("contacts può essere array di oggetti parziali", () => {
      const r = ScrapeProfileSchema.safeParse({
        wca_id: 1,
        contacts: [{ name: "Mario" }, { email: "x@y.it" }, {}],
      });
      expect(r.success).toBe(true);
    });
  });

  describe("DiscoverResultSchema", () => {
    it("accetta risposta valida con 0 membri", () => {
      const r = DiscoverResultSchema.safeParse({
        success: true,
        members: [],
        page: 1,
        hasNext: false,
        totalResults: 0,
      });
      expect(r.success).toBe(true);
    });

    it("totalResults può essere null", () => {
      const r = DiscoverResultSchema.safeParse({
        success: true,
        members: [{ id: 1, name: "X" }],
        page: 1,
        hasNext: true,
        totalResults: null,
      });
      expect(r.success).toBe(true);
    });

    it("rifiuta se members non è array", () => {
      const r = DiscoverResultSchema.safeParse({
        success: true,
        members: "broken",
        page: 1,
        hasNext: false,
        totalResults: null,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("CheckIdsResultSchema", () => {
    it("accetta missing come array di numeri", () => {
      const r = CheckIdsResultSchema.safeParse({
        success: true,
        total_in_db: 100,
        checked: 50,
        found: 47,
        missing: [1, 2, 3],
        elapsed_ms: 42,
      });
      expect(r.success).toBe(true);
    });

    it("rifiuta missing con stringhe", () => {
      const r = CheckIdsResultSchema.safeParse({
        success: true,
        total_in_db: 100,
        checked: 50,
        found: 47,
        missing: ["a"],
        elapsed_ms: 42,
      });
      expect(r.success).toBe(false);
    });
  });

  describe("JobStartResultSchema", () => {
    it("accetta action enum", () => {
      expect(
        JobStartResultSchema.safeParse({ success: true, action: "paused" }).success
      ).toBe(true);
      expect(
        JobStartResultSchema.safeParse({ success: true, action: "resumed" }).success
      ).toBe(true);
    });

    it("rifiuta action sconosciuta", () => {
      expect(
        JobStartResultSchema.safeParse({ success: true, action: "exploded" }).success
      ).toBe(false);
    });
  });

  describe("safeParse* — best-effort, no throw", () => {
    let warnSpy: any;

    beforeEach(() => {
      warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
    });

    it("safeParseDiscover ritorna null su payload invalido", () => {
      const r = safeParseDiscover({ success: "boom" });
      expect(r).toBeNull();
    });

    it("safeParseDiscover ritorna data su payload valido", () => {
      const r = safeParseDiscover({
        success: true,
        members: [],
        page: 1,
        hasNext: false,
        totalResults: 0,
      });
      expect(r).not.toBeNull();
      expect(r?.page).toBe(1);
    });

    it("safeParseScrape gestisce risultati assenti", () => {
      const r = safeParseScrape({ success: false, error: "auth" });
      expect(r).not.toBeNull();
      expect(r?.success).toBe(false);
    });

    it("safeParseCheckIds ritorna null su null", () => {
      expect(safeParseCheckIds(null)).toBeNull();
    });

    it("safeParseJobStart non lancia su undefined", () => {
      expect(() => safeParseJobStart(undefined)).not.toThrow();
      expect(safeParseJobStart(undefined)).toBeNull();
    });
  });
});
