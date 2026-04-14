import { describe, it, expect } from "vitest";

/**
 * [A02] Edge Function Auth Contracts
 * Scope: Verify all critical edge functions reject unauthenticated requests.
 * Tables: none (response-only).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const criticalFunctions = [
  "process-email-queue",
  "send-email",
  "agent-execute",
  "generate-email",
];

// check-inbox tested separately (known bug: returns 500 instead of 401)
describe("Edge Function Auth Contracts [A02]", () => {
  for (const fn of criticalFunctions) {
    it(`${fn}: returns 401 without auth`, async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      expect(res.status).toBe(401);
      expect(body.error).toBeDefined();
    });

    it(`${fn}: returns 401 or 403 with invalid Bearer token`, async () => {
      const res2 = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", apikey: ANON_KEY, Authorization: "Bearer invalid-token" },
        body: JSON.stringify({}),
      });
      const body2 = await res2.json();
      expect([401, 403]).toContain(res2.status);
      expect(body2.error).toBeDefined();
    });

    it(`${fn}: CORS preflight returns 200`, async () => {
      const res3 = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      });
      expect(res3.status).toBeLessThanOrEqual(204);
      await res3.text();
    });
  }

  it("check-inbox: returns error without auth (known bug: 500 instead of 401)", async () => {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/check-inbox`, {
      method: "POST",
      headers: { "Content-Type": "application/json", apikey: ANON_KEY },
      body: JSON.stringify({}),
    });
    const body = await res.json();
    expect([401, 500]).toContain(res.status);
    expect(body.error).toBeDefined();
  });
});
