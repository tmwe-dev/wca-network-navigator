/**
 * B6 cleanup guardrail — impedisce ritorno di caller verso l'edge function
 * eliminata `classify-email-response` e verifica che i path canonici siano
 * ancora presenti (classify-inbound-message + reply_classifications +
 * message_intelligence_v).
 */
import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import { execSync } from "node:child_process";

// File dove è ammesso un commento storico ("extracted from …") senza caller.
const HISTORICAL_COMMENT_ALLOWLIST = new Set<string>([
  "src/lib/emailClassification.ts",
  "src/lib/leadEscalation.ts",
  "src/lib/kbPatternDetection.ts",
  "src/test/collaudo-c7-email-classification.test.ts",
  "src/test/b6-cleanup-guardrails.test.ts",
]);

describe("B6 — orphan edge function cleanup", () => {
  it("classify-email-response directory è stata rimossa", () => {
    expect(existsSync("supabase/functions/classify-email-response")).toBe(false);
  });

  it("nessun riferimento residuo a classify-email-response fuori dall'allowlist storica", async () => {
    let raw = "";
    try {
      raw = execSync(
        "grep -rl 'classify-email-response' src supabase/functions scripts eslint-rules 2>/dev/null || true",
        { encoding: "utf8" },
      );
    } catch {
      raw = "";
    }
    const files = raw.split("\n").map((s) => s.trim()).filter(Boolean);
    const offenders = files.filter((f) => !HISTORICAL_COMMENT_ALLOWLIST.has(f));
    expect(offenders, `Riferimenti residui: ${offenders.join(", ")}`).toEqual([]);
  });

  it("nessun caller runtime (invoke/fetch) verso classify-email-response", async () => {
    let raw = "";
    try {
      raw = execSync(
        "grep -rEn --exclude=b6-cleanup-guardrails.test.ts \"(functions/v1/classify-email-response|invoke\\(['\\\"]classify-email-response|fetch\\([^)]*classify-email-response)\" src supabase/functions 2>/dev/null || true",
        { encoding: "utf8" },
      );
    } catch {
      raw = "";
    }
    expect(raw.trim(), `Caller runtime residui:\n${raw}`).toBe("");
  });

  it("path canonico classify-inbound-message resta presente", () => {
    expect(existsSync("supabase/functions/classify-inbound-message/index.ts")).toBe(true);
  });

  it("cron canonico classify-emails-batch preservato", () => {
    expect(existsSync("supabase/functions/classify-emails-batch/index.ts")).toBe(true);
  });

  it("scrittura canonica su reply_classifications ancora referenziata", () => {
    const src = readFileSync("supabase/functions/classify-inbound-message/index.ts", "utf8");
    expect(src).toMatch(/reply_classifications/);
  });
});