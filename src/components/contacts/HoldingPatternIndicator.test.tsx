import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";

describe("HoldingPatternIndicator", () => {
  it("renders all phase labels for 'new' status", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "new" }));
    expect(screen.getByText("Nuovo")).toBeInTheDocument();
    expect(screen.getByText("Primo contatto")).toBeInTheDocument();
    expect(screen.getByText("In attesa")).toBeInTheDocument();
    expect(screen.getByText("Agganciato")).toBeInTheDocument();
    expect(screen.getByText("Qualificato")).toBeInTheDocument();
    expect(screen.getByText("Trattativa")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
  });

  it("renders 'Archiviato' badge for archived status", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "archived" }));
    expect(screen.getByText("Archiviato")).toBeInTheDocument();
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
  });

  it("renders 'Blacklist' badge for blacklisted status", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "blacklisted" }));
    expect(screen.getByText("Blacklist")).toBeInTheDocument();
  });

  it("calls onChangeStatus when clicking a future phase", () => {
    const onChangeStatus = vi.fn();
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "new", onChangeStatus }));
    fireEvent.click(screen.getByText("Primo contatto"));
    expect(onChangeStatus).toHaveBeenCalledWith("first_touch_sent");
  });

  it("shows confirmation dialog when clicking a past phase", () => {
    const onChangeStatus = vi.fn();
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "holding", onChangeStatus }));
    fireEvent.click(screen.getByText("Primo contatto"));
    expect(screen.getByText("Conferma cambio stato")).toBeInTheDocument();
  });

  it("does not show labels in compact mode", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "first_touch_sent", compact: true }));
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
    expect(screen.queryByText("Primo contatto")).not.toBeInTheDocument();
  });

  it("buttons are disabled when no onChangeStatus", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "new" }));
    const buttons = screen.getAllByRole("button");
    buttons.forEach(btn => expect(btn).toBeDisabled());
  });
});
