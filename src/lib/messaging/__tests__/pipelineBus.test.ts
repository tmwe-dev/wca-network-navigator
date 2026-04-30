import { describe, it, expect, beforeEach } from "vitest";
import { messagePipelineBus, newPipelineId } from "../pipelineBus";

describe("messagePipelineBus", () => {
  beforeEach(() => {
    // Best-effort cleanup: end any leftover snapshots from previous tests.
    for (const s of messagePipelineBus.list()) messagePipelineBus.end(s.pipelineId);
  });

  it("emits start, update and end events", async () => {
    const id = newPipelineId();
    const seen: string[] = [];
    const unsub = messagePipelineBus.subscribe((snap) => {
      if (!snap || snap.pipelineId !== id) return;
      const last = snap.stages[snap.stages.length - 1];
      seen.push(`${snap.endedAt ? "end" : "tick"}:${last.id}:${last.status}`);
    });

    messagePipelineBus.start({ pipelineId: id, channel: "email", surface: "test" });
    messagePipelineBus.update(id, "contract", { status: "running" });
    messagePipelineBus.update(id, "contract", { status: "done" });
    messagePipelineBus.end(id, "done");
    unsub();

    expect(seen.length).toBeGreaterThan(0);
    const snap = messagePipelineBus.get(id);
    expect(snap).toBeTruthy();
    expect(snap?.finalStatus).toBe("done");
    expect(snap?.stages.find((s) => s.id === "contract")?.status).toBe("done");
  });

  it("auto-finalizes pending stages on end()", () => {
    const id = newPipelineId();
    messagePipelineBus.start({ pipelineId: id, channel: "email", surface: "test" });
    messagePipelineBus.end(id, "error");
    const snap = messagePipelineBus.get(id);
    // All stages should be marked error or done (no pending left)
    expect(snap?.stages.every((s) => s.status !== "pending" && s.status !== "running")).toBe(true);
  });

  it("subscribe returns a working unsubscribe", () => {
    let calls = 0;
    const unsub = messagePipelineBus.subscribe(() => {
      calls += 1;
    });
    const id = newPipelineId();
    messagePipelineBus.start({ pipelineId: id, channel: "email", surface: "test" });
    const before = calls;
    unsub();
    messagePipelineBus.update(id, "contract", { status: "done" });
    expect(calls).toBe(before);
    messagePipelineBus.end(id);
  });
});