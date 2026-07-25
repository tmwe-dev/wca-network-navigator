/**
 * DAL — smartSuggestionCounts tests (D1)
 * Verifica primary path, propagazione errori, filtri applicati.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

type BuilderReturn = { count: number | null; error: unknown };

function makeBuilder(result: BuilderReturn) {
  const chain: Record<string, unknown> = {};
  const proxy: unknown = new Proxy(chain, {
    get(_t, prop) {
      if (prop === "then") {
        return (resolve: (v: BuilderReturn) => unknown) => resolve(result);
      }
      return () => proxy;
    },
  });
  return proxy;
}

const fromMock = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (table: string) => fromMock(table),
  },
}));

import { fetchSmartSuggestionCounts } from "../smartSuggestionCounts";

describe("DAL — fetchSmartSuggestionCounts", () => {
  beforeEach(() => {
    fromMock.mockReset();
  });

  it("aggrega i 6 count e normalizza null → 0", async () => {
    const values: Record<string, BuilderReturn> = {
      agent_tasks: { count: 3, error: null },
      channel_messages: { count: 12, error: null },
      mission_actions: { count: null, error: null },
      outreach_schedules: { count: 5, error: null },
      email_drafts: { count: 0, error: null },
      download_jobs: { count: 2, error: null },
    };
    fromMock.mockImplementation((t: string) => makeBuilder(values[t]));

    const out = await fetchSmartSuggestionCounts();
    expect(out).toEqual({
      pendingTasks: 3,
      unreadInboundMessages: 12,
      pendingApproval: 0,
      pendingOutreach: 5,
      draftEmails: 0,
      activeJobs: 2,
    });
    expect(fromMock).toHaveBeenCalledWith("agent_tasks");
    expect(fromMock).toHaveBeenCalledWith("channel_messages");
    expect(fromMock).toHaveBeenCalledWith("mission_actions");
    expect(fromMock).toHaveBeenCalledWith("outreach_schedules");
    expect(fromMock).toHaveBeenCalledWith("email_drafts");
    expect(fromMock).toHaveBeenCalledWith("download_jobs");
  });

  it("propaga il primo errore (auth/RLS/network) senza mascherarlo", async () => {
    const err = new Error("RLS denied");
    const values: Record<string, BuilderReturn> = {
      agent_tasks: { count: null, error: err },
      channel_messages: { count: 1, error: null },
      mission_actions: { count: 1, error: null },
      outreach_schedules: { count: 1, error: null },
      email_drafts: { count: 1, error: null },
      download_jobs: { count: 1, error: null },
    };
    fromMock.mockImplementation((t: string) => makeBuilder(values[t]));
    await expect(fetchSmartSuggestionCounts()).rejects.toBe(err);
  });
});

describe("D1 guardrail — useSmartSuggestions non deve reintrodurre supabase.from", () => {
  it("hook consuma solo la DAL", async () => {
    const { readFileSync } = await import("node:fs");
    const src = readFileSync("src/v2/hooks/useSmartSuggestions.ts", "utf8");
    expect(src).not.toMatch(/supabase\.from\(/);
    expect(src).not.toMatch(/from "@\/integrations\/supabase\/client"/);
    expect(src).toMatch(/fetchSmartSuggestionCounts/);
  });
});