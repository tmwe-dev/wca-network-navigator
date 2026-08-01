import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSendWhatsApp = vi.fn();
vi.mock("@/lib/inbox/sendMessage", () => ({
  sendWhatsApp: (...args: any[]) => mockSendWhatsApp(...args),
}));

const mockSupabaseInsert = vi.fn();
const mockSupabaseFrom = vi.fn().mockReturnValue({ insert: mockSupabaseInsert });
const mockGetSession = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: any[]) => mockSupabaseFrom(...args),
    auth: { getSession: () => mockGetSession() },
  },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { sendWhatsAppDirect, queueWhatsAppForApproval } from "../whatsappSender";

describe("sendWhatsAppDirect", () => {
  const bridgeSender = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockSendWhatsApp.mockResolvedValue({ success: true });
  });

  it("returns error for empty phone", async () => {
    const result = await sendWhatsAppDirect({
      phone: "",
      text: "Hello",
      source: "test",
      bridgeSender,
    });

    expect(result).toEqual({ success: false, error: "Numero non valido" });
    expect(mockSendWhatsApp).not.toHaveBeenCalled();
  });

  it("cleans phone number before sending", async () => {
    await sendWhatsAppDirect({
      phone: "+39 (333) 123-4567",
      text: "Hello",
      source: "test",
      bridgeSender,
    });

    expect(mockSendWhatsApp).toHaveBeenCalledTimes(1);
    const callArgs = mockSendWhatsApp.mock.calls[0][0];
    expect(callArgs.recipient).toBe("393331234567");
  });

  it("passes all fields to sendWhatsAppUnified", async () => {
    await sendWhatsAppDirect({
      phone: "393331234567",
      text: "Deal update",
      partnerId: "p-1",
      contactId: "c-1",
      threadId: "t-1",
      source: "cockpit",
      bridgeSender,
    });

    expect(mockSendWhatsApp).toHaveBeenCalledWith(
      {
        recipient: "393331234567",
        text: "Deal update",
        partner_id: "p-1",
        contact_id: "c-1",
        thread_id: "t-1",
      },
      bridgeSender,
    );
  });

  it("returns the SendResult from unified sender", async () => {
    mockSendWhatsApp.mockResolvedValueOnce({ success: true, message_id: "m-1" });

    const result = await sendWhatsAppDirect({
      phone: "393331234567",
      text: "Hello",
      source: "test",
      bridgeSender,
    });

    expect(result).toEqual({ success: true, message_id: "m-1" });
  });
});

describe("queueWhatsAppForApproval", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSession.mockResolvedValue({
      data: { session: { user: { id: "user-1" } } },
    });
    mockSupabaseInsert.mockResolvedValue({ error: null });
  });

  it("returns all failed when no session", async () => {
    mockGetSession.mockResolvedValueOnce({ data: { session: null } });

    const result = await queueWhatsAppForApproval({
      targets: [{ phone: "393331234567" }],
      messageOrTemplate: "Hi",
      source: "test",
    });

    expect(result).toEqual({ queued: 0, failed: 1 });
  });

  it("queues valid targets into ai_pending_actions", async () => {
    const result = await queueWhatsAppForApproval({
      targets: [
        { phone: "393331234567", contactId: "c-1", partnerId: "p-1" },
      ],
      messageOrTemplate: "Hello there",
      source: "bulk-dialog",
    });

    expect(result).toEqual({ queued: 1, failed: 0 });
    expect(mockSupabaseFrom).toHaveBeenCalledWith("ai_pending_actions");
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);

    const insertPayload = mockSupabaseInsert.mock.calls[0][0];
    expect(insertPayload.user_id).toBe("user-1");
    expect(insertPayload.action_type).toBe("send_whatsapp");
    expect(insertPayload.status).toBe("pending");
    expect(insertPayload.action_payload.recipient).toBe("393331234567");
    expect(insertPayload.action_payload.message_text).toBe("Hello there");
  });

  it("skips targets with invalid phone", async () => {
    const result = await queueWhatsAppForApproval({
      targets: [
        { phone: "" },
        { phone: "393331234567" },
      ],
      messageOrTemplate: "Hi",
      source: "test",
    });

    expect(result).toEqual({ queued: 1, failed: 1 });
    expect(mockSupabaseInsert).toHaveBeenCalledTimes(1);
  });

  it("personalizes template with contact name and company", async () => {
    await queueWhatsAppForApproval({
      targets: [
        { phone: "393331234567", contactName: "Marco", companyName: "Acme" },
      ],
      messageOrTemplate: "Hi {{name}} from {{company}}!",
      source: "cadence",
    });

    const payload = mockSupabaseInsert.mock.calls[0][0];
    expect(payload.action_payload.message_text).toBe("Hi Marco from Acme!");
  });

  it("counts insert errors as failed", async () => {
    mockSupabaseInsert.mockResolvedValueOnce({ error: { message: "DB error" } });

    const result = await queueWhatsAppForApproval({
      targets: [{ phone: "393331234567" }],
      messageOrTemplate: "Hi",
      source: "test",
    });

    expect(result).toEqual({ queued: 0, failed: 1 });
  });
});
