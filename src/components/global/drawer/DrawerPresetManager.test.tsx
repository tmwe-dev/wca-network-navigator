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
  { id: "p1", name: "Default", config: {}, user_id: "u1", created_at: "" },
  { id: "p2", name: "Enterprise", config: {}, user_id: "u1", created_at: "" },
];

describe("DrawerPresetManager", () => {
  const baseProps = {
    presets: PRESETS,
    activePresetId: null as string | null,
    quality: "balanced" as const,
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

  it("opens save dialog on + button click", () => {
    renderWithProviders(React.createElement(DrawerPresetManager, baseProps));
    const plusBtn = screen.getByRole("button", { name: "" });
    // Find the + button by its position (last small button)
    const buttons = screen.getAllByRole("button");
    const addBtn = buttons.find(b => b.querySelector("svg"));
    if (addBtn) fireEvent.click(addBtn);
    // Dialog should appear
    expect(screen.getByText("Salva Preset")).toBeInTheDocument();
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
