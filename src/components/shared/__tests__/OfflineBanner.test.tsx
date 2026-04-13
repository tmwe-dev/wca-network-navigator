import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

vi.mock("@/hooks/useOnlineStatus", () => ({ useOnlineStatus: vi.fn() }));
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string, d: string) => d }),
}));

import { OfflineBanner } from "../OfflineBanner";
import { useOnlineStatus } from "@/hooks/useOnlineStatus";

describe("OfflineBanner", () => {
  it("renders nothing when online", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(true);
    const { container } = render(React.createElement(OfflineBanner));
    expect(container.innerHTML).toBe("");
  });

  it("renders alert when offline", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false);
    render(React.createElement(OfflineBanner));
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("has role=alert for accessibility", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false);
    render(React.createElement(OfflineBanner));
    expect(screen.getByRole("alert")).toBeDefined();
  });

  it("shows offline message text", () => {
    vi.mocked(useOnlineStatus).mockReturnValue(false);
    render(React.createElement(OfflineBanner));
    expect(screen.getByText(/offline/i)).toBeDefined();
  });
});
