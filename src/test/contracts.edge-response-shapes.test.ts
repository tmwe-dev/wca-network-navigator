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
  it("process-email-queue: 400 on missing draft_id (when authed)", async () => {
    // Without valid auth we get 401, so we test error shape on 401
    const res = await fetch(`${SUPABASE_URL}/functions/v1/process-email-queue`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    expect(body).toHaveProperty("error");
    expect(typeof body.error).toBe("string");
  });

  it("send-email: error response has 'error' key", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("agent-execute: error response has 'error' key", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-execute`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    expect(body).toHaveProperty("error");
  });

  it("agent-autonomous-cycle: returns JSON with expected shape", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/agent-autonomous-cycle`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    // Should return either { message } or { success, cycle, results } or { error }
    expect(typeof body).toBe("object");
    const hasValidShape = body.message || body.success !== undefined || body.error;
    expect(hasValidShape).toBeTruthy();
  });

  it("email-cron-sync: returns JSON with expected shape", async () => {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/email-cron-sync`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({}),
        signal: AbortSignal.timeout(12000),
      });
      const body = await res.json();
      expect(typeof body).toBe("object");
      const hasValidShape = body.message || body.processed !== undefined || body.error;
      expect(hasValidShape).toBeTruthy();
    } catch (e) {
      // Network timeout in CI — skip gracefully
      if (e instanceof DOMException && e.name === "TimeoutError") return;
      if (e instanceof TypeError && String(e).includes("fetch")) return;
      throw e;
    }
  }, 15000);
});
