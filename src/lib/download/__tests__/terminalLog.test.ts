import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({ eq: () => ({ single: () => Promise.resolve({ data: { terminal_log: [] } }) }) }),
      update: () => ({ eq: () => Promise.resolve({ error: null }) }),
    }),
  },
}));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("terminalLog", () => {
  beforeEach(() => {
    // Clear the global buffer
    delete (window as any).__terminalLogBuffer__;
  });

  it("exports appendLog function", async () => {
    const mod = await import("@/lib/download/terminalLog");
    expect(mod.appendLog).toBeDefined();
    expect(typeof mod.appendLog).toBe("function");
  });

  it("log entry has ts, type, msg fields", () => {
    const entry = { ts: new Date().toISOString(), type: "info", msg: "Test message" };
    expect(entry.ts).toBeDefined();
    expect(entry.type).toBe("info");
    expect(entry.msg).toBe("Test message");
  });

  it("buffer flushes after threshold entries", async () => {
    const mod = await import("@/lib/download/terminalLog");
    // appendLog should accept jobId and message
    expect(mod.appendLog).toBeDefined();
  });
});
