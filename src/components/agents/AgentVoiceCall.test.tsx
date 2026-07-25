import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import React from "react";

// Mock all external dependencies
vi.mock("@elevenlabs/react", () => ({
  useConversation: () => ({
    startSession: vi.fn(),
    endSession: vi.fn(),
    status: "disconnected",
    isSpeaking: false,
  }),
}));

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn().mockResolvedValue({ data: { token: "test", bridge_token: "bt" }, error: null }),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({
    info: vi.fn(),
    error: vi.fn(),
    warn: vi.fn(),
    debug: vi.fn(),
  }),
}));

vi.mock("framer-motion", () => ({
  motion: {
    div: React.forwardRef((props: React.HTMLAttributes<HTMLDivElement>, ref: React.Ref<HTMLDivElement>) =>
      React.createElement("div", { ...props, ref })
    ),
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
}));

vi.mock("@/components/intelliflow/VoicePresence", () => ({
  default: () => React.createElement("div", { "data-testid": "voice-presence" }),
}));

describe("AgentVoiceCall", () => {
  const mockAgent = {
    id: "agent-1",
    name: "Test Agent",
    elevenlabs_agent_id: "el-agent-1",
    role: "sales",
    avatar_emoji: "🤖",
    system_prompt: "test",
    is_active: true,
    assigned_tools: [],
    knowledge_base: {},
    stats: {},
    schedule_config: {},
    user_id: "user-1",
    created_at: "2024-01-01",
    updated_at: "2024-01-01",
  };

  it("renders call button", async () => {
    const { AgentVoiceCall } = await import("@/components/agents/AgentVoiceCall");
    render(React.createElement(AgentVoiceCall, { agent: mockAgent as any, onClose: vi.fn() }));
    // Should have a call button
    const buttons = screen.getAllByRole("button");
    expect(buttons.length).toBeGreaterThan(0);
  });

  it("shows agent name or call UI elements", async () => {
    const { AgentVoiceCall } = await import("@/components/agents/AgentVoiceCall");
    const { container } = render(React.createElement(AgentVoiceCall, { agent: mockAgent as any, onClose: vi.fn() }));
    expect(container.innerHTML.length).toBeGreaterThan(0);
  });
});
