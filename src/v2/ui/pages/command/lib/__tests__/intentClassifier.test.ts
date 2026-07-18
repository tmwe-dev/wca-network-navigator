import { describe, it, expect } from "vitest";
import { classifyIntent } from "../intentClassifier";

describe("classifyIntent", () => {
  it("classifica saluti come smalltalk", () => {
    const r = classifyIntent("ciao");
    expect(r.kind).toBe("smalltalk");
  });

  it("classifica test presenza come smalltalk", () => {
    const r = classifyIntent("mi senti?");
    expect(r.kind).toBe("smalltalk");
  });

  it("default: passa al planner per ricerche", () => {
    const r = classifyIntent("quanti partner abbiamo a Malta");
    expect(r.kind).toBe("plan");
  });

  it("default: passa al planner per nomi propri", () => {
    const r = classifyIntent("Radiant Global Logistics");
    expect(r.kind).toBe("plan");
  });

  it("prompt vuoto va al planner", () => {
    const r = classifyIntent("   ");
    expect(r.kind).toBe("plan");
  });
});
