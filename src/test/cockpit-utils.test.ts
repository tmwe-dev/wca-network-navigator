import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { groupByCountry } from "@/lib/groupByCountry";
import {
  addCockpitPreselection,
  consumeCockpitPreselection,
  getCockpitPreselection,
} from "@/lib/cockpitPreselection";
import {
  asEnrichment,
  getRealLogoUrl,
  getEffectiveLogoUrl,
  getEnrichmentSnippet,
  hasLinkedIn,
  hasWhatsApp,
  getBranchCountries,
  sortPartners,
} from "@/lib/partnerUtils";

// ─── groupByCountry ──────────────────────────────────────────

describe("groupByCountry", () => {
  type Row = { code: string; name: string; v: number };
  const items: Row[] = [
    { code: "IT", name: "Italy", v: 1 },
    { code: "DE", name: "Germany", v: 2 },
    { code: "IT", name: "Italy", v: 3 },
    { code: "IT", name: "Italy", v: 4 },
    { code: "DE", name: "Germany", v: 5 },
  ];

  it("raggruppa per code e ordina per dimensione discendente", () => {
    const groups = groupByCountry(items, (i) => i.code, (i) => i.name);
    expect(groups).toHaveLength(2);
    expect(groups[0].countryCode).toBe("IT");
    expect(groups[0].items).toHaveLength(3);
    expect(groups[1].countryCode).toBe("DE");
    expect(groups[1].items).toHaveLength(2);
  });

  it("usa '??' per code mancante e 'Sconosciuto' per nome", () => {
    const out = groupByCountry(
      [{ code: "", name: "", v: 1 }],
      (i) => i.code,
      (i) => i.name
    );
    expect(out[0].countryCode).toBe("??");
    expect(out[0].countryName).toBe("Sconosciuto");
  });

  it("ritorna array vuoto su input vuoto", () => {
    expect(groupByCountry([], (i: any) => i.code, (i: any) => i.name)).toEqual([]);
  });
});

// ─── cockpitPreselection ─────────────────────────────────────

