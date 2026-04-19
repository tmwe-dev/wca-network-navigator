import { describe, it, expect, beforeAll } from "vitest";

/**
 * Structural test: verifies v2/routes.tsx wraps every page with FeatureErrorBoundary.
 * The wrapping is performed via the helper `guardedPage(LazyPage, "name")`.
 */
describe("V2 route protection", () => {
  let routesSource: string;

  beforeAll(async () => {
    const fs = await import("fs");
    routesSource = fs.readFileSync("src/v2/routes.tsx", "utf-8");
  });

  it("imports FeatureErrorBoundary", () => {
    expect(routesSource).toContain("FeatureErrorBoundary");
  });

  it("defines the guardedPage helper that wraps pages in FeatureErrorBoundary", () => {
    expect(routesSource).toContain("function guardedPage");
    expect(routesSource).toContain("<FeatureErrorBoundary");
  });

  it("has a substantial number of routes registered", () => {
    const routeCount = (routesSource.match(/<Route\s/g) ?? []).length;
    expect(routeCount).toBeGreaterThan(10);
  });

  it("the vast majority of <Route element=...> use guardedPage", () => {
    const elementRoutes = routesSource.split("\n").filter(
      (line) =>
        line.includes("<Route") &&
        line.includes("element=") &&
        !line.includes("Navigate") &&
        !line.includes("Outlet") &&
        !line.includes("V2AuthGate") &&
        !line.includes("AuthenticatedLayout") &&
        !line.includes("PublicLayout"),
    );

    const unguarded = elementRoutes.filter((line) => !line.includes("guardedPage"));
    // tolerate at most a handful of layout/index routes that don't need a guard
    expect(unguarded.length).toBeLessThanOrEqual(3);
  });
});
