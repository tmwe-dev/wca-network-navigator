import { describe, it, expect } from "vitest";
import { AGENT_REGISTRY, AGENT_PROMPTS } from "@/data/agentPrompts";

describe("DAL — agentPrompts registry", () => {
  it("AGENT_REGISTRY is not empty", () => {
    expect(Object.keys(AGENT_REGISTRY).length).toBeGreaterThan(0);
  });

  it("every entry has required fields", () => {
    for (const [key, entry] of Object.entries(AGENT_REGISTRY)) {
      expect(entry.description, `${key}.description`).toBeTruthy();
      expect(entry.coreFile, `${key}.coreFile`).toBeTruthy();
      expect(Array.isArray(entry.kbCategories), `${key}.kbCategories`).toBe(true);
      expect(Array.isArray(entry.criticalProcedures), `${key}.criticalProcedures`).toBe(true);
    }
  });

  it("AGENT_PROMPTS mirrors AGENT_REGISTRY keys", () => {
    const regKeys = Object.keys(AGENT_REGISTRY).sort();
    const promptKeys = Object.keys(AGENT_PROMPTS).sort();
    expect(promptKeys).toEqual(regKeys);
  });

  it("AGENT_PROMPTS entries have role and rules", () => {
    for (const [key, section] of Object.entries(AGENT_PROMPTS)) {
      expect(section.role, `${key}.role`).toBeTruthy();
      expect(Array.isArray(section.rules), `${key}.rules`).toBe(true);
    }
  });
});
