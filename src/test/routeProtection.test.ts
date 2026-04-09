import { describe, it, expect } from "vitest";

/**
 * Structural test: verifies App.tsx uses FeatureErrorBoundary on all routes.
 * Reads the source file and checks that every <Route element= uses withFeatureBoundary.
 */
describe("App route protection", () => {
  let appSource: string;

  beforeAll(async () => {
    const fs = await import("fs");
    appSource = fs.readFileSync("src/App.tsx", "utf-8");
  });

  it("imports withFeatureBoundary", () => {
    expect(appSource).toContain("withFeatureBoundary");
  });

  it("all non-redirect protected routes use withFeatureBoundary", () => {
    const routeLines = appSource.split("\n").filter(
      (line) => line.includes("<Route") && line.includes("element=") && !line.includes("Navigate") && !line.includes("ProtectedRoute") && !line.includes("AppLayout") && !line.includes("Auth") && !line.includes("Onboarding") && !line.includes("ResetPassword") && !line.includes("NotFound")
    );

    expect(routeLines.length).toBeGreaterThan(10);

    const unprotected = routeLines.filter(
      (line) => !line.includes("withFeatureBoundary")
    );

    expect(unprotected).toEqual([]);
  });
});
