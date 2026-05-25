/**
 * Public edge functions auth guards (verify_jwt=false ma protette in-code).
 * Verifica che senza Authorization valida ritornino 401/403.
 * Chiude residuo audit -2000 "18 edge function pubbliche by-design".
 */
import { test, expect } from "@playwright/test";

const SUPABASE_URL = process.env.SUPABASE_URL
  ?? process.env.VITE_SUPABASE_URL
  ?? "https://zrbditqddhjkutzjycgi.supabase.co";

const PROTECTED_FUNCTIONS = [
  { name: "get-wca-credentials", method: "POST" },
  { name: "get-ra-credentials", method: "POST" },
  { name: "get-linkedin-credentials", method: "POST" },
  { name: "consume-credits", method: "POST" },
  { name: "whatsapp-ai-extract", method: "POST" },
  { name: "replay-domain-events", method: "POST" },
] as const;

test.describe("public-edge-auth-guards", () => {
  for (const fn of PROTECTED_FUNCTIONS) {
    test(`${fn.name} rejects unauthenticated requests`, async ({ request }) => {
      const res = await request.fetch(`${SUPABASE_URL}/functions/v1/${fn.name}`, {
        method: fn.method,
        headers: { "Content-Type": "application/json" },
        data: {},
      });
      // Acceptable: 401 (no auth), 403 (forbidden), 400 (missing cron secret).
      // Must NOT be 200 (would mean public access to sensitive data).
      expect([400, 401, 403]).toContain(res.status());
      expect(res.status()).not.toBe(200);
    });
  }
});