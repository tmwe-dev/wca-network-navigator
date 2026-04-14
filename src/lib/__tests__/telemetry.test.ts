import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsertPageEvent = vi.fn().mockResolvedValue(undefined);
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "user-123" } }, error: null });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    auth: { getUser: () => mockGetUser() },
  },
}));

vi.mock("@/data/telemetry", () => ({
  insertPageEvent: (payload: unknown) => mockInsertPageEvent(payload),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({
    debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn(),
  }),
}));

import { trackPage, trackEvent, trackEntityOpen, trackAction, withTelemetry, resetTelemetryUser } from "@/lib/telemetry";

beforeEach(() => {
  vi.clearAllMocks();
  resetTelemetryUser();
});

describe("trackPage", () => {
  it("calls insertPageEvent with page_view event", async () => {
    trackPage("/dashboard");
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    const payload = mockInsertPageEvent.mock.calls[0][0];
    expect(payload.event_name).toBe("page_view");
    expect(payload.page).toBe("/dashboard");
    expect(payload.user_id).toBe("user-123");
    expect(payload.session_id).toMatch(/^s_/);
  });

  it("includes optional props", async () => {
    trackPage("/settings", { tab: "general" });
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    expect(mockInsertPageEvent.mock.calls[0][0].props).toEqual({ tab: "general" });
  });
});

describe("trackEvent", () => {
  it("sends custom event name", async () => {
    trackEvent("button_click", { page: "/test" });
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    expect(mockInsertPageEvent.mock.calls[0][0].event_name).toBe("button_click");
    expect(mockInsertPageEvent.mock.calls[0][0].page).toBe("/test");
  });
});

describe("trackEntityOpen", () => {
  it("sends entity_open event with type and id", async () => {
    trackEntityOpen("partner", "abc-123", "/partners");
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    const p = mockInsertPageEvent.mock.calls[0][0];
    expect(p.event_name).toBe("entity_open");
    expect(p.entity_type).toBe("partner");
    expect(p.entity_id).toBe("abc-123");
  });
});

describe("trackAction", () => {
  it("sends action event with duration", async () => {
    trackAction("save", { key: "val" }, 150);
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    const p = mockInsertPageEvent.mock.calls[0][0];
    expect(p.event_name).toBe("action.save");
    expect(p.duration_ms).toBe(150);
  });
});

describe("withTelemetry", () => {
  it("tracks successful async function with timing", async () => {
    const result = await withTelemetry("myOp", async () => "ok");
    expect(result).toBe("ok");
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    const p = mockInsertPageEvent.mock.calls[0][0];
    expect(p.event_name).toBe("action.myOp");
    expect(p.props?.ok).toBe(true);
    expect(p.duration_ms).toBeGreaterThanOrEqual(0);
  });

  it("tracks failed async function and re-throws", async () => {
    await expect(
      withTelemetry("failOp", async () => { throw new Error("boom"); })
    ).rejects.toThrow("boom");
    await vi.waitFor(() => expect(mockInsertPageEvent).toHaveBeenCalled());
    const p = mockInsertPageEvent.mock.calls[0][0];
    expect(p.props?.ok).toBe(false);
    expect(p.props?.error).toBe("boom");
  });

  it("never throws on insert failure", async () => {
    mockInsertPageEvent.mockRejectedValueOnce(new Error("db down"));
    // Should not throw even if telemetry fails
    const result = await withTelemetry("safeOp", async () => 42);
    expect(result).toBe(42);
  });
});
