import { render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { MobileBottomNav } from "@/components/mobile/MobileBottomNav";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { changeLanguage: vi.fn() } }),
}));

describe("MobileBottomNav", () => {
  const renderNav = (path = "/v2") =>
    render(
      <MemoryRouter initialEntries={[path]}>
        <MobileBottomNav />
      </MemoryRouter>
    );

  it("renders 5 navigation items", () => {
    renderNav();
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBe(5);
  });

  it("has data-testid mobile-bottom-nav", () => {
    const { container } = renderNav();
    expect(container.querySelector('[data-testid="mobile-bottom-nav"]')).toBeTruthy();
  });

  it("highlights active route", () => {
    renderNav("/v2");
    const buttons = screen.getAllByRole("button");
    expect(buttons[0].className).toContain("text-primary");
  });

  it("renders all nav labels", () => {
    renderNav();
    expect(screen.getByText("nav.dashboard")).toBeInTheDocument();
    expect(screen.getByText("nav.crm")).toBeInTheDocument();
    expect(screen.getByText("nav.outreach")).toBeInTheDocument();
    expect(screen.getByText("nav.settings")).toBeInTheDocument();
    // Central FAB shows the literal label "Mission"
    expect(screen.getByText("Mission")).toBeInTheDocument();
  });
});
