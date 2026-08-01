import { render } from "@testing-library/react";
import { PageSkeleton } from "@/components/shared/PageSkeleton";

describe("PageSkeleton", () => {
  it("renders without crashing", () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstChild).toBeTruthy();
  });

  it("has animate-pulse class", () => {
    const { container } = render(<PageSkeleton />);
    expect(container.firstChild).toHaveClass("animate-pulse");
  });

  it("renders multiple skeleton blocks", () => {
    const { container } = render(<PageSkeleton />);
    const blocks = container.querySelectorAll(".bg-muted");
    expect(blocks.length).toBeGreaterThanOrEqual(3);
  });

  it("has rounded corners on skeleton blocks", () => {
    const { container } = render(<PageSkeleton />);
    const blocks = container.querySelectorAll(".rounded, .rounded-lg");
    expect(blocks.length).toBeGreaterThanOrEqual(2);
  });
});
