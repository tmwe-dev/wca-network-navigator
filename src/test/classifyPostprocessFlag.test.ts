/**
 * B5 gate — verifica che il fallback classifyInboundEmails sia disattivato
 * di default nel modulo _shared/inboxPostProcess.ts e riabilitabile via env.
 * Read-only: legge il sorgente e controlla la presenza del gate.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const SRC = resolve(process.cwd(), "supabase/functions/_shared/inboxPostProcess.ts");

describe("B5 · classify postProcess fallback flag", () => {
  const src = readFileSync(SRC, "utf8");

  it("legge il flag CLASSIFY_POSTPROCESS_FALLBACK_ENABLED", () => {
    expect(src).toContain("CLASSIFY_POSTPROCESS_FALLBACK_ENABLED");
  });

  it("default OFF: early return se flag non 'true'", () => {
    expect(src).toMatch(/if\s*\(!enabled\)\s*return;/);
  });

  it("mantiene il path legacy fetch(classify-inbound-message) per rollback", () => {
    expect(src).toContain("/functions/v1/classify-inbound-message");
    expect(src).toContain("x-invoke-source");
  });
});
