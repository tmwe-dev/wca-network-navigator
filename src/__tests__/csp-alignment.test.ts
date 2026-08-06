/**
 * CSP SSOT enforcement.
 *
 * src/lib/csp.ts è la fonte unica di verità per la Content-Security-Policy.
 * index.html ne contiene una copia statica (necessaria perché in SPA il browser
 * legge la CSP dal <meta http-equiv>). Questo test fallisce la build se le due
 * copie vanno fuori sincronia, evitando il drift segnalato dall'audit 2026-05-13.
 */
import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { CSP_HEADER, CSP_META_CONTENT } from "@/lib/csp";

describe("CSP alignment", () => {
  it("index.html meta CSP coincide con CSP_META_CONTENT", () => {
    const html = readFileSync(join(process.cwd(), "index.html"), "utf-8");
    const match = html.match(/http-equiv="Content-Security-Policy"\s*\n?\s*content="([^"]+)"/);
    expect(match, "meta CSP non trovato in index.html").not.toBeNull();
    const fromHtml = (match![1] ?? "").replace(/\s+/g, " ").trim();
    const fromTs = CSP_META_CONTENT.replace(/\s+/g, " ").trim();
    expect(fromHtml).toBe(fromTs);
  });

  it("frame-ancestors resta nell'header HTTP ma non nel meta (ignorato dal browser)", () => {
    expect(CSP_HEADER).toContain("frame-ancestors");
    expect(CSP_META_CONTENT).not.toContain("frame-ancestors");
  });
});
