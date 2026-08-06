import { describe, it, expect } from "vitest";
import { phaseReducer, INITIAL_PHASE } from "../phaseFsm";

describe("phaseFsm — invarianti FSM", () => {
  it("SET_FLOW=thinking forza showTools=true", () => {
    const s = phaseReducer(INITIAL_PHASE, { type: "SET_FLOW", value: "thinking" });
    expect(s.flowPhase).toBe("thinking");
    expect(s.showTools).toBe(true);
  });

  it("SET_FLOW=executing forza showTools=true e toolPhase=active", () => {
    const s = phaseReducer({ ...INITIAL_PHASE, toolPhase: "activating" }, { type: "SET_FLOW", value: "executing" });
    expect(s.flowPhase).toBe("executing");
    expect(s.showTools).toBe(true);
    expect(s.toolPhase).toBe("active");
  });

  it("SET_FLOW=idle azzera showTools e chainHighlight", () => {
    const s = phaseReducer(
      { ...INITIAL_PHASE, flowPhase: "executing", showTools: true, chainHighlight: 3 },
      { type: "SET_FLOW", value: "idle" },
    );
    expect(s.showTools).toBe(false);
    expect(s.chainHighlight).toBeUndefined();
  });

  it("RESET riporta allo stato iniziale", () => {
    const s = phaseReducer(
      { flowPhase: "executing", showTools: true, toolPhase: "active", chainHighlight: 5, activeToolKey: "x" },
      { type: "RESET" },
    );
    expect(s).toEqual(INITIAL_PHASE);
  });

  it("SET_SHOW_TOOLS=false viene ignorato quando flowPhase=thinking (invariante)", () => {
    const s = phaseReducer(
      { ...INITIAL_PHASE, flowPhase: "thinking", showTools: true },
      { type: "SET_SHOW_TOOLS", value: false },
    );
    expect(s.showTools).toBe(true);
  });
});