describe("cockpitPreselection — localStorage queue", () => {
  beforeEach(() => {
    const store = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("add + peek non consuma", () => {
    addCockpitPreselection(["a", "b", "c"]);
    expect(getCockpitPreselection()).toEqual(["a", "b", "c"]);
    expect(getCockpitPreselection()).toEqual(["a", "b", "c"]);
  });

  it("consume svuota la coda", () => {
    addCockpitPreselection(["x", "y"]);
    expect(consumeCockpitPreselection()).toEqual(["x", "y"]);
    expect(getCockpitPreselection()).toEqual([]);
  });

  it("add merge senza duplicati", () => {
    addCockpitPreselection(["a", "b"]);
    addCockpitPreselection(["b", "c"]);
    expect(getCockpitPreselection()).toEqual(["a", "b", "c"]);
  });

  it("add con array vuoto è no-op", () => {
    addCockpitPreselection([]);
    expect(getCockpitPreselection()).toEqual([]);
  });

  it("consume su coda vuota ritorna []", () => {
    expect(consumeCockpitPreselection()).toEqual([]);
  });
});

// ─── partnerUtils ────────────────────────────────────────────

describe("partnerUtils", () => {
  describe("asEnrichment", () => {
    it("ritorna null per non-object", () => {
      expect(asEnrichment(null)).toBeNull();
      expect(asEnrichment(undefined)).toBeNull();
      expect(asEnrichment("string")).toBeNull();
      expect(asEnrichment(42)).toBeNull();
    });

    it("ritorna l'oggetto se valido", () => {
      const data = { tokens_used: { credits_consumed: 10 } };
      expect(asEnrichment(data)).toEqual(data);
    });
  });

  describe("getRealLogoUrl / getEffectiveLogoUrl", () => {
    it("getRealLogoUrl ritorna null su falsy", () => {
      expect(getRealLogoUrl(null)).toBeNull();
      expect(getRealLogoUrl(undefined)).toBeNull();
      expect(getRealLogoUrl("")).toBeNull();
      expect(getRealLogoUrl("https://x.png")).toBe("https://x.png");
    });

    it("getEffectiveLogoUrl: priorità a partner.logo_url", () => {
      const partner = { logo_url: "https://primary.png", enrichment_data: { logo_url: "https://fallback.png" } };
      expect(getEffectiveLogoUrl(partner)).toBe("https://primary.png");
    });

    it("getEffectiveLogoUrl: fallback su enrichment_data.logo_url", () => {
      const partner = { logo_url: null, enrichment_data: { logo_url: "https://fallback.png" } };
      expect(getEffectiveLogoUrl(partner)).toBe("https://fallback.png");
    });

    it("getEffectiveLogoUrl: null se nessuna fonte", () => {
      expect(getEffectiveLogoUrl({ logo_url: null, enrichment_data: null })).toBeNull();
    });
  });

  describe("getEnrichmentSnippet", () => {
    it("ritorna headline se presente", () => {
      const p = { enrichment_data: { ai_profile: { headline: "Top logistics" } } };
      expect(getEnrichmentSnippet(p)).toBe("Top logistics");
    });

    it("ritorna sector come fallback", () => {
      const p = { enrichment_data: { ai_profile: { sector: "Freight" } } };
      expect(getEnrichmentSnippet(p)).toBe("Freight");
    });

    it("tronca summary a 80 caratteri", () => {
      const long = "x".repeat(200);
      const p = { enrichment_data: { ai_profile: { summary: long } } };
      expect(getEnrichmentSnippet(p)?.length).toBe(80);
    });

    it("null se nessun enrichment", () => {
      expect(getEnrichmentSnippet({})).toBeNull();
    });
  });

  describe("hasLinkedIn / hasWhatsApp", () => {
    it("hasLinkedIn da partner_social_links", () => {
      expect(hasLinkedIn({ partner_social_links: [{ platform: "linkedin" }] })).toBe(true);
      expect(hasLinkedIn({ partner_social_links: [{ platform: "linkedin_company" }] })).toBe(true);
    });

    it("hasLinkedIn da enrichment social_links", () => {
      const p = { enrichment_data: { social_links: [{ platform: "linkedin_personal" }] } };
      expect(hasLinkedIn(p)).toBe(true);
    });

    it("hasLinkedIn false su nessuno", () => {
      expect(hasLinkedIn({})).toBe(false);
    });

    it("hasWhatsApp da partner.mobile", () => {
      expect(hasWhatsApp({ mobile: "+393331234567" })).toBe(true);
    });

    it("hasWhatsApp da partner_contacts mobile", () => {
      expect(hasWhatsApp({ partner_contacts: [{ mobile: "+393331234567" }] })).toBe(true);
    });

    it("hasWhatsApp false su nessuno", () => {
      expect(hasWhatsApp({ partner_contacts: [{ name: "x" }] })).toBe(false);
    });
  });

  describe("getBranchCountries", () => {
    it("estrae countries deduplicati escludendo HQ", () => {
      const partner = {
        country_code: "IT",
        branch_cities: [
          { country_code: "DE", country_name: "Germany" },
          { country_code: "DE", country_name: "Germany" },
          { country_code: "FR", country_name: "France" },
          { country_code: "IT", country_name: "Italy" }, // escluso (HQ)
        ],
      };
      const result = getBranchCountries(partner);
      expect(result).toHaveLength(2);
      expect(result.map((c) => c.code).sort()).toEqual(["DE", "FR"]);
    });

    it("ritorna array vuoto se branch_cities mancante", () => {
      expect(getBranchCountries({ country_code: "IT" })).toEqual([]);
      expect(getBranchCountries({ country_code: "IT", branch_cities: null as unknown as undefined })).toEqual([]);
    });
  });

  describe("sortPartners", () => {
    const partners = [
      { company_name: "Charlie", rating: 3, member_since: "2020-01-01", country_name: "Germany", branch_cities: [{}, {}], partner_contacts: [{ email: "a@b.it", phone: "+39", mobile: "+39", name: "x" }] },
      { company_name: "Alpha", rating: 5, member_since: "2010-01-01", country_name: "Italy", branch_cities: [{}, {}, {}], partner_contacts: [] },
      { company_name: "Bravo", rating: 4, member_since: "2015-01-01", country_name: "France", branch_cities: [{}], partner_contacts: [{ email: "x" }] },
    ];

    it("name_asc / name_desc", () => {
      expect(sortPartners(partners, "name_asc").map((p) => p.company_name)).toEqual(["Alpha", "Bravo", "Charlie"]);
      expect(sortPartners(partners, "name_desc").map((p) => p.company_name)).toEqual(["Charlie", "Bravo", "Alpha"]);
    });

    it("rating_desc", () => {
      expect(sortPartners(partners, "rating_desc")[0].company_name).toBe("Alpha");
    });

    it("country_asc", () => {
      expect(sortPartners(partners, "country_asc").map((p) => p.country_name)).toEqual(["France", "Germany", "Italy"]);
    });

    it("branches_desc", () => {
      expect(sortPartners(partners, "branches_desc")[0].company_name).toBe("Alpha");
    });

    it("non muta l'array originale", () => {
      const before = [...partners];
      sortPartners(partners, "name_asc");
      expect(partners).toEqual(before);
    });
  });
});
