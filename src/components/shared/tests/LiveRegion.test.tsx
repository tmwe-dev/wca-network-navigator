import { render, screen } from "@testing-library/react";
import { LiveRegion } from "@/components/shared/LiveRegion";

describe("LiveRegion", () => {
  it("renders with aria-live polite", () => {
    render(<LiveRegion message="Test" />);
    const el = screen.getByText("Test");
    expect(el.closest("[aria-live]")).toHaveAttribute("aria-live", "polite");
  });

  it("renders with aria-atomic true", () => {
    render(<LiveRegion message="Test" />);
    const el = screen.getByText("Test");
    expect(el.closest("[aria-atomic]")).toHaveAttribute("aria-atomic", "true");
  });

  it("has sr-only class", () => {
    render(<LiveRegion message="Hidden text" />);
    const el = screen.getByText("Hidden text").closest("div");
    expect(el).toHaveClass("sr-only");
  });

  it("updates when message changes", () => {
    const { rerender } = render(<LiveRegion message="First" />);
    expect(screen.getByText("First")).toBeInTheDocument();
    rerender(<LiveRegion message="Second" />);
    expect(screen.getByText("Second")).toBeInTheDocument();
  });

  it("renders empty string without crashing", () => {
    render(<LiveRegion message="" />);
    const el = document.querySelector("[aria-live]");
    expect(el).toBeInTheDocument();
  });
});
