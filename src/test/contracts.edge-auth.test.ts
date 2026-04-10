import { describe, it, expect } from "vitest";

/**
 * [A02] Edge Function Auth Contracts
 * Scope: Verify all critical edge functions reject unauthenticated requests.
 * Preconditions: Edge functions deployed.
 * Expected: 401 without Bearer token.
 * Tables: none (response-only check).
 */

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY;

const criticalFunctions = [
  "process-email-queue",
  "send-email",
  "agent-execute",
  "generate-email",
  "check-inbox",
];

describe("Edge Function Auth Contracts [A02]", () => {
  for (const fn of criticalFunctions) {
    it(`${fn}: returns 401 without auth`, async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      expect(res.status).toBe(401);
      expect(body.error).toBeDefined();
    });

    it(`${fn}: returns 401 with invalid Bearer token`, async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          apikey: ANON_KEY,
          Authorization: "Bearer invalid-token-abc123",
        },
        body: JSON.stringify({}),
      });
      const body = await res.json();
      expect(res.status).toBe(401);
      expect(body.error).toBeDefined();
    });
  }

  for (const fn of criticalFunctions) {
    it(`${fn}: CORS preflight returns 200`, async () => {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/${fn}`, {
        method: "OPTIONS",
        headers: { Origin: "http://localhost:3000" },
      });
      expect(res.status).toBeLessThanOrEqual(204);
      await res.text();
    });
  }
});
