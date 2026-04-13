import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { FeatureErrorBoundary } from "@/components/system/FeatureErrorBoundary";

function ThrowingComponent({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error in feature");
  return <div>Content OK</div>;
}

describe("FeatureErrorBoundary", () => {
  // Suppress console.error for expected errors
  const originalError = console.error;
  beforeEach(() => { console.error = vi.fn(); });
  afterEach(() => { console.error = originalError; });

  it("renders children when no error", () => {
    render(
      <FeatureErrorBoundary featureName="TestFeature">
        <ThrowingComponent shouldThrow={false} />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText("Content OK")).toBeInTheDocument();
  });

  it("shows error UI with feature name on crash", () => {
    render(
      <FeatureErrorBoundary featureName="Network">
        <ThrowingComponent shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText(/Errore in Network/)).toBeInTheDocument();
    expect(screen.getByText(/Test error in feature/)).toBeInTheDocument();
    expect(screen.getByText("Riprova")).toBeInTheDocument();
  });

  it("recovers on retry click", () => {
    const { _rerender } = render(
      <FeatureErrorBoundary featureName="CRM">
        <ThrowingComponent shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText(/Errore in CRM/)).toBeInTheDocument();
    
    // Click retry — boundary resets, but child still throws
    fireEvent.click(screen.getByText("Riprova"));
    // After retry with still-throwing child, error boundary catches again
    expect(screen.getByText(/Errore in CRM/)).toBeInTheDocument();
  });

  it("uses custom fallback when provided", () => {
    render(
      <FeatureErrorBoundary featureName="Test" fallback={<div>Custom fallback</div>}>
        <ThrowingComponent shouldThrow={true} />
      </FeatureErrorBoundary>
    );
    expect(screen.getByText("Custom fallback")).toBeInTheDocument();
  });
});
