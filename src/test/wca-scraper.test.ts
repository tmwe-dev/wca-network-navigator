import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ─── E2E-style contract test per il flusso WCA ──────────────
// Strangler pattern: testiamo il contratto pubblico di wcaScraper
// senza toccare la rete reale (mock di wcaAppApi).

vi.mock("@/lib/api/wcaAppApi", () => ({
/* eslint-disable @typescript-eslint/no-explicit-any -- test file with mocks */
  wcaScrape: vi.fn(),
  wcaDiscover: vi.fn(),
  wcaLogin: vi.fn(),
}));

import { scrapeWcaPartnerById, previewWcaProfile } from "@/lib/api/wcaScraper";
import { wcaScrape } from "@/lib/api/wcaAppApi";

const mockedScrape = vi.mocked(wcaScrape);

describe("wcaScraper — contract E2E (mocked network)", () => {
  beforeEach(() => {
    mockedScrape.mockReset();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe("scrapeWcaPartnerById", () => {
    it("ritorna found=true su profilo valido state=ok", async () => {
      mockedScrape.mockResolvedValueOnce({
        success: true,
        results: [
          {
            wca_id: 12345,
            state: "ok",
            company_name: "Acme Logistics",
            country_code: "IT",
          } as any,
        ],
      });
      const result = await scrapeWcaPartnerById(12345);
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.wcaId).toBe(12345);
      expect(mockedScrape).toHaveBeenCalledWith([12345]);
    });

    it("ritorna success=false quando l'API fallisce", async () => {
      mockedScrape.mockResolvedValueOnce({
        success: false,
        error: "HTTP 500",
      });
      const result = await scrapeWcaPartnerById(999);
      expect(result.success).toBe(false);
      expect(result.error).toBe("HTTP 500");
    });

    it("ritorna found=false quando state != ok", async () => {
      mockedScrape.mockResolvedValueOnce({
        success: true,
        results: [{ wca_id: 42, state: "not_found", company_name: "" } as any],
      });
      const result = await scrapeWcaPartnerById(42);
      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
    });

    it("cattura errori di rete senza esplodere", async () => {
      mockedScrape.mockRejectedValueOnce(new Error("ECONNRESET"));
      const result = await scrapeWcaPartnerById(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe("ECONNRESET");
    });

    it("ritorna errore generico se thrown è non-Error", async () => {
      mockedScrape.mockRejectedValueOnce("boom");
      const result = await scrapeWcaPartnerById(1);
      expect(result.success).toBe(false);
      expect(result.error).toBe("Errore di rete");
    });
  });

  describe("previewWcaProfile", () => {
    it("ritorna authStatus=authenticated + partner mappato", async () => {
      mockedScrape.mockResolvedValueOnce({
        success: true,
        results: [
          {
            wca_id: 7,
            state: "ok",
            company_name: "Globex",
            country_code: "DE",
            address: "Berlin, Germany",
            branch: "HQ",
            email: "info@globex.de",
            phone: "+49-30-000",
            website: "https://globex.de",
            networks: ["WCA First", { name: "WCA Projects" }],
            contacts: [{ name: "Hans", email: "hans@globex.de" }],
          } as any,
        ],
      });

      const result = await previewWcaProfile(7);
      expect(result.success).toBe(true);
      expect(result.found).toBe(true);
      expect(result.authStatus).toBe("authenticated");
      expect(result.partner?.company_name).toBe("Globex");
      expect(result.partner?.city).toBe("Berlin");
      expect(result.partner?.country_code).toBe("DE");
      expect(result.partner?.networks).toHaveLength(2);
      expect(result.partner?.networks[0]).toEqual({ name: "WCA First" });
      expect(result.contactsFound).toBe(1);
    });

    it("ritorna found=false ma authStatus=authenticated se profilo vuoto", async () => {
      mockedScrape.mockResolvedValueOnce({
        success: true,
        results: [{ wca_id: 99, state: "ok", company_name: "" } as any],
      });
      const result = await previewWcaProfile(99);
      expect(result.success).toBe(true);
      expect(result.found).toBe(false);
      expect(result.authStatus).toBe("authenticated");
    });

    it("ritorna authStatus=login_failed se scrape fallisce", async () => {
      mockedScrape.mockResolvedValueOnce({ success: false, error: "401" });
      const result = await previewWcaProfile(1);
      expect(result.success).toBe(false);
      expect(result.authStatus).toBe("login_failed");
    });

    it("ritorna authStatus=login_failed su network error", async () => {
      mockedScrape.mockRejectedValueOnce(new Error("DNS fail"));
      const result = await previewWcaProfile(1);
      expect(result.success).toBe(false);
      expect(result.authStatus).toBe("login_failed");
      expect(result.error).toBe("DNS fail");
    });
  });
});
