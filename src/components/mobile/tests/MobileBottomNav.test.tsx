import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { changeLanguage: vi.fn() } }),
}));

describe("MobileBottomNav", () => {
  const renderNav = (path = "/v2/command") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <MobileBottomNav />
      </MemoryRouter>,
    );

  it("renders navigation items + Mission FAB", () => {
    renderNav();
    const buttons = screen.getAllByRole("button");
    // Lean Mode filters mobileBottomNavPaths down to those present in LEAN_NAV_PATHS,
    // plus the central Mission FAB. We assert ≥2 to remain stable across mode changes.
    expect(buttons.length).toBeGreaterThanOrEqual(2);
  });

  it("has data-testid mobile-bottom-nav", () => {
    const { container } = renderNav();
    expect(container.querySelector('[data-testid="mobile-bottom-nav"]')).toBeTruthy();
  });

  it("highlights active route", () => {
    renderNav("/v2/command");
    const buttons = screen.getAllByRole("button");
    // first button is the first left nav item
    expect(buttons[0].className).toContain("text-primary");
  });

  it("renders core nav labels and the Mission FAB", () => {
    renderNav();
    expect(screen.getByText("nav.command")).toBeInTheDocument();
    expect(screen.getByText("nav.cockpit")).toBeInTheDocument();
    expect(screen.getByText("nav.config")).toBeInTheDocument();
    expect(screen.getByText("Mission")).toBeInTheDocument();
  });
});
