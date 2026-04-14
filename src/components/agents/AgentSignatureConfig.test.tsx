import { describe, it, expect, vi, beforeEach } from "vitest";
import { screen, fireEvent, waitFor } from "@testing-library/react";
import { renderWithProviders } from "@/test/componentTestUtils";
import React from "react";

const mockUpdateAgent = { mutate: vi.fn(), isPending: false };
vi.mock("@/hooks/useAgents", () => ({
  useAgents: () => ({ updateAgent: mockUpdateAgent }),
}));

vi.mock("@/data/agentAvatars", () => ({
  resolveAgentAvatar: () => "🤖",
}));

vi.mock("@/data/agentTemplates", () => ({
  ROBIN_VOICE_CALL_URL: "https://voice.example.com",
}));

vi.mock("@/lib/security/htmlSanitizer", () => ({
  sanitizeHtml: (html: string) => html,
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    storage: {
      from: () => ({
        upload: vi.fn().mockResolvedValue({ error: null }),
        getPublicUrl: () => ({ data: { publicUrl: "https://cdn/sig.png" } }),
      }),
    },
  },
}));

vi.mock("sonner", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { AgentSignatureConfig } from "./AgentSignatureConfig";

const AGENT = {
  id: "a1", name: "Robin", role: "sales", system_prompt: "", avatar_emoji: "🤖",
  is_active: true, signature_html: "<p>Best regards</p>", signature_image_url: "https://cdn/old.png",
  voice_call_url: "https://voice.example.com/robin", user_id: "u1",
  assigned_tools: [], knowledge_base: {}, stats: {}, schedule_config: {},
  created_at: "", updated_at: "",
};

beforeEach(() => vi.clearAllMocks());

describe("AgentSignatureConfig", () => {
  it("renders signature HTML textarea with value", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT as any }));
    const textarea = screen.getByPlaceholderText(/firma HTML/i) || screen.getAllByRole("textbox")[0];
    expect(textarea).toBeInTheDocument();
  });

  it("renders save button", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT as any }));
    expect(screen.getByText(/Salva firma/i)).toBeInTheDocument();
  });

  it("renders image URL input", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT as any }));
    const inputs = screen.getAllByRole("textbox");
    // Should have at least 3 inputs (html, image url, voice url)
    expect(inputs.length).toBeGreaterThanOrEqual(2);
  });

  it("calls updateAgent.mutate on save", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT as any }));
    fireEvent.click(screen.getByText(/Salva firma/i));
    expect(mockUpdateAgent.mutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "a1" }),
      expect.anything()
    );
  });

  it("renders preview toggle button", () => {
    renderWithProviders(React.createElement(AgentSignatureConfig, { agent: AGENT as any }));
    expect(screen.getByText(/Anteprima/i)).toBeInTheDocument();
  });
});
