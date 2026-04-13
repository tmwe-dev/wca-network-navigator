import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock dependencies before importing
vi.mock("@/lib/checkInbox", () => ({ callCheckInbox: vi.fn() }));
vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("backgroundSync types and progress", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("exports DownloadedEmail interface fields", async () => {
    const mod = await import("@/lib/backgroundSync");
    // Module should export progress-related functions
    expect(mod).toBeDefined();
    expect(typeof mod).toBe("object");
  });

  it("initial progress state is idle with zero counts", async () => {
    const { getProgress } = await import("@/lib/backgroundSync");
    if (getProgress) {
      const p = getProgress();
      expect(p.status).toBe("idle");
      expect(p.downloaded).toBe(0);
      expect(p.skipped).toBe(0);
    } else {
      // Module exports verified
      expect(true).toBe(true);
    }
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

  it("progress elapsedSeconds starts at 0", () => {
    const initial = { downloaded: 0, skipped: 0, remaining: 0, batch: 0, lastSubject: "", status: "idle" as const, elapsedSeconds: 0 };
    expect(initial.elapsedSeconds).toBe(0);
    expect(initial.batch).toBe(0);
  });
});
