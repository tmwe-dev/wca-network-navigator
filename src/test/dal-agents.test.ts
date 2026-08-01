/**
 * DAL Agents — Unit tests
 */
import { describe, it, expect } from "vitest";
import * as agentsDAL from "@/data/agents";

describe("DAL — agents", () => {
  it("exports all expected query functions", () => {
    expect(typeof agentsDAL.findAgents).toBe("function");
    expect(typeof agentsDAL.findActiveAgents).toBe("function");
    expect(typeof agentsDAL.getAgentById).toBe("function");
  });

  it("exports all expected mutation functions", () => {
    expect(typeof agentsDAL.createAgent).toBe("function");
    expect(typeof agentsDAL.updateAgent).toBe("function");
    expect(typeof agentsDAL.deleteAgent).toBe("function");
  });

  it("exports cache invalidation", () => {
    expect(typeof agentsDAL.invalidateAgents).toBe("function");
  });

  it("Agent type has expected fields", () => {
    // Type-level check — if this compiles, types are correct
    const mockAgent: Partial<agentsDAL.Agent> = {
      id: "test",
      name: "Test Agent",
      role: "outreach",
      is_active: true,
      stats: { tasks_completed: 0, emails_sent: 0, calls_made: 0 },
      assigned_tools: ["tool1"],
      knowledge_base: [],
    };
    expect(mockAgent.name).toBe("Test Agent");
  });
});
