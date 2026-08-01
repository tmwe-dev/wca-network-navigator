import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

describe("computeEscalation (9-state)", () => {
  it("interested + positive + new → first_touch_sent", () => {
    expect(computeEscalation("interested", "positive", "new")).toBe("first_touch_sent");
  });

  it("interested + positive + first_touch_sent → engaged", () => {
    expect(computeEscalation("interested", "positive", "first_touch_sent")).toBe("engaged");
  });

  it("interested + positive + holding → engaged", () => {
    expect(computeEscalation("interested", "positive", "holding")).toBe("engaged");
  });

  it("meeting_request + positive + engaged → qualified", () => {
    expect(computeEscalation("meeting_request", "positive", "engaged")).toBe("qualified");
  });

  it("interested + positive + engaged → null (no further escalation)", () => {
    expect(computeEscalation("interested", "positive", "engaged")).toBeNull();
  });

  it("interested + neutral → null (sentiment not positive)", () => {
    expect(computeEscalation("interested", "neutral", "first_touch_sent")).toBeNull();
  });

  it("interested + very_positive + new → first_touch_sent", () => {
    expect(computeEscalation("interested", "very_positive", "new")).toBe("first_touch_sent");
  });

  it("complaint + positive → null (category not in escalation list)", () => {
    expect(computeEscalation("complaint", "positive", "new")).toBeNull();
  });

  it("meeting_request + positive + qualified → null (no mapping past qualified)", () => {
    expect(computeEscalation("meeting_request", "positive", "qualified")).toBeNull();
  });
});

describe("computeDowngrade (9-state)", () => {
  it("not_interested + 0.85 + first_touch_sent → archived", () => {
    expect(computeDowngrade("not_interested", 0.85, "first_touch_sent")).toBe("archived");
  });

  it("not_interested + 0.70 + first_touch_sent → null (below threshold)", () => {
    expect(computeDowngrade("not_interested", 0.70, "first_touch_sent")).toBeNull();
  });

  it("not_interested + 0.90 + new → null (new not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.90, "new")).toBeNull();
  });

  it("not_interested + 0.80 + holding → archived (exactly at threshold)", () => {
    expect(computeDowngrade("not_interested", 0.80, "holding")).toBe("archived");
  });

  it("interested + 0.95 + first_touch_sent → null (wrong category)", () => {
    expect(computeDowngrade("interested", 0.95, "first_touch_sent")).toBeNull();
  });

  it("not_interested + 0.90 + engaged → null (engaged not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.90, "engaged")).toBeNull();
  });
});
