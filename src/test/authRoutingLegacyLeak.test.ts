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

  it("command palette resolves V2-safe mission routes", () => {
    expect(commandPaletteSource).toContain('v2Path: "/v2/agents/missions"');
    expect(commandPaletteSource).toContain('const isV2 = location.pathname.startsWith("/v2")');
  });

  it("legacy V1 URLs redirect to V2", () => {
    expect(appSource).toContain("V1DeprecationRedirect");
    expect(appSource).toContain('<Route path="/v1/*" element={<V1DeprecationRedirect />} />');
    expect(appSource).not.toContain("LauncherHome");
  });
});
