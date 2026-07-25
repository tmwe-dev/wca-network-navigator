/**
 * B4.6b — regression test: fallback view→channel_messages scatta SOLO per
 * errori compatibili con view/schema non disponibile. Errori auth/RLS/network
 * devono propagarsi (throw), NON venir mascherati.
 */
import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ warn: vi.fn(), error: vi.fn(), info: vi.fn(), debug: vi.fn() }),
}));
vi.mock("@/lib/supabaseUntyped", () => ({ untypedFrom: vi.fn() }));

import { __internals } from "@/data/funnemailInbox";

const { readInboxOnce, readInboxPaginated } = __internals;

describe("readInboxOnce — fallback gating", () => {
  it("fallback on schema error (42P01)", async () => {
    const build = vi.fn(async (source: string) => {
      if (source === "message_intelligence_v") {
        return { data: null, error: { code: "42P01", message: "relation does not exist" } };
      }
      return { data: [{ ok: true }], error: null };
    });
    const rows = await readInboxOnce("test", build);
    expect(rows).toEqual([{ ok: true }]);
    expect(build).toHaveBeenCalledTimes(2);
  });

  it("no fallback on RLS/auth error — throws", async () => {
    const build = vi.fn(async () => ({
      data: null,
      error: { code: "42501", message: "permission denied for view" },
    }));
    await expect(readInboxOnce("test", build)).rejects.toThrow(/permission denied/);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("no fallback on network/timeout error — throws", async () => {
    const build = vi.fn(async () => ({ data: null, error: { message: "fetch failed" } }));
    await expect(readInboxOnce("test", build)).rejects.toThrow(/fetch failed/);
    expect(build).toHaveBeenCalledTimes(1);
  });

  it("returns data directly on view success (no fallback call)", async () => {
    const build = vi.fn(async () => ({ data: [{ id: 1 }], error: null }));
    const rows = await readInboxOnce("test", build);
    expect(rows).toEqual([{ id: 1 }]);
    expect(build).toHaveBeenCalledTimes(1);
  });
});

describe("readInboxPaginated — fallback gating", () => {
  it("restart legacy on schema error mid-stream", async () => {
    let viewCall = 0;
    let legacyCall = 0;
    const build = vi.fn(async (source: string, _from: number, _to: number) => {
      if (source === "message_intelligence_v") {
        viewCall++;
        const err = { code: "PGRST205", message: "could not find the table" } as Error & { code: string };
        return { data: null, error: err };
      }
      legacyCall++;
      return { data: [], error: null };
    });
    const rows = await readInboxPaginated("test", build, 100);
    expect(rows).toEqual([]);
    expect(viewCall).toBeGreaterThanOrEqual(1);
    expect(legacyCall).toBeGreaterThanOrEqual(1);
  });

  it("throws on auth/RLS error without hitting legacy", async () => {
    let legacyCall = 0;
    const build = vi.fn(async (source: string) => {
      if (source === "message_intelligence_v") {
        const err = Object.assign(new Error("permission denied"), { code: "42501" });
        return { data: null, error: err };
      }
      legacyCall++;
      return { data: [], error: null };
    });
    await expect(readInboxPaginated("test", build, 100)).rejects.toThrow(/permission denied/);
    expect(legacyCall).toBe(0);
  });

  it("throws on network error without hitting legacy", async () => {
    let legacyCall = 0;
    const build = vi.fn(async (source: string) => {
      if (source === "message_intelligence_v") {
        return { data: null, error: Object.assign(new Error("network error"), {}) };
      }
      legacyCall++;
      return { data: [], error: null };
    });
    await expect(readInboxPaginated("test", build, 100)).rejects.toThrow(/network error/);
    expect(legacyCall).toBe(0);
  });
});
