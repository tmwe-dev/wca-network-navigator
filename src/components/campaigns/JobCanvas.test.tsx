import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";

vi.mock("@/hooks/useCampaignJobs", () => ({
  useUpdateCampaignJob: () => ({ mutate: vi.fn() }),
  useEmailTemplates: () => ({ data: [] }),
}));

vi.mock("@/lib/countries", () => ({
  getCountryFlag: (code: string) => `🏳️${code}`,
}));

import { JobCanvas } from "./JobCanvas";

const MOCK_JOB = {
  id: "j1",
  batch_id: "b1",
  partner_id: "p1",
  company_name: "Acme Corp",
  country_code: "IT",
  country_name: "Italy",
  city: "Milano",
  email: "info@acme.com",
  phone: "+39 02 123",
  job_type: "email" as const,
  status: "pending" as const,
  notes: "Call first",
  created_at: "2024-06-01",
  completed_at: null,
  user_id: "u1",
  assigned_to: null,
};

describe("JobCanvas", () => {
  it("shows empty state when no job", () => {
    renderWithProviders(React.createElement(JobCanvas, { job: null }));
    expect(screen.getByText("Clicca su un contatto dalla lista")).toBeInTheDocument();
  });

  it("shows bulk message when no job but bulk selection", () => {
    renderWithProviders(React.createElement(JobCanvas, { job: null, selectedContactIds: new Set(["a", "b"]) }));
    expect(screen.getByText(/2 contatti selezionati/)).toBeInTheDocument();
  });

  it("renders job company name", () => {
    renderWithProviders(React.createElement(JobCanvas, { job: MOCK_JOB }));
    expect(screen.getByText("Acme Corp")).toBeInTheDocument();
  });

  it("renders job country with flag", () => {
    renderWithProviders(React.createElement(JobCanvas, { job: MOCK_JOB }));
    expect(screen.getByText(/🏳️IT/)).toBeInTheDocument();
    expect(screen.getByText("Italy")).toBeInTheDocument();
  });

  it("shows notes textarea with existing value", () => {
    renderWithProviders(React.createElement(JobCanvas, { job: MOCK_JOB }));
    const textarea = screen.getByPlaceholderText(/Note interne/);
    expect(textarea).toHaveValue("Call first");
  });

  it("displays email when available", () => {
    renderWithProviders(React.createElement(JobCanvas, { job: MOCK_JOB }));
    expect(screen.getByText("info@acme.com")).toBeInTheDocument();
  });
});
