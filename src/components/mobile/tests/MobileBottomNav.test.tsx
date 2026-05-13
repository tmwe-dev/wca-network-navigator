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

  it("renders 5 navigation items (4 nav + Mission FAB)", () => {
    renderNav();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(5);
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

  it("renders all nav labels", () => {
    renderNav();
    // 4 items from mobileBottomNavPaths: command, inbox, cockpit, settings
    expect(screen.getByText("nav.command")).toBeInTheDocument();
    expect(screen.getByText("nav.inbox")).toBeInTheDocument();
    expect(screen.getByText("nav.cockpit")).toBeInTheDocument();
    expect(screen.getByText("nav.config")).toBeInTheDocument();
    // Central FAB shows the literal label "Mission"
    expect(screen.getByText("Mission")).toBeInTheDocument();
  });
});
