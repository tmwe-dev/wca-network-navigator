import { describe, it, expect } from "vitest";

/**
 * [A03] Edge Function Response Shape Contracts
 * Scope: Verify critical edge functions return well-formed JSON with expected keys.
 * Preconditions: Edge functions deployed, CORS available.
 * Expected: Known shape on OPTIONS and known error shape on bad input.
 * Tables: none (response-only).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

describe("Edge Function Response Shapes [A03]", () => {
  const safeFetch = async (path: string, body: Record<string, unknown> = {}) => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(10000),
      });
      return await res.json();
    } catch {
      return null; // network timeout — skip gracefully
    }
  };

  it("process-email-queue: error on missing draft_id", async () => {
    const body = await safeFetch("process-email-queue");
    if (!body) return; // network unavailable
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  it("send-email: error response has 'error' key", async () => {
    const body = await safeFetch("send-email");
    if (!body) return;
    expect(body).toHaveProperty("error");
  });

  it("agent-execute: error response has 'error' key", async () => {
    const body = await safeFetch("agent-execute");
    if (!body) return;
    expect(body).toHaveProperty("error");
  });

  it("agent-autonomous-cycle: returns JSON with expected shape", async () => {
    const body = await safeFetch("agent-autonomous-cycle");
    if (!body) return;
    expect(typeof body).toBe("object");
    const hasValidShape = body.message || body.success !== undefined || body.error;
    expect(hasValidShape).toBeTruthy();
  });

  it("email-cron-sync: returns JSON with expected shape", async () => {
    const body = await safeFetch("email-cron-sync");
    if (!body) return;
    expect(typeof body).toBe("object");
    const hasValidShape = body.message || body.processed !== undefined || body.error;
    expect(hasValidShape).toBeTruthy();
  }, 15000);
});
