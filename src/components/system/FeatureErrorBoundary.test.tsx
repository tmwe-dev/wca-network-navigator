import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { FeatureErrorBoundary } from "./FeatureErrorBoundary";

function ProblemChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test explosion");
  return <div>Working fine</div>;
}

describe("FeatureErrorBoundary", () => {
  it("renders children when no error", () => {
    render(
      <FeatureErrorBoundary feature="Test">
        <div>Hello</div>
      </FeatureErrorBoundary>
    );
    expect(screen.getByText("Hello")).toBeInTheDocument();
  });

  it("shows fallback UI on error", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FeatureErrorBoundary feature="Email Composer">
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText(/Something went wrong in Email Composer/)).toBeInTheDocument();
    expect(screen.getByText("Test explosion")).toBeInTheDocument();
    expect(screen.getByText("Retry")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("renders custom fallback when provided", () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    render(
      <FeatureErrorBoundary feature="Test" fallback={<div>Custom error</div>}>
        <ProblemChild shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText("Custom error")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });

  it("recovers after retry click", async () => {
    const consoleSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    let shouldThrow = true;

    function ToggleChild() {
      if (shouldThrow) throw new Error("boom");
      return <div>Recovered</div>;
    }

    const { rerender } = render(
      <FeatureErrorBoundary feature="Test">
        <ToggleChild />
      </FeatureErrorBoundary>
    );

    expect(screen.getByText(/Something went wrong/)).toBeInTheDocument();

    // Fix the error and click retry
    shouldThrow = false;
    const user = userEvent.setup();
    await user.click(screen.getByText("Retry"));

    // After retry, boundary resets and re-renders children
    expect(screen.getByText("Recovered")).toBeInTheDocument();
    consoleSpy.mockRestore();
  });
});
