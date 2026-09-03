import { describe, it, expect } from "vitest";
import { resolveDirectTool, buildSingleToolPlan } from "../directRouter";

describe("directRouter", () => {
  it("instrada la navigazione sul tool navigate-to invece che su ai-query", () => {
    expect(resolveDirectTool("vai alla pagina contatti")).toBe("navigate-to");
  });

  it("instrada la posta in arrivo su read-inbox", () => {
    expect(resolveDirectTool("mostrami la posta in arrivo")).toBe("read-inbox");
  });

  it("instrada l'agenda sul tool agenda", () => {
    expect(resolveDirectTool("cosa devo fare oggi in agenda")).toBeTruthy();
  });

  it("lascia le ricerche generiche al fast-lane ai-query", () => {
    expect(resolveDirectTool("quanti partner ci sono a Malta")).toBeNull();
  });

  it("non instrada direttamente le scritture (restano al planner con approvazione)", () => {
    expect(resolveDirectTool("crea un contatto Mario Rossi")).toBeNull();
  });

  it("costruisce un piano a 1 step sul tool scelto", () => {
    const plan = buildSingleToolPlan("read-inbox");
    expect(plan.steps).toHaveLength(1);
    expect(plan.steps[0].toolId).toBe("read-inbox");
    expect(plan.status).toBe("running");
  });
});
