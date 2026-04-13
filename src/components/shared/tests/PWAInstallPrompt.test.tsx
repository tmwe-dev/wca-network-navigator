import { render, screen, act } from "@testing-library/react";
import { PWAInstallPrompt } from "@/components/shared/PWAInstallPrompt";

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (k: string) => k, i18n: { changeLanguage: vi.fn() } }),
}));

describe("PWAInstallPrompt", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing initially", () => {
    const { container } = render(<PWAInstallPrompt />);
    expect(container.innerHTML).toBe("");
  });

  it("shows prompt after beforeinstallprompt + delay", async () => {
    const { container } = render(<PWAInstallPrompt />);
    
    const event = new Event("beforeinstallprompt");
    Object.defineProperty(event, "preventDefault", { value: vi.fn() });
    
    act(() => { window.dispatchEvent(event); });
    
    act(() => { vi.advanceTimersByTime(31000); });
    
    expect(container.innerHTML).toContain("Installa");
  });

  it("hides on dismiss click", async () => {
    const { container } = render(<PWAInstallPrompt />);
    
    const event = new Event("beforeinstallprompt");
    Object.defineProperty(event, "preventDefault", { value: vi.fn() });
    
    act(() => { window.dispatchEvent(event); });
    act(() => { vi.advanceTimersByTime(31000); });
    
    const dismissBtn = screen.getByText("Non ora");
    act(() => { dismissBtn.click(); });
    
    expect(container.innerHTML).toBe("");
  });
});
