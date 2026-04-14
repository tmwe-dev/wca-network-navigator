import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockMaybeSingle = vi.fn();
const mockGetUser = vi.fn();
const mockUpsertAppSetting = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...a: unknown[]) => { mockSelect(...a); return { eq: (...b: unknown[]) => { mockEq(...b); return { maybeSingle: () => mockMaybeSingle() }; } }; },
    }),
    auth: { getUser: () => mockGetUser() },
  },
}));

vi.mock("@/data/appSettings", () => ({
  upsertAppSetting: (...args: unknown[]) => mockUpsertAppSetting(...args),
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

import { getSessionStatus, markSessionAlive, markSessionExpired, markSessionDisconnected } from "@/lib/inbox/sessionTracker";

beforeEach(() => vi.clearAllMocks());

describe("getSessionStatus", () => {
  it("returns parsed session from DB", async () => {
    mockMaybeSingle.mockResolvedValue({
      data: { value: JSON.stringify({ status: "active", last_seen_at: "2024-01-01", last_error: null, metadata: { x: 1 } }) },
      error: null,
    });
    const s = await getSessionStatus("email");
    expect(s.channel).toBe("email");
    expect(s.status).toBe("active");
    expect(s.metadata).toEqual({ x: 1 });
  });

  it("returns unknown status when no data", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    const s = await getSessionStatus("whatsapp");
    expect(s.status).toBe("unknown");
    expect(s.channel).toBe("whatsapp");
  });

  it("returns unknown status on DB error", async () => {
    mockMaybeSingle.mockResolvedValue({ data: null, error: { message: "connection refused" } });
    const s = await getSessionStatus("linkedin");
    expect(s.status).toBe("unknown");
  });

  it("handles malformed JSON in value", async () => {
    mockMaybeSingle.mockResolvedValue({ data: { value: "not valid json{{{" }, error: null });
    const s = await getSessionStatus("email");
    expect(s.status).toBe("unknown");
  });
});

describe("markSessionAlive", () => {
  it("writes active session to DB", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u1" } } });
    mockUpsertAppSetting.mockResolvedValue(undefined);
    await markSessionAlive("email", { foo: "bar" });
    expect(mockUpsertAppSetting).toHaveBeenCalledWith(
      "u1",
      "channel_session:email",
      expect.stringContaining('"status":"active"')
    );
  });
});

describe("markSessionExpired", () => {
  it("writes expired session with reason", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u2" } } });
    mockUpsertAppSetting.mockResolvedValue(undefined);
    await markSessionExpired("whatsapp", "cookie expired");
    expect(mockUpsertAppSetting).toHaveBeenCalledWith(
      "u2",
      "channel_session:whatsapp",
      expect.stringContaining('"status":"expired"')
    );
  });
});

describe("markSessionDisconnected", () => {
  it("writes disconnected session", async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: "u3" } } });
    mockUpsertAppSetting.mockResolvedValue(undefined);
    await markSessionDisconnected("linkedin", "user logout");
    expect(mockUpsertAppSetting).toHaveBeenCalledWith(
      "u3",
      "channel_session:linkedin",
      expect.stringContaining('"status":"disconnected"')
    );
  });
});
