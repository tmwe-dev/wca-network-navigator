import { describe, it, expect } from "vitest";

/**
 * Garantisce che ogni `reason` che il callback TMWE può emettere abbia
 * un messaggio in italiano in LoginPage.REASON_MESSAGES. Se aggiungi un
 * nuovo motivo nel callback, aggiorna anche questa lista.
 */
const CALLBACK_REASONS = [
  "missing_params",
  "invalid_state",
  "expired_state",
  "profile_fetch_failed",
  "no_tmwe_user_id",
  "no_tmwe_email",
  "not_whitelisted",
  "whitelist_check_failed",
  "user_create_failed",
  "tmwe_account_already_linked",
  "magiclink_failed",
] as const;

async function loadReasonMessages(): Promise<Record<string, string>> {
  const fs = await import("node:fs/promises");
  const path = await import("node:path");
  const src = await fs.readFile(
    path.resolve(process.cwd(), "src/v2/ui/pages/LoginPage.tsx"),
    "utf-8",
  );
  const match = src.match(/REASON_MESSAGES:\s*Record<string,\s*string>\s*=\s*\{([\s\S]*?)\};/);
  if (!match) throw new Error("REASON_MESSAGES non trovata in LoginPage.tsx");
  const body = match[1];
  const result: Record<string, string> = {};
  for (const line of body.split("\n")) {
    const m = line.match(/^\s*([a-z_]+)\s*:\s*"([^"]+)"/);
    if (m) result[m[1]] = m[2];
  }
  return result;
}

describe("LoginPage REASON_MESSAGES copre i motivi del callback TMWE", () => {
  it("ogni reason ha un messaggio italiano non vuoto", async () => {
    const messages = await loadReasonMessages();
    const missing = CALLBACK_REASONS.filter((r) => !messages[r] || messages[r].trim().length === 0);
    expect(missing, `Mancano traduzioni per: ${missing.join(", ")}`).toEqual([]);
  });
});