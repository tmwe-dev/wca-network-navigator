import { describe, it, expect } from "vitest";
import { computeEscalation, computeDowngrade } from "@/lib/leadEscalation";

describe("computeEscalation", () => {
  it("interested + positive + new → contacted", () => {
    expect(computeEscalation("interested", "positive", "new")).toBe("contacted");
  });

  it("interested + positive + contacted → in_progress", () => {
    expect(computeEscalation("interested", "positive", "contacted")).toBe("in_progress");
  });

  it("meeting_request + positive + in_progress → negotiation", () => {
    expect(computeEscalation("meeting_request", "positive", "in_progress")).toBe("negotiation");
  });

  it("interested + positive + in_progress → null (no change, stays in_progress)", () => {
    expect(computeEscalation("interested", "positive", "in_progress")).toBeNull();
  });

  it("interested + neutral → null (sentiment not positive)", () => {
    expect(computeEscalation("interested", "neutral", "contacted")).toBeNull();
  });

  it("interested + very_positive + new → contacted", () => {
    expect(computeEscalation("interested", "very_positive", "new")).toBe("contacted");
  });

  it("complaint + positive → null (category not in escalation list)", () => {
    expect(computeEscalation("complaint", "positive", "new")).toBeNull();
  });

  it("meeting_request + positive + negotiation → null (no mapping for negotiation)", () => {
    expect(computeEscalation("meeting_request", "positive", "negotiation")).toBeNull();
  });
});

describe("computeDowngrade", () => {
  it("not_interested + 0.85 + contacted → lost", () => {
    expect(computeDowngrade("not_interested", 0.85, "contacted")).toBe("lost");
  });

  it("not_interested + 0.70 + contacted → null (below threshold)", () => {
    expect(computeDowngrade("not_interested", 0.70, "contacted")).toBeNull();
  });

  it("not_interested + 0.90 + new → null (new not in eligible statuses)", () => {
    expect(computeDowngrade("not_interested", 0.90, "new")).toBeNull();
  });

  it("not_interested + 0.80 + in_progress → lost (exactly at threshold)", () => {
    expect(computeDowngrade("not_interested", 0.80, "in_progress")).toBe("lost");
  });

  it("interested + 0.95 + contacted → null (wrong category)", () => {
    expect(computeDowngrade("interested", 0.95, "contacted")).toBeNull();
  });

  it("not_interested + 0.90 + negotiation → null (negotiation not eligible)", () => {
    expect(computeDowngrade("not_interested", 0.90, "negotiation")).toBeNull();
  });
});
