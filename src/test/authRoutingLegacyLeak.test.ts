import { describe, it, expect, beforeAll } from "vitest";

describe("Auth and routing legacy leak guardrails", () => {
  let authCallbackSource: string;
  let commandPaletteSource: string;
  let appSource: string;

  beforeAll(async () => {
    const fs = await import("fs");
    authCallbackSource = fs.readFileSync("src/v2/ui/pages/AuthCallbackPage.tsx", "utf-8");
    commandPaletteSource = fs.readFileSync("src/components/CommandPalette.tsx", "utf-8");
    appSource = fs.readFileSync("src/App.tsx", "utf-8");
  });

  it("auth callback redirects to /v2/command, not /v1", () => {
    expect(authCallbackSource).not.toContain('navigate("/v1", { replace: true })');
    expect(authCallbackSource).toContain('navigate("/v2/command", { replace: true })');
  });

  it("command palette does not leak legacy /v1 routes", () => {
    // Il palette è stato riscritto sopra navConfig (SSOT delle 7 macro-aree).
    // Non deve più contenere alcuna route legacy /v1 né path split v1/v2.
    expect(commandPaletteSource).not.toMatch(/["'`]\/v1(?:\/|["'`])/);
    expect(commandPaletteSource).not.toContain("v1Path");
    expect(commandPaletteSource).not.toContain('startsWith("/v1")');
    // Deve continuare a puntare alla navigazione V2 canonica.
    expect(commandPaletteSource).toContain('from "@/v2/ui/templates/navConfig"');
  });

  it("legacy V1 URLs redirect to V2", () => {
    expect(appSource).toContain("V1DeprecationRedirect");
    expect(appSource).toContain('<Route path="/v1/*" element={<V1DeprecationRedirect />} />');
    expect(appSource).not.toContain("LauncherHome");
  });
});
