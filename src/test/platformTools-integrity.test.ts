/**
 * platformTools integrity — Vol. I Fase 5 (guardrails) + Vol. II §4.6.
 *
 * Verifica che le definizioni PLATFORM_TOOLS e il gestore executePlatformTool
 * siano coerenti: nomi unici, parametri validi, ogni definizione ha un handler.
 *
 * Questo test gira in Vitest (frontend) leggendo i sorgenti come testo,
 * così non serve il runtime Deno.
 */
import { describe, it, expect } from "vitest";
import * as fs from "fs";
import * as path from "path";

const TOOLS_PATH = path.resolve(__dirname, "../../supabase/functions/_shared/platformTools.ts");
const source = fs.readFileSync(TOOLS_PATH, "utf-8");

// Estrai tutti i nomi dei tool dalle definizioni (name: "xxx")
function extractToolNames(): string[] {
  const toolSection = source.split("export const PLATFORM_TOOLS")[1]?.split("];")[0] ?? "";
  const matches = [...toolSection.matchAll(/name:\s*"([^"]+)"/g)];
  return matches.map((m) => m[1]);
}

// Estrai tutti i case handler (case "xxx":)
function extractHandlerCases(): string[] {
  const handlerSection = source.split("export async function executePlatformTool")[1] ?? "";
  const matches = [...handlerSection.matchAll(/case\s+"([^"]+)":/g)];
  return matches.map((m) => m[1]);
}

describe("PLATFORM_TOOLS integrity", () => {
  const toolNames = extractToolNames();
  const handlerCases = extractHandlerCases();

  it("ha almeno 30 tool definiti", () => {
    expect(toolNames.length).toBeGreaterThanOrEqual(30);
  });

  it("nomi dei tool sono unici (nessun duplicato)", () => {
    const dupes = toolNames.filter((n, i) => toolNames.indexOf(n) !== i);
    expect(dupes).toEqual([]);
  });

  it("ogni tool definito ha un handler corrispondente nel switch", () => {
    const missing = toolNames.filter((n) => !handlerCases.includes(n));
    expect(missing).toEqual([]);
  });

  it("ogni handler nel switch ha una definizione corrispondente", () => {
    const orphans = handlerCases.filter((n) => !toolNames.includes(n));
    expect(orphans).toEqual([]);
  });

  it("ogni tool ha type: 'function' e un oggetto function con name e parameters", () => {
    // Verifica struttura base tramite regex sulle definizioni
    const toolBlocks = source.split("export const PLATFORM_TOOLS")[1]?.split("];")[0] ?? "";
    const entries = [...toolBlocks.matchAll(/\{\s*type:\s*"function",\s*function:\s*\{[^}]*name:\s*"([^"]+)"/g)];
    expect(entries.length).toBe(toolNames.length);
  });

  it("ogni tool definition ha un campo parameters con type: 'object'", () => {
    const toolBlock = source.split("export const PLATFORM_TOOLS")[1]?.split("];")[0] ?? "";
    for (const name of toolNames) {
      const pattern = new RegExp(`name:\\s*"${name}".*?parameters:\\s*\\{\\s*type:\\s*"object"`, "s");
      expect(pattern.test(toolBlock)).toBe(true);
    }
  });
});

describe("ApiError completezza", () => {
  it("mappa tutti gli status HTTP critici", () => {
    // Verifica che invokeEdge copra gli status principali
    const invokeSource = fs.readFileSync(
      path.resolve(__dirname, "../lib/api/invokeEdge.ts"),
      "utf-8"
    );
    const expectedStatuses = [401, 403, 404, 422, 429, 500];
    for (const status of expectedStatuses) {
      expect(invokeSource).toContain(`status === ${status}`);
    }
  });
});
