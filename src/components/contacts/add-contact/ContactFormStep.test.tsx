import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { CompanyTabContent, ContactTabContent, NotesTabContent } from "./ContactFormStep";
import type { ContactFormData } from "@/hooks/useAddContactForm";

vi.mock("@/lib/countries", () => ({
  getCountryFlag: (code: string) => `🏳️${code}`,
}));

const EMPTY_FORM: ContactFormData = {
  companyName: "", companyAlias: "", country: "", city: "", address: "",
  zipCode: "", companyPhone: "", companyEmail: "", website: "",
  contactName: "", contactAlias: "", position: "", contactEmail: "",
  contactPhone: "", contactMobile: "", origin: "", note: "",
  logoUrl: "", linkedinUrl: "",
};

const FILLED_FORM: ContactFormData = {
  ...EMPTY_FORM,
  companyName: "Acme Corp",
  city: "Milano",
  contactName: "John Doe",
  contactEmail: "john@acme.com",
  origin: "Fiera Milano",
  note: "Interesting partner",
};

describe("CompanyTabContent", () => {
  it("renders company name input with value", () => {
    renderWithProviders(React.createElement(CompanyTabContent, { form: FILLED_FORM, onFieldChange: vi.fn() }));
    const input = screen.getByPlaceholderText("Es. Acme Logistics Srl");
    expect(input).toHaveValue("Acme Corp");
  });

  it("calls onFieldChange when company name changes", () => {
    const onChange = vi.fn();
    renderWithProviders(React.createElement(CompanyTabContent, { form: EMPTY_FORM, onFieldChange: onChange }));
    fireEvent.change(screen.getByPlaceholderText("Es. Acme Logistics Srl"), { target: { value: "Test" } });
    expect(onChange).toHaveBeenCalledWith("companyName", "Test");
  });

  it("renders city input", () => {
    renderWithProviders(React.createElement(CompanyTabContent, { form: FILLED_FORM, onFieldChange: vi.fn() }));
    expect(screen.getByPlaceholderText("Milano")).toHaveValue("Milano");
  });

  it("renders all expected labels", () => {
    renderWithProviders(React.createElement(CompanyTabContent, { form: EMPTY_FORM, onFieldChange: vi.fn() }));
    expect(screen.getByText("Nome Azienda *")).toBeInTheDocument();
    expect(screen.getByText("Città")).toBeInTheDocument();
    expect(screen.getByText("Sito Web")).toBeInTheDocument();
  });

  it("renders placeholder for website", () => {
    renderWithProviders(React.createElement(CompanyTabContent, { form: EMPTY_FORM, onFieldChange: vi.fn() }));
    expect(screen.getByPlaceholderText("https://...")).toBeInTheDocument();
  });
});

describe("ContactTabContent", () => {
  it("renders contact name input", () => {
    renderWithProviders(React.createElement(ContactTabContent, { form: FILLED_FORM, onFieldChange: vi.fn() }));
    expect(screen.getByPlaceholderText("Mario Rossi")).toHaveValue("John Doe");
  });

  it("calls onFieldChange for contact email", () => {
    const onChange = vi.fn();
    renderWithProviders(React.createElement(ContactTabContent, { form: EMPTY_FORM, onFieldChange: onChange }));
    fireEvent.change(screen.getByPlaceholderText("mario@azienda.com"), { target: { value: "test@test.com" } });
    expect(onChange).toHaveBeenCalledWith("contactEmail", "test@test.com");
  });

  it("shows LinkedIn URL when provided", () => {
    const form = { ...FILLED_FORM, linkedinUrl: "https://www.linkedin.com/in/johndoe" };
    renderWithProviders(React.createElement(ContactTabContent, { form, onFieldChange: vi.fn() }));
    expect(screen.getByText("linkedin.com/in/johndoe")).toBeInTheDocument();
  });

  it("hides LinkedIn section when no URL", () => {
    renderWithProviders(React.createElement(ContactTabContent, { form: FILLED_FORM, onFieldChange: vi.fn() }));
    expect(screen.queryByText(/linkedin/i)).not.toBeInTheDocument();
  });

  it("renders position input", () => {
    renderWithProviders(React.createElement(ContactTabContent, { form: EMPTY_FORM, onFieldChange: vi.fn() }));
    expect(screen.getByPlaceholderText("Sales Manager")).toBeInTheDocument();
  });
});

describe("NotesTabContent", () => {
  it("renders origin and note fields", () => {
    renderWithProviders(React.createElement(NotesTabContent, { form: FILLED_FORM, onFieldChange: vi.fn() }));
    expect(screen.getByDisplayValue("Fiera Milano")).toBeInTheDocument();
    expect(screen.getByDisplayValue("Interesting partner")).toBeInTheDocument();
  });

  it("calls onFieldChange for note", () => {
    const onChange = vi.fn();
    renderWithProviders(React.createElement(NotesTabContent, { form: EMPTY_FORM, onFieldChange: onChange }));
    fireEvent.change(screen.getByPlaceholderText(/Appunti/), { target: { value: "New note" } });
    expect(onChange).toHaveBeenCalledWith("note", "New note");
  });
});
