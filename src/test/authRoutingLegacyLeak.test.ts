import { describe, it, expect, beforeAll } from "vitest";

describe("Auth and routing legacy leak guardrails", () => {
  let authSource: string;
  let commandPaletteSource: string;
  let appSource: string;

  beforeAll(async () => {
    const fs = await import("fs");
    authSource = fs.readFileSync("src/pages/Auth.tsx", "utf-8");
    commandPaletteSource = fs.readFileSync("src/components/CommandPalette.tsx", "utf-8");
    appSource = fs.readFileSync("src/App.tsx", "utf-8");
  });

  it("auth no longer hardcodes post-login redirect to /v1", () => {
    expect(authSource).not.toContain('navigate("/v1", { replace: true })');
    expect(authSource).toContain('return "/v2"');
    expect(authSource).toContain("navigate(redirectTo, { replace: true })");
  });

  it("command palette resolves V2-safe mission routes", () => {
    expect(commandPaletteSource).toContain('v2Path: "/v2/missions"');
    expect(commandPaletteSource).toContain('const isV2 = location.pathname.startsWith("/v2")');
  });

  it("all /v1/* routes redirect to V2 via deprecation catch-all", () => {
    expect(appSource).toContain('path="/v1/*"');
    expect(appSource).toContain("V1DeprecationRedirect");
  });
});