import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { CommunicationStep } from "./CommunicationStep";

vi.mock("@/data/emailPrompts", () => ({
  findActiveEmailPrompts: vi.fn().mockResolvedValue([]),
}));

const baseData = { communication: { templateMode: "ai_generate" as const } };

describe("CommunicationStep", () => {
  it("renders all three mode options", () => {
    renderWithProviders(React.createElement(CommunicationStep, { data: baseData, onChange: vi.fn() }));
    expect(screen.getByText(/AI genera in tempo reale/)).toBeInTheDocument();
    expect(screen.getByText(/Scegli un tipo email/)).toBeInTheDocument();
    expect(screen.getByText(/Scrivi tu il modello/)).toBeInTheDocument();
  });

  it("shows AI info when ai_generate is selected", () => {
    renderWithProviders(React.createElement(CommunicationStep, { data: baseData, onChange: vi.fn() }));
    expect(screen.getByText(/genererà un messaggio unico/)).toBeInTheDocument();
  });

  it("calls onChange when selecting custom mode", () => {
    const onChange = vi.fn();
    renderWithProviders(React.createElement(CommunicationStep, { data: baseData, onChange }));
    fireEvent.click(screen.getByText(/Scrivi tu il modello/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ communication: expect.objectContaining({ templateMode: "custom" }) })
    );
  });

  it("shows subject and body inputs in custom mode", () => {
    const customData = { communication: { templateMode: "custom" as const } };
    renderWithProviders(React.createElement(CommunicationStep, { data: customData, onChange: vi.fn() }));
    expect(screen.getByPlaceholderText(/Partnership opportunity/)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Scrivi il modello del messaggio/)).toBeInTheDocument();
  });

  it("updates custom subject via onChange", () => {
    const onChange = vi.fn();
    const customData = { communication: { templateMode: "custom" as const, customSubject: "" } };
    renderWithProviders(React.createElement(CommunicationStep, { data: customData, onChange }));
    fireEvent.change(screen.getByPlaceholderText(/Partnership opportunity/), { target: { value: "Hello {{company}}" } });
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ communication: expect.objectContaining({ customSubject: "Hello {{company}}" }) })
    );
  });
});
