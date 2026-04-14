import { describe, it, expect, vi, beforeEach } from "vitest";
import { ApiError } from "@/lib/api/apiError";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api/wcaAppApi.schemas", () => ({
  safeParseDiscover: vi.fn(),
  safeParseScrape: vi.fn(),
  safeParseCheckIds: vi.fn(),
  safeParseJobStart: vi.fn(),
}));

const mockFetch = vi.fn();
global.fetch = mockFetch;

// Clear localStorage cookie cache
beforeEach(() => {
  vi.clearAllMocks();
  try { localStorage.removeItem("wca_session_cookie"); } catch {}
});

import { wcaScrape, wcaCheckIds, wcaSave, wcaJobStatus, wcaVerify } from "@/lib/api/wcaAppApi";

function okJson(body: unknown) {
  return { ok: true, status: 200, json: async () => body, clone: () => ({ json: async () => body }) };
}

function errorResponse(status: number, body?: unknown) {
  const json = body ? JSON.stringify(body) : "{}";
  return new Response(json, { status, headers: { "Content-Type": "application/json" } });
}

describe("wcaScrape", () => {
  it("sends POST with wcaIds and returns result", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, results: [{ company_name: "Test Co" }] }));
    const result = await wcaScrape([12345]);
    expect(mockFetch).toHaveBeenCalledWith(
      expect.stringContaining("/scrape"),
      expect.objectContaining({ method: "POST" })
    );
    expect(result.success).toBe(true);
    expect(result.results).toHaveLength(1);
  });

  it("throws ApiError on 500 response", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(500, { error: "internal" }));
    await expect(wcaScrape([1])).rejects.toThrow(ApiError);
  });

  it("throws ApiError on network failure", async () => {
    mockFetch.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    await expect(wcaScrape([1])).rejects.toThrow();
  });
});

describe("wcaCheckIds", () => {
  it("sends ids and returns missing array", async () => {
    mockFetch.mockResolvedValueOnce(okJson({
      success: true, total_in_db: 3, checked: 5, found: 3, missing: [4, 5], elapsed_ms: 100,
    }));
    const result = await wcaCheckIds([1, 2, 3, 4, 5]);
    expect(result.missing).toEqual([4, 5]);
    expect(result.found).toBe(3);
  });
});

describe("wcaSave", () => {
  it("sends profile and returns success", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, wca_id: 123 }));
    const result = await wcaSave({ company_name: "X" });
    expect(result.success).toBe(true);
    expect(result.wca_id).toBe(123);
  });
});

describe("wcaJobStatus", () => {
  it("fetches status with optional jobId param", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, job: null }));
    const result = await wcaJobStatus("job-abc");
    expect(mockFetch).toHaveBeenCalledWith(expect.stringContaining("jobId=job-abc"));
    expect(result.job).toBeNull();
  });

  it("fetches status without jobId", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, job: null }));
    await wcaJobStatus();
    expect(mockFetch).toHaveBeenCalledWith(expect.not.stringContaining("jobId="));
  });
});

describe("wcaVerify", () => {
  it("sends wcaId and network", async () => {
    mockFetch.mockResolvedValueOnce(okJson({ success: true, found: true, wcaId: 100, network: "WCA First" }));
    const result = await wcaVerify(100, "WCA First");
    expect(result.found).toBe(true);
  });

  it("throws on 404", async () => {
    mockFetch.mockResolvedValueOnce(errorResponse(404));
    await expect(wcaVerify(999, "X")).rejects.toThrow(ApiError);
  });
});
