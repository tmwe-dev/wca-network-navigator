import { describe, it, expect } from "vitest";
import { AGENT_AVATARS } from "@/data/agentAvatars";
describe("DAL — agentAvatars", () => {
  it("has avatars", () => expect(AGENT_AVATARS.length).toBeGreaterThan(0));
  it("each avatar has id and src", () => {
    for (const a of AGENT_AVATARS) {
      expect(a.id).toBeTruthy();
      expect(a.src).toBeTruthy();
      expect(["male", "female"]).toContain(a.gender);
    }
  });
});
