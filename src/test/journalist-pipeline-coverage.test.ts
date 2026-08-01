/**
 * Editorial Layer coverage — pipeline messaggi
 *
 * 🔒 INTOCCABILE — vedi mem://tech/editorial-review-layer-mandatory
 *
 * Garantisce che ogni edge function che PRODUCE o INVIA un messaggio
 * (email/WhatsApp/LinkedIn) chiami `journalistReview` almeno una volta
 * e che NON esista più la guard `optimus.enabled` come kill-switch.
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(__dirname, "../..");

function read(rel: string): string {
  const p = resolve(ROOT, rel);
  expect(existsSync(p), `file mancante: ${rel}`).toBe(true);
  return readFileSync(p, "utf-8");
}

const PRODUCTION_POINTS = [
  "supabase/functions/generate-email/index.ts",
  "supabase/functions/improve-email/index.ts",
] as const;

const SEND_POINTS = [
  "supabase/functions/send-email/index.ts",
  "supabase/functions/send-whatsapp/index.ts",
  "supabase/functions/send-linkedin/index.ts",
  "supabase/functions/process-email-queue/index.ts",
] as const;

const AGENT_POINTS = [
  "supabase/functions/agent-execute/toolHandlers/emailTools.ts",
] as const;

describe("Editorial Layer — pipeline coverage", () => {
  it.each([...PRODUCTION_POINTS, ...SEND_POINTS, ...AGENT_POINTS])(
    "%s invoca journalistReview()",
    (path) => {
      const src = read(path);
      expect(src).toMatch(/journalistReview\s*\(/);
    },
  );

  it("agent-execute copre TUTTI e 3 i canali (email, whatsapp, linkedin)", () => {
    const src = read("supabase/functions/agent-execute/toolHandlers/emailTools.ts");
    // 3 occorrenze attese: send_email, send_whatsapp, send_linkedin
    const matches = src.match(/journalistReview\s*\(/g) || [];
    expect(matches.length).toBeGreaterThanOrEqual(3);
  });

  it("loadOptimusSettings non è più un kill-switch — ritorna sempre enabled:true", () => {
    const src = read("supabase/functions/_shared/journalistSelector.ts");
    expect(src).toMatch(/return\s*\{\s*enabled:\s*true/);
    // la chiave journalist_optimus_enabled NON deve più essere letta
    expect(src).not.toMatch(/"journalist_optimus_enabled"/);
  });

  it("nessun chiamante usa più optimus.enabled come gate", () => {
    const files = [
      ...PRODUCTION_POINTS,
      ...AGENT_POINTS,
    ];
    for (const f of files) {
      const src = read(f);
      expect(src, `kill-switch trovato in ${f}`).not.toMatch(/optimus\.enabled\s*&&/);
    }
  });

  it("orchestratori che chiamano send-email passano partner_id (no contesto vuoto)", () => {
    const orchestrators = [
      "supabase/functions/pending-action-executor/index.ts",
      "supabase/functions/_shared/platformTools/outreachHandler.ts",
      "supabase/functions/_shared/platformToolHandlers/outreachTools.ts",
      "supabase/functions/_shared/toolHandlersWrite.ts",
    ];
    for (const f of orchestrators) {
      const src = read(f);
      // tutti i body diretti a send-email DEVONO contenere partner_id
      // Match solo POST/invoke verso send-email (non stringhe di log come "send-email failed").
      const sendEmailFetch =
        src.match(/(?:functions\/v1\/send-email|invokeEdge[^)]*"send-email"|invoke\([^)]*"send-email"|fetch[^)]*send-email)[^]*?\}\s*\)/g) || [];
      expect(sendEmailFetch.length).toBeGreaterThan(0);
      for (const block of sendEmailFetch) {
        expect(block, `partner_id mancante in ${f}`).toMatch(/partner_id/);
      }
    }
  });
});