import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { ContactRecordFields } from "./ContactRecordFields";
import type { UnifiedRecord } from "@/hooks/useContactRecord";

vi.mock("./HoldingPatternIndicator", () => ({
  HoldingPatternIndicator: () => null,
}));

// Actually mock from contacts
vi.mock("@/components/contacts/HoldingPatternIndicator", () => ({
  HoldingPatternIndicator: () => null,
}));

const RECORD: UnifiedRecord = {
  id: "r1",
  sourceType: "contact",
  companyName: "Acme Corp",
  contactName: "John Doe",
  email: "john@acme.com",
  phone: "+39 02 1234567",
  mobile: "+39 333 1234567",
  country: "IT",
  city: "Milano",
  address: "Via Roma 1",
  position: "Sales Manager",
  website: "https://acme.com",
  note: "Good partner",
  leadStatus: "contacted",
  linkedinUrl: null,
  origin: "import",
};

describe("ContactRecordFields", () => {
  it("displays record fields in view mode", () => {
    renderWithProviders(React.createElement(ContactRecordFields, { record: RECORD, onSave: vi.fn(), isSaving: false }));
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
    expect(screen.getByText("john@acme.com")).toBeInTheDocument();
    expect(screen.getByText("Milano")).toBeInTheDocument();
  });

  it("shows Modifica button in view mode", () => {
    renderWithProviders(React.createElement(ContactRecordFields, { record: RECORD, onSave: vi.fn(), isSaving: false }));
    expect(screen.getByText("Modifica")).toBeInTheDocument();
  });

  it("switches to edit mode on Modifica click", () => {
    renderWithProviders(React.createElement(ContactRecordFields, { record: RECORD, onSave: vi.fn(), isSaving: false }));
    fireEvent.click(screen.getByText("Modifica"));
    expect(screen.getByText("Salva")).toBeInTheDocument();
    expect(screen.getByText("Annulla")).toBeInTheDocument();
  });

  it("shows note text in view mode", () => {
    renderWithProviders(React.createElement(ContactRecordFields, { record: RECORD, onSave: vi.fn(), isSaving: false }));
    expect(screen.getByText("Good partner")).toBeInTheDocument();
  });

  it("shows 'Nessuna nota' when note is empty", () => {
    const empty = { ...RECORD, note: "" };
    renderWithProviders(React.createElement(ContactRecordFields, { record: empty, onSave: vi.fn(), isSaving: false }));
    expect(screen.getByText("Nessuna nota")).toBeInTheDocument();
  });

  it("calls onSave with changed fields", () => {
    const onSave = vi.fn();
    renderWithProviders(React.createElement(ContactRecordFields, { record: RECORD, onSave, isSaving: false }));
    fireEvent.click(screen.getByText("Modifica"));
    // Change company name in the edit inputs
    const inputs = screen.getAllByRole("textbox");
    // First text input should be company name
    fireEvent.change(inputs[0], { target: { value: "New Corp" } });
    fireEvent.click(screen.getByText("Salva"));
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ company_name: "New Corp" }));
  });
});
