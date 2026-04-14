import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { HoldingPatternIndicator } from "./HoldingPatternIndicator";

describe("HoldingPatternIndicator", () => {
  it("renders all phase labels for 'new' status", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "new" }));
    expect(screen.getByText("Nuovo")).toBeInTheDocument();
    expect(screen.getByText("Contattato")).toBeInTheDocument();
    expect(screen.getByText("In corso")).toBeInTheDocument();
    expect(screen.getByText("Trattativa")).toBeInTheDocument();
    expect(screen.getByText("Cliente")).toBeInTheDocument();
  });

  it("renders 'Perso' badge for lost status", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "lost" }));
    expect(screen.getByText("Perso")).toBeInTheDocument();
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
  });

  it("calls onChangeStatus when clicking a future phase", () => {
    const onChangeStatus = vi.fn();
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "new", onChangeStatus }));
    fireEvent.click(screen.getByText("Contattato"));
    expect(onChangeStatus).toHaveBeenCalledWith("contacted");
  });

  it("shows confirmation dialog when clicking a past phase", () => {
    const onChangeStatus = vi.fn();
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "in_progress", onChangeStatus }));
    fireEvent.click(screen.getByText("Contattato"));
    expect(screen.getByText("Conferma cambio stato")).toBeInTheDocument();
  });

  it("does not show labels in compact mode", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "contacted", compact: true }));
    expect(screen.queryByText("Nuovo")).not.toBeInTheDocument();
    expect(screen.queryByText("Contattato")).not.toBeInTheDocument();
  });

  it("buttons are disabled when no onChangeStatus", () => {
    renderWithProviders(React.createElement(HoldingPatternIndicator, { status: "new" }));
    const buttons = screen.getAllByRole("button");
    buttons.forEach(btn => expect(btn).toBeDisabled());
  });
});
