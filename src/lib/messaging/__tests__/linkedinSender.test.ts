import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendLinkedIn = vi.fn();
vi.mock("@/lib/inbox/sendMessage", () => ({
  sendLinkedIn: (...args: unknown[]) => mockSendLinkedIn(...args),
}));

vi.mock("@/lib/linkedinSearch", () => ({
  isLinkedInProfileUrl: (url?: string | null) =>
    !!url && /linkedin\.com\/in\//.test(url),
  normalizeLinkedInProfileUrl: (url?: string | null) => {
    if (!url) return null;
    const match = url.match(/(https:\/\/www\.linkedin\.com\/in\/[^/?\s]+)/);
    return match ? match[1] : url.startsWith("https://www.linkedin.com/in/") ? url.replace(/\/+$/, "") : null;
  },
}));

const mockSupabaseInsert = vi.fn();
const mockSupabaseFrom = vi.fn().mockReturnValue({ insert: mockSupabaseInsert });
const mockGetSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockSupabaseFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { sendLinkedInDirect, queueLinkedInForApproval } from "../linkedinSender";

const VALID_URL = "https://www.linkedin.com/in/john-doe";

describe("sendLinkedInDirect", () => {
  const bridgeSender = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendLinkedIn.mockResolvedValue({ success: true });
  });

  it("returns error for invalid LinkedIn URL", async () => {
    const result = await sendLinkedInDirect({
      profileUrl: "https://example.com/not-linkedin",
      text: "Hello",
      source: "test",
      bridgeSender,
    });

    expect(result).toEqual({ success: false, error: "URL LinkedIn non valido" });
    expect(mockSendLinkedIn).not.toHaveBeenCalled();
  });

  it("returns error for empty text", async () => {
    const result = await sendLinkedInDirect({
      profileUrl: VALID_URL,
      text: "   ",
      source: "test",
      bridgeSender,
    });

    expect(result).toEqual({ success: false, error: "Messaggio vuoto" });
    expect(mockSendLinkedIn).not.toHaveBeenCalled();
  });

  it("truncates text to 300 characters", async () => {
    const longText = "A".repeat(500);

    await sendLinkedInDirect({
      profileUrl: VALID_URL,
      text: longText,
      source: "test",
      bridgeSender,
    });

    const callArgs = mockSendLinkedIn.mock.calls[0][0];
    expect(callArgs.text).toHaveLength(300);
  });

  it("passes all fields to sendLinkedInUnified", async () => {
    await sendLinkedInDirect({
      profileUrl: VALID_URL,
      text: "Let's connect",
      partnerId: "p-1",
      contactId: "c-1",
      threadId: "t-1",
      source: "partner-detail",
      bridgeSender,
    });

    expect(mockSendLinkedIn).toHaveBeenCalledWith(
      {
        recipient_url: VALID_URL,
        text: "Let's connect",
        partner_id: "p-1",
        contact_id: "c-1",
        thread_id: "t-1",
      },
      bridgeSender,
    );
  });

  it("returns the SendResult from unified sender", async () => {
    mockSendLinkedIn.mockResolvedValueOnce({ success: true, message_id: "m-1" });

    const result = await sendLinkedInDirect({
      profileUrl: VALID_URL,
      text: "Hi",
      source: "test",
      bridgeSender,
    });

    expect(result).toEqual({ success: true, message_id: "m-1" });
  });
});

describe("queueLinkedInForApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    mockSupabaseInsert.mockResolvedValue({ error: null });
  });

  it("returns all failed when no session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await queueLinkedInForApproval({
      targets: [{ profileUrl: VALID_URL }],
      messageOrTemplate: "Hi",
      source: "test",
    });

    expect(result).toEqual({ queued: 0, failed: 1 });
  });

  it("queues valid targets into ai_pending_actions", async () => {
    const result = await queueLinkedInForApproval({
      targets: [
        { profileUrl: VALID_URL, contactId: "c-1", partnerId: "p-1" },
      ],
      messageOrTemplate: "Hello there",
      source: "bulk-li-dialog",
    });

    expect(result).toEqual({ queued: 1, failed: 0 });
    expect(mockSupabaseFrom).toHaveBeenCalledWith("ai_pending_actions");
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);

    const insertPayload = mockSupabaseInsert.mock.calls[0][0];
    expect(insertPayload.user_id).toBe("user-1");
    expect(insertPayload.action_type).toBe("send_linkedin");
    expect(insertPayload.status).toBe("pending");
    expect(insertPayload.action_payload.recipient).toBe(VALID_URL);
    expect(insertPayload.action_payload.message_text).toBe("Hello there");
  });

  it("skips targets with invalid LinkedIn URL", async () => {
    const result = await queueLinkedInForApproval({
      targets: [
        { profileUrl: "not-a-url" },
        { profileUrl: VALID_URL },
      ],
      messageOrTemplate: "Hi",
      source: "test",
    });

    expect(result).toEqual({ queued: 1, failed: 1 });
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
  });

  it("personalizes template with contact name and company", async () => {
    await queueLinkedInForApproval({
      targets: [
        { profileUrl: VALID_URL, contactName: "Marco", companyName: "Acme" },
      ],
      messageOrTemplate: "Hi {{name}} from {{company}}!",
      source: "cadence",
    });

    const payload = mockSupabaseInsert.mock.calls[0][0];
    expect(payload.action_payload.message_text).toBe("Hi Marco from Acme!");
  });

  it("truncates personalized message to 300 characters", async () => {
    await queueLinkedInForApproval({
      targets: [
        { profileUrl: VALID_URL, contactName: "Marco" },
      ],
      messageOrTemplate: "A".repeat(500),
      source: "test",
    });

    const payload = mockSupabaseInsert.mock.calls[0][0];
    expect(payload.action_payload.message_text).toHaveLength(300);
  });

  it("counts insert errors as failed", async () => {
    mockSupabaseInsert.mockResolvedValueOnce({ error: { message: "DB error" } });

    const result = await queueLinkedInForApproval({
      targets: [{ profileUrl: VALID_URL }],
      messageOrTemplate: "Hi",
      source: "test",
    });

    expect(result).toEqual({ queued: 0, failed: 1 });
  });
});
