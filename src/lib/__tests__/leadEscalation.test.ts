import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

describe("leadEscalation (9-state taxonomy)", () => {
  describe("computeEscalation", () => {
    it("escalates 'new' → 'first_touch_sent'", () => {
      expect(computeEscalation("interested", "positive", "new")).toBe("first_touch_sent");
    });
    it("escalates 'first_touch_sent' → 'engaged'", () => {
      expect(computeEscalation("interested", "positive", "first_touch_sent")).toBe("engaged");
    });
    it("escalates 'holding' → 'engaged'", () => {
      expect(computeEscalation("interested", "positive", "holding")).toBe("engaged");
    });
    it("escalates 'engaged' → 'qualified' on meeting_request", () => {
      expect(computeEscalation("meeting_request", "positive", "engaged")).toBe("qualified");
    });
    it("does not escalate 'engaged' on plain interest (already engaged)", () => {
      expect(computeEscalation("interested", "positive", "engaged")).toBeNull();
    });
    it("returns null for non-escalation category", () => {
      expect(computeEscalation("spam", "positive", "new")).toBeNull();
    });
    it("returns null for non-positive sentiment", () => {
      expect(computeEscalation("interested", "neutral", "new")).toBeNull();
    });
    it("accepts very_positive sentiment", () => {
      expect(computeEscalation("interested", "very_positive", "new")).toBe("first_touch_sent");
    });
    it("returns null for terminal status (converted)", () => {
      expect(computeEscalation("interested", "positive", "converted")).toBeNull();
    });
    it("returns null for archived status", () => {
      expect(computeEscalation("interested", "positive", "archived")).toBeNull();
    });
  });

  describe("computeDowngrade", () => {
    it("downgrades first_touch_sent to archived with high confidence", () => {
      expect(computeDowngrade("not_interested", 0.95, "first_touch_sent")).toBe("archived");
    });
    it("downgrades holding to archived", () => {
      expect(computeDowngrade("not_interested", 0.85, "holding")).toBe("archived");
    });
    it("returns null for low confidence", () => {
      expect(computeDowngrade("not_interested", 0.5, "first_touch_sent")).toBeNull();
    });
    it("returns null for wrong category", () => {
      expect(computeDowngrade("interested", 0.95, "first_touch_sent")).toBeNull();
    });
    it("returns null for ineligible status (engaged)", () => {
      expect(computeDowngrade("not_interested", 0.95, "engaged")).toBeNull();
    });
    it("returns null at exact threshold boundary below", () => {
      expect(computeDowngrade("not_interested", 0.79, "first_touch_sent")).toBeNull();
    });
    it("returns archived at exact 0.80 threshold", () => {
      expect(computeDowngrade("not_interested", 0.80, "first_touch_sent")).toBe("archived");
    });
  });
});
