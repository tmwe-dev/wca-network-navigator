import { describe, it, expect, vi } from "vitest";
import { screen, fireEvent } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";

const mockUpdateAgent = { mutate: vi.fn(), isPending: false };
vi.mock("@/hooks/useAgents", () => ({
  useAgents: () => ({ updateAgent: mockUpdateAgent }),
}));
vi.mock("@/data/agentAvatars", () => ({ resolveAgentAvatar: () => null }));
vi.mock("@/data/agentTemplates", () => ({ ROBIN_VOICE_CALL_URL: "https://voice.example.com" }));
vi.mock("@/lib/security/htmlSanitizer", () => ({ sanitizeHtml: (h: string) => h }));
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { storage: { from: () => ({ upload: vi.fn().mockResolvedValue({ error: null }), getPublicUrl: () => ({ data: { publicUrl: "https://cdn/sig.png" } }) }) } },
}));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

import { AgentSignatureConfig } from "./AgentSignatureConfig";

const AGENT = {
  id: "a1", name: "Robin", role: "sales", system_prompt: "", avatar_emoji: "🤖",
  is_active: true, signature_html: "<p>Best regards</p>", signature_image_url: "",
  voice_call_url: "", user_id: "u1", assigned_tools: [], knowledge_base: {}, stats: {},
  schedule_config: {}, created_at: "", updated_at: "",
} as any;

describe("AgentSignatureConfig", () => {
  it("renders section title", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT }));
    expect(screen.getByText("Firma Email Agente")).toBeInTheDocument();
  });
  it("renders save button", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT }));
    expect(screen.getByText("Salva firma")).toBeInTheDocument();
  });
  it("renders preview toggle", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT }));
    expect(screen.getByText("Anteprima")).toBeInTheDocument();
  });
  it("renders generate button", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT }));
    expect(screen.getByText(/Genera firma/i)).toBeInTheDocument();
  });
  it("calls updateAgent on save click", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT }));
    fireEvent.click(screen.getByText("Salva firma"));
    expect(mockUpdateAgent.mutate).toHaveBeenCalledWith(expect.objectContaining({ id: "a1" }), expect.anything());
  });
});
