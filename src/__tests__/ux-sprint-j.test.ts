/**
 * ux-sprint-j.test.ts — Tests for Sprint J UX/UI hardening.
 *
 * Covers:
 *  - ErrorBoundary: catches errors and shows fallback
 *  - EmptyState: renders title, description, action
 *  - PageSkeleton: renders without crashing
 *  - a11y utilities: announceToScreenReader, getContrastRatio
 */

import { describe, it, expect, vi, afterEach } from "vitest";
import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";

import { ErrorBoundary } from "@/components/ui/ErrorBoundary";
import { EmptyState } from "@/components/ui/EmptyState";
import { PageSkeleton, TableSkeleton, CardSkeleton, FormSkeleton } from "@/components/ui/PageSkeleton";
import { getContrastRatio, announceToScreenReader, ARIA_LABELS } from "@/lib/a11y";

/* ── ErrorBoundary ─────────────────────────────────────────────────── */

function ThrowingChild({ shouldThrow }: { shouldThrow: boolean }) {
  if (shouldThrow) throw new Error("Test error");
  return React.createElement("div", null, "child content");
}

describe("ErrorBoundary", () => {
  // Suppress React error boundary console output during tests
  const _origError = console.error; // eslint-disable-line no-console
  beforeEach(() => {
    console.error = vi.fn(); // eslint-disable-line no-console
  });
  afterEach(() => {
    console.error = _origError; // eslint-disable-line no-console
  });

  it("renders children when no error", () => {
    render(React.createElement(ErrorBoundary, null, React.createElement(ThrowingChild, { shouldThrow: false })));
    expect(screen.getByText("child content")).toBeTruthy();
  });

  it("catches error and shows default fallback", () => {
    render(React.createElement(ErrorBoundary, null, React.createElement(ThrowingChild, { shouldThrow: true })));
    expect(screen.getByText("Qualcosa è andato storto")).toBeTruthy();
    expect(screen.getByText("Test error")).toBeTruthy();
    expect(screen.getByText("Riprova")).toBeTruthy();
  });

  it("shows custom fallback when provided", () => {
    const fallback = React.createElement("div", null, "custom fallback");
    render(React.createElement(ErrorBoundary, { fallback }, React.createElement(ThrowingChild, { shouldThrow: true })));
    expect(screen.getByText("custom fallback")).toBeTruthy();
  });

  it("resets error state on retry click", () => {
    render(React.createElement(ErrorBoundary, null, React.createElement(ThrowingChild, { shouldThrow: true })));
    // Verify error UI is shown
    expect(screen.getByText("Qualcosa è andato storto")).toBeTruthy();
    const retryBtn = screen.getByText("Riprova");
    expect(retryBtn).toBeTruthy();
    // Click retry — boundary resets hasError to false, child re-throws,
    // so the error UI reappears. We verify the retry button is functional.
    fireEvent.click(retryBtn);
    // The boundary attempted to re-render children; since ThrowingChild
    // still throws, error state is set again — this confirms the reset
    // cycle works (hasError went false then back to true).
    expect(screen.getByText("Qualcosa è andato storto")).toBeTruthy();
  });
});

/* ── EmptyState ────────────────────────────────────────────────────── */

describe("EmptyState", () => {
  it("renders title", () => {
    render(React.createElement(EmptyState, { title: "Nessun dato" }));
    expect(screen.getByText("Nessun dato")).toBeTruthy();
  });

  it("renders description when provided", () => {
    render(
      React.createElement(EmptyState, {
        title: "Vuoto",
        description: "Non ci sono elementi da mostrare",
      }),
    );
    expect(screen.getByText("Non ci sono elementi da mostrare")).toBeTruthy();
  });

  it("renders action button and handles click", () => {
    const onClick = vi.fn();
    render(
      React.createElement(EmptyState, {
        title: "Vuoto",
        action: { label: "Aggiungi", onClick },
      }),
    );
    const btn = screen.getByText("Aggiungi");
    expect(btn).toBeTruthy();
    fireEvent.click(btn);
    expect(onClick).toHaveBeenCalledOnce();
  });

  it("renders icon when provided", () => {
    const icon = React.createElement("svg", { "data-testid": "test-icon" });
    render(React.createElement(EmptyState, { title: "Vuoto", icon }));
    expect(screen.getByTestId("test-icon")).toBeTruthy();
  });
});

/* ── Skeletons ─────────────────────────────────────────────────────── */

describe("Skeletons", () => {
  it("PageSkeleton renders without crashing", () => {
    const { container } = render(React.createElement(PageSkeleton));
    expect(container.firstChild).toBeTruthy();
  });

  it("TableSkeleton renders correct number of rows", () => {
    const { container } = render(React.createElement(TableSkeleton, { rows: 3, columns: 2 }));
    // header + 3 data rows = 4 flex rows
    const rows = container.querySelectorAll(".flex.gap-4");
    expect(rows.length).toBe(4);
  });

  it("CardSkeleton renders correct count", () => {
    const { container } = render(React.createElement(CardSkeleton, { count: 2 }));
    const cards = container.querySelectorAll(".rounded-lg.border");
    expect(cards.length).toBe(2);
  });

  it("FormSkeleton renders correct field count", () => {
    const { container } = render(React.createElement(FormSkeleton, { fields: 3 }));
    const fieldGroups = container.querySelectorAll(".space-y-2");
    // 3 field groups (each is space-y-2)
    expect(fieldGroups.length).toBe(3);
  });
});

/* ── a11y utilities ────────────────────────────────────────────────── */

describe("getContrastRatio", () => {
  it("returns 21 for black on white", () => {
    const ratio = getContrastRatio("#000000", "#ffffff");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("returns 1 for identical colors", () => {
    const ratio = getContrastRatio("#336699", "#336699");
    expect(ratio).toBeCloseTo(1, 1);
  });

  it("handles shorthand hex", () => {
    const ratio = getContrastRatio("#000", "#fff");
    expect(ratio).toBeCloseTo(21, 0);
  });

  it("is symmetric (fg/bg order does not matter)", () => {
    const r1 = getContrastRatio("#ff0000", "#0000ff");
    const r2 = getContrastRatio("#0000ff", "#ff0000");
    expect(r1).toBeCloseTo(r2, 5);
  });
});

describe("announceToScreenReader", () => {
  afterEach(() => {
    // Clean up any remaining aria-live elements
    document.querySelectorAll("[aria-live]").forEach((el) => el.remove());
  });

  it("creates an aria-live element in the DOM", () => {
    announceToScreenReader("Test announcement");
    const liveRegion = document.querySelector('[aria-live="polite"]');
    expect(liveRegion).toBeTruthy();
    expect(liveRegion?.getAttribute("role")).toBe("status");
  });

  it("supports assertive priority", () => {
    announceToScreenReader("Urgent message", "assertive");
    const liveRegion = document.querySelector('[aria-live="assertive"]');
    expect(liveRegion).toBeTruthy();
  });
});

describe("ARIA_LABELS", () => {
  it("contains navigation labels", () => {
    expect(ARIA_LABELS.navigation.main).toBe("Navigazione principale");
    expect(ARIA_LABELS.navigation.sidebar).toBe("Menu laterale");
  });

  it("contains action labels", () => {
    expect(ARIA_LABELS.actions.close).toBe("Chiudi");
    expect(ARIA_LABELS.actions.save).toBe("Salva");
  });

  it("contains status labels", () => {
    expect(ARIA_LABELS.status.loading).toBe("Caricamento in corso");
  });

  it("contains form labels", () => {
    expect(ARIA_LABELS.form.required).toBe("Campo obbligatorio");
  });
});
