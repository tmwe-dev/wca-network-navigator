import { describe, it, expect } from "vitest";

/**
 * Structural test: verifies App.tsx V1 deprecation and V2 routing.
 */
describe("App route protection", () => {
  let appSource: string;

  beforeAll(async () => {
    const fs = await import("fs");
    appSource = fs.readFileSync("src/App.tsx", "utf-8");
  });

  it("V1 routes are deprecated with redirect to V2", () => {
    expect(appSource).toContain('path="/v1/*"');
    expect(appSource).toContain("V1DeprecationRedirect");
  });

  it("V2 routes are wrapped in FeatureErrorBoundary", () => {
    expect(appSource).toContain("FeatureErrorBoundary");
    expect(appSource).toContain("V2Routes");
  });

  it("root redirects to /v2", () => {
    expect(appSource).toContain('<Route path="/" element={<Navigate to="/v2" replace />} />');
  });
});
