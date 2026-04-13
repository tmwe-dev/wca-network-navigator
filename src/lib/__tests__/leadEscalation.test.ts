import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

describe("leadEscalation", () => {
  describe("computeEscalation", () => {
    it("escalates 'new' to 'contacted' for interested+positive", () => {
      expect(computeEscalation("interested", "positive", "new")).toBe("contacted");
    });
    it("escalates 'contacted' to 'in_progress'", () => {
      expect(computeEscalation("interested", "positive", "contacted")).toBe("in_progress");
    });
    it("escalates meeting_request from in_progress to negotiation", () => {
      expect(computeEscalation("meeting_request", "positive", "in_progress")).toBe("negotiation");
    });
    it("returns null for non-escalation category", () => {
      expect(computeEscalation("spam", "positive", "new")).toBeNull();
    });
    it("returns null for non-positive sentiment", () => {
      expect(computeEscalation("interested", "neutral", "new")).toBeNull();
    });
    it("returns null when already at max status for interested", () => {
      expect(computeEscalation("interested", "positive", "in_progress")).toBeNull();
    });
    it("accepts very_positive sentiment", () => {
      expect(computeEscalation("interested", "very_positive", "new")).toBe("contacted");
    });
    it("returns null for unknown current status", () => {
      expect(computeEscalation("interested", "positive", "lost")).toBeNull();
    });
  });

  describe("computeDowngrade", () => {
    it("downgrades contacted to lost with high confidence", () => {
      expect(computeDowngrade("not_interested", 0.95, "contacted")).toBe("lost");
    });
    it("downgrades in_progress to lost", () => {
      expect(computeDowngrade("not_interested", 0.85, "in_progress")).toBe("lost");
    });
    it("returns null for low confidence", () => {
      expect(computeDowngrade("not_interested", 0.5, "contacted")).toBeNull();
    });
    it("returns null for wrong category", () => {
      expect(computeDowngrade("interested", 0.95, "contacted")).toBeNull();
    });
    it("returns null for ineligible status", () => {
      expect(computeDowngrade("not_interested", 0.95, "new")).toBeNull();
    });
    it("returns null at exact threshold boundary below", () => {
      expect(computeDowngrade("not_interested", 0.79, "contacted")).toBeNull();
    });
    it("returns lost at exact 0.80 threshold", () => {
      expect(computeDowngrade("not_interested", 0.80, "contacted")).toBe("lost");
    });
  });
});
