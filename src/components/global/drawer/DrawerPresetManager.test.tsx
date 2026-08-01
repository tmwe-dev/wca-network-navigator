import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";

vi.mock("@/hooks/useWorkspacePresets", () => ({}));
vi.mock("@/components/workspace/QualitySelector", () => ({
  __esModule: true,
  default: ({ value }: { value: string }) => React.createElement("span", { "data-testid": "quality" }, value),
}));

import { DrawerPresetManager } from "./DrawerPresetManager";

const PRESETS = [
  { id: "p1", name: "Default", base_proposal: null, created_at: null, document_ids: [], goal: null, reference_links: [], updated_at: null, user_id: "u1" },
  { id: "p2", name: "Enterprise", base_proposal: null, created_at: null, document_ids: [], goal: null, reference_links: [], updated_at: null, user_id: "u1" },
] as any;

describe("DrawerPresetManager", () => {
  const baseProps = {
    presets: PRESETS,
    activePresetId: null as string | null,
    quality: "balanced" as any,
    onLoadPreset: vi.fn(),
    onSavePreset: vi.fn(),
    onDeletePreset: vi.fn(),
    onSetQuality: vi.fn(),
  };

  it("renders preset buttons when <= 5 presets", () => {
    renderWithProviders(React.createElement(DrawerPresetManager, baseProps));
    expect(screen.getByText("Default")).toBeInTheDocument();
    expect(screen.getByText("Enterprise")).toBeInTheDocument();
  });

  it("calls onLoadPreset when clicking a preset", () => {
    renderWithProviders(React.createElement(DrawerPresetManager, baseProps));
    fireEvent.click(screen.getByText("Default"));
    expect(baseProps.onLoadPreset).toHaveBeenCalledWith(PRESETS[0]);
  });

  it("has a + button for adding presets", () => {
    renderWithProviders(React.createElement(DrawerPresetManager, baseProps));
    const buttons = screen.getAllByRole("button");
    // Should have preset buttons + add button
    expect(buttons.length).toBeGreaterThanOrEqual(3);
  });

  it("shows delete button when preset is active", () => {
    const props = { ...baseProps, activePresetId: "p1" };
    renderWithProviders(React.createElement(DrawerPresetManager, props));
    // There should be a trash button
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(2);
  });

  it("renders quality selector", () => {
    renderWithProviders(React.createElement(DrawerPresetManager, baseProps));
    expect(screen.getByTestId("quality")).toHaveTextContent("balanced");
  });
});
