import { describe, it, expect, vi, beforeEach } from "vitest";

type QueryResult = { data: unknown; error: unknown };

const state = {
  selectResult: { data: null as unknown, error: null as unknown } as QueryResult,
  updateResult: { data: null as unknown, error: null as unknown } as QueryResult,
  lastUpdatePayload: null as Record<string, unknown> | null,
  lastUpdateId: null as string | null,
  lastCompanyIlike: null as string | null,
};

function makeBuilder(kind: "select" | "update") {
  const b: Record<string, unknown> = {};
  const chain = () => b;
  b.select = vi.fn(chain);
  b.ilike = vi.fn((_col: string, val: string) => {
    state.lastCompanyIlike = val;
    return b;
  });
  b.limit = vi.fn(() => Promise.resolve(state.selectResult));
  b.eq = vi.fn((_col: string, id: string) => {
    state.lastUpdateId = id;
    return Promise.resolve(state.updateResult);
  });
  b.update = vi.fn((payload: Record<string, unknown>) => {
    state.lastUpdatePayload = payload;
    return b;
  });
  return b;
}

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (_t: string) => {
      // Return a shared builder — the DAL chains .select().ilike().limit() then .update().eq()
      return makeBuilder("select");
    },
  },
}));

import { persistLinkedInProfileForCompany } from "@/data/partners";

describe("persistLinkedInProfileForCompany (P001-007 DAL move)", () => {
  beforeEach(() => {
    state.selectResult = { data: null, error: null };
    state.updateResult = { data: null, error: null };
    state.lastUpdatePayload = null;
    state.lastUpdateId = null;
    state.lastCompanyIlike = null;
  });

  it("returns false and does not update when args are empty", async () => {
    expect(await persistLinkedInProfileForCompany("", "https://x", "m")).toBe(false);
    expect(await persistLinkedInProfileForCompany("Acme", "", "m")).toBe(false);
    expect(state.lastUpdatePayload).toBeNull();
  });

  it("returns false silently when no partner row matches", async () => {
    state.selectResult = { data: [], error: null };
    const ok = await persistLinkedInProfileForCompany("Acme", "https://li/x", "google_search");
    expect(ok).toBe(false);
    expect(state.lastCompanyIlike).toBe("%Acme%");
    expect(state.lastUpdatePayload).toBeNull();
  });

  it("merges enrichment_data additively and writes the three linkedin keys", async () => {
    state.selectResult = {
      data: [{ id: "p1", enrichment_data: { keep_me: 1, linkedin_profile_url: "old" } }],
      error: null,
    };
    const ok = await persistLinkedInProfileForCompany("Acme", "https://li/new", "google_search");
    expect(ok).toBe(true);
    expect(state.lastUpdateId).toBe("p1");
    const payload = state.lastUpdatePayload as { enrichment_data: Record<string, unknown> };
    expect(payload.enrichment_data.keep_me).toBe(1);
    expect(payload.enrichment_data.linkedin_profile_url).toBe("https://li/new");
    expect(payload.enrichment_data.linkedin_resolved_method).toBe("google_search");
    expect(typeof payload.enrichment_data.linkedin_lookup_at).toBe("string");
  });

  it("returns false when update errors (silent-on-error)", async () => {
    state.selectResult = { data: [{ id: "p2", enrichment_data: null }], error: null };
    state.updateResult = { data: null, error: { message: "boom" } };
    const ok = await persistLinkedInProfileForCompany("Acme", "https://li/x", "google_search");
    expect(ok).toBe(false);
  });
});