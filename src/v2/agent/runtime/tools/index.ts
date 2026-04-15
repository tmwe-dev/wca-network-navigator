/**
 * Agent tools registry — tools available to the agent loop.
 * These are different from Command single-action tools:
 * they operate at DOM/navigation level for browser automation.
 */
import { navigateTool, readPageTool, clickTool, typeTextTool, readDomTool } from "./dom";
import { listKbTool, readKbTool } from "./kb";
import { scrapeUrlTool } from "./scrape";

export interface AgentToolResult {
  success: boolean;
  data?: unknown;
  error?: string;
}

export interface AgentTool {
  name: string;
  description: string;
  parameters: Record<string, { type: string; description: string; required?: boolean }>;
  requiresApproval: boolean;
  execute: (args: Record<string, unknown>) => Promise<AgentToolResult>;
}

/* ─── Special tools ─── */

const finishTool: AgentTool = {
  name: "finish",
  description: "Conclude the mission with a final answer or summary.",
  parameters: {
    answer: { type: "string", description: "Final answer or summary of what was accomplished", required: true },
  },
  requiresApproval: false,
  execute: async (args) => ({
    success: true,
    data: { answer: String(args.answer ?? "") },
  }),
};

const askUserTool: AgentTool = {
  name: "ask_user",
  description: "Ask the user a question when you need clarification.",
  parameters: {
    question: { type: "string", description: "Question to ask", required: true },
  },
  requiresApproval: false,
  execute: async (args) => ({
    success: true,
    data: { question: String(args.question ?? "") },
  }),
};

export const AGENT_TOOLS: readonly AgentTool[] = [
  navigateTool,
  readPageTool,
  clickTool,
  typeTextTool,
  readDomTool,
  listKbTool,
  readKbTool,
  scrapeUrlTool,
  askUserTool,
  finishTool,
];

/**
 * Returns tool definitions in OpenAI function-calling format.
 */
export function getToolDefinitions() {
  return AGENT_TOOLS.map((t) => ({
    type: "function" as const,
    function: {
      name: t.name,
      description: t.description,
      parameters: {
        type: "object",
        properties: Object.fromEntries(
          Object.entries(t.parameters).map(([k, v]) => [k, { type: v.type, description: v.description }]),
        ),
        required: Object.entries(t.parameters)
          .filter(([, v]) => v.required)
          .map(([k]) => k),
      },
    },
  }));
}
