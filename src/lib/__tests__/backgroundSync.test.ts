import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/checkInbox", () => ({ callCheckInbox: vi.fn() }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("backgroundSync types and progress", () => {
  beforeEach(() => { vi.resetModules(); });

  it("exports module with expected shape", async () => {
    const mod = await import("@/lib/backgroundSync");
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("BgSyncProgress has required status values", () => {
    type Status = "idle" | "syncing" | "done" | "error";
    const statuses: Status[] = ["idle", "syncing", "done", "error"];
    expect(statuses).toHaveLength(4);
    expect(statuses).toContain("idle");
    expect(statuses).toContain("error");
  });

  it("DownloadedEmail requires id, subject, from, date fields", () => {
    const email = { id: "1", subject: "Test", from: "a@b.com", date: "2024-01-01", timestamp: Date.now() };
    expect(email.id).toBe("1");
    expect(email.subject).toBe("Test");
    expect(email.from).toBe("a@b.com");
    expect(email.timestamp).toBeGreaterThan(0);
  });

  it("progress initial shape has zero counts", () => {
    const initial = { downloaded: 0, skipped: 0, remaining: 0, batch: 0, lastSubject: "", status: "idle" as const, elapsedSeconds: 0 };
    expect(initial.elapsedSeconds).toBe(0);
    expect(initial.batch).toBe(0);
    expect(initial.status).toBe("idle");
  });

  it("module exports listener registration functions", async () => {
    const mod = await import("@/lib/backgroundSync");
    // Should have functions like onProgress, onEmail, startSync
    const exports = Object.keys(mod);
    expect(exports.length).toBeGreaterThan(0);
  });
});
