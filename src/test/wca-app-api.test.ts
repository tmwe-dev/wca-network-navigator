import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import {
  wcaDiscover,
  wcaScrape,
  wcaCheckIds,
  wcaJobStart,
  wcaJobPause,
  WCA_NETWORKS,
} from "@/lib/api/wcaAppApi";

// ─── E2E contract test per wcaAppApi (mock fetch globale) ────

const originalFetch = global.fetch;

function mockFetch(response: any, ok = true, status = 200) {
  return vi.fn().mockResolvedValue({
    ok,
    status,
    json: vi.fn().mockResolvedValue(response),
  } as any);
}

describe("wcaAppApi — contract tests (mocked fetch)", () => {
  beforeEach(() => {
    // stub localStorage con cookie valido per evitare login
    const store = new Map<string, string>();
    store.set(
      "wca_session_cookie",
      JSON.stringify({ cookie: "fake-cookie=abc", savedAt: Date.now() })
    );
    vi.stubGlobal("localStorage", {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => store.set(k, v),
      removeItem: (k: string) => store.delete(k),
      clear: () => store.clear(),
    });
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.unstubAllGlobals();
    vi.clearAllMocks();
  });

  describe("wcaDiscover", () => {
    it("invia POST con filters country", async () => {
      const fakeFetch = mockFetch({
        success: true,
        members: [{ id: 1, name: "Acme" }],
        page: 1,
        hasNext: false,
        totalResults: 1,
      });
      global.fetch = fakeFetch as any;

      const result = await wcaDiscover("IT");
      expect(result.success).toBe(true);
      expect(result.members).toHaveLength(1);

      const [url, init] = fakeFetch.mock.calls[0];
      expect(url).toContain("/discover");
      expect(init.method).toBe("POST");
      const body = JSON.parse(init.body);
      expect(body.filters.country).toBe("IT");
      expect(body.page).toBe(1);
    });

    it("include filtri opzionali quando passati", async () => {
      global.fetch = mockFetch({
        success: true,
        members: [],
        page: 1,
        hasNext: false,
        totalResults: 0,
      }) as any;

      await wcaDiscover("DE", 2, {
        networks: ["WCA First"],
        searchTerm: "logistics",
        city: "Berlin",
      });

      const body = JSON.parse((global.fetch as any).mock.calls[0][1].body);
      expect(body.filters.networks).toEqual(["WCA First"]);
      expect(body.filters.searchTerm).toBe("logistics");
      expect(body.filters.city).toBe("Berlin");
      expect(body.page).toBe(2);
    });

    it("throws ApiError SERVER_ERROR su 500 (Vol. II §5.3)", async () => {
      global.fetch = mockFetch({}, false, 500) as any;
      try {
        await wcaDiscover("IT");
        throw new Error("expected to throw");
      } catch (err: any) {
        expect(err.name).toBe("ApiError");
        expect(err.code).toBe("SERVER_ERROR");
        expect(err.httpStatus).toBe(500);
        expect(err.details?.context).toBe("wcaDiscover");
      }
    });
  });

  describe("wcaScrape", () => {
    it("invia wcaIds nel body", async () => {
      const fakeFetch = mockFetch({
        success: true,
        results: [{ wca_id: 1, state: "ok", company_name: "X" }],
      });
      global.fetch = fakeFetch as any;

      const result = await wcaScrape([1, 2, 3]);
      expect(result.success).toBe(true);
      expect(result.results).toHaveLength(1);

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body);
      expect(body.wcaIds).toEqual([1, 2, 3]);
      expect(body.networkDomain).toBeUndefined();
    });

    it("include networkDomain se passato", async () => {
      const fakeFetch = mockFetch({ success: true, results: [] });
      global.fetch = fakeFetch as any;
      await wcaScrape([1], "elitegln.com");
      const body = JSON.parse(fakeFetch.mock.calls[0][1].body);
      expect(body.networkDomain).toBe("elitegln.com");
    });
  });

  describe("wcaCheckIds", () => {
    it("ritorna risultato con missing ids", async () => {
      global.fetch = mockFetch({
        success: true,
        total_in_db: 100,
        checked: 10,
        found: 7,
        missing: [4, 5, 6],
        elapsed_ms: 42,
      }) as any;

      const result = await wcaCheckIds([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], "IT");
      expect(result.missing).toEqual([4, 5, 6]);
      expect(result.found).toBe(7);
    });
  });

  describe("wcaJobStart / wcaJobPause", () => {
    it("job-start invia countries + options", async () => {
      const fakeFetch = mockFetch({ success: true, jobId: "job-1", status: "running" });
      global.fetch = fakeFetch as any;

      const result = await wcaJobStart(
        [{ code: "IT", name: "Italy" }],
        { networks: ["WCA First"] }
      );
      expect(result.jobId).toBe("job-1");

      const body = JSON.parse(fakeFetch.mock.calls[0][1].body);
      expect(body.countries).toEqual([{ code: "IT", name: "Italy" }]);
      expect(body.networks).toEqual(["WCA First"]);
    });

    it("job-pause invia action=pause", async () => {
      const fakeFetch = mockFetch({ success: true, action: "paused" });
      global.fetch = fakeFetch as any;
      await wcaJobPause("job-xyz");
      const body = JSON.parse(fakeFetch.mock.calls[0][1].body);
      expect(body.action).toBe("pause");
      expect(body.jobId).toBe("job-xyz");
    });
  });

  describe("WCA_NETWORKS map", () => {
    it("contiene i network core con id e domain", () => {
      expect(WCA_NETWORKS["WCA First"]).toEqual({ id: 1, domain: "www.wcaworld.com" });
      expect(WCA_NETWORKS["Lognet Global"].id).toBe(61);
      expect(WCA_NETWORKS["WCA Inter Global"].domain).toBe("interglobal.wcaworld.com");
    });

    it("ogni network ha un id numerico positivo", () => {
      for (const [name, net] of Object.entries(WCA_NETWORKS)) {
        expect(typeof net.id, `${name}.id`).toBe("number");
        expect(net.id).toBeGreaterThan(0);
      }
    });
  });
});
