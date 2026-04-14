import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";
import { AttachmentStep } from "./AttachmentStep";

vi.mock("@/data/emailTemplates", () => ({
  findEmailTemplatesShort: vi.fn().mockResolvedValue([]),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        list: vi.fn().mockResolvedValue({ data: [] }),
        getPublicUrl: (name: string) => ({ data: { publicUrl: `https://cdn/${name}` } }),
      }),
    },
  },
}));

const baseData = { attachments: { templateIds: [], imageIds: [], links: [], includeSignatureImage: true } };

describe("AttachmentStep", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders sections for documents, images, and links", () => {
    renderWithProviders(React.createElement(AttachmentStep, { data: baseData, onChange: vi.fn() }));
    expect(screen.getByText(/Documenti da allegare/)).toBeInTheDocument();
    expect(screen.getByText(/Immagini nel corpo email/)).toBeInTheDocument();
    expect(screen.getByText(/Link da includere/)).toBeInTheDocument();
  });

  it("shows 'no templates' message when empty", () => {
    renderWithProviders(React.createElement(AttachmentStep, { data: baseData, onChange: vi.fn() }));
    expect(screen.getByText(/Nessun template caricato/)).toBeInTheDocument();
  });

  it("adds a link when clicking + button", () => {
    const onChange = vi.fn();
    renderWithProviders(React.createElement(AttachmentStep, { data: baseData, onChange }));
    fireEvent.change(screen.getByPlaceholderText("https://..."), { target: { value: "https://example.com" } });
    fireEvent.click(screen.getByText("+"));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ attachments: expect.objectContaining({ links: ["https://example.com"] }) })
    );
  });

  it("does not add empty link", () => {
    const onChange = vi.fn();
    renderWithProviders(React.createElement(AttachmentStep, { data: baseData, onChange }));
    fireEvent.click(screen.getByText("+"));
    expect(onChange).not.toHaveBeenCalled();
  });

  it("renders signature toggle", () => {
    renderWithProviders(React.createElement(AttachmentStep, { data: baseData, onChange: vi.fn() }));
    expect(screen.getByText("Includi immagine firma")).toBeInTheDocument();
  });

  it("shows existing links as badges", () => {
    const withLinks = { attachments: { ...baseData.attachments, links: ["https://example.com/very-long-url-path"] } };
    renderWithProviders(React.createElement(AttachmentStep, { data: withLinks, onChange: vi.fn() }));
    expect(screen.getByText(/example.com/)).toBeInTheDocument();
  });
});
