import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInvoke = vi.fn();
const mockInsert = vi.fn().mockReturnValue({ select: () => ({ single: () => ({ data: { id: "msg-1" }, error: null }) }) });
const mockGetUser = vi.fn().mockResolvedValue({ data: { user: { id: "u1" } } });

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({ insert: (...a: unknown[]) => mockInsert(...a) }),
    auth: { getUser: () => mockGetUser() },
    functions: { invoke: (...a: unknown[]) => mockInvoke(...a) },
  },
}));

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn().mockResolvedValue({ success: true, message_id: "ext-1" }),
}));

vi.mock("@/lib/api/rateLimiter", () => ({
  withRateLimit: vi.fn((_key: string, fn: () => Promise<unknown>) => fn()),
  RateLimitedError: class extends Error { retryAfterMs = 1000; constructor(k: string) { super(k); this.name = "RateLimitedError"; } },
  CircuitOpenError: class extends Error { resetInMs = 5000; constructor(k: string) { super(k); this.name = "CircuitOpenError"; } },
}));

vi.mock("@/lib/security/htmlSanitizer", () => ({
  sanitizeHtml: (html: string) => html,
}));

vi.mock("@/lib/inbox/sessionTracker", () => ({
  markSessionAlive: vi.fn(),
  markSessionExpired: vi.fn(),
}));

import { sendWhatsApp, sendLinkedIn, type WhatsAppBridgeSender, type LinkedInBridgeSender } from "@/lib/inbox/sendMessage";

beforeEach(() => vi.clearAllMocks());

describe("sendWhatsApp", () => {
  const mockBridge: WhatsAppBridgeSender = vi.fn().mockResolvedValue({ success: true, external_id: "wa-1" });

  it("sends message via bridge and persists", async () => {
    const result = await sendWhatsApp(
      { recipient: "+393331234567", text: "Ciao" },
      mockBridge
    );
    expect(result.success).toBe(true);
    expect(mockBridge).toHaveBeenCalledWith("+393331234567", "Ciao");
    expect(mockInsert).toHaveBeenCalled();
  });

  it("returns error when bridge fails", async () => {
    const failBridge: WhatsAppBridgeSender = vi.fn().mockResolvedValue({ success: false, error: "no session" });
    const result = await sendWhatsApp(
      { recipient: "+1234", text: "hi" },
      failBridge
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("no session");
  });
});

describe("sendLinkedIn", () => {
  const mockBridge: LinkedInBridgeSender = vi.fn().mockResolvedValue({ success: true, external_id: "li-1" });

  it("sends message via bridge and persists", async () => {
    const result = await sendLinkedIn(
      { recipient_url: "https://linkedin.com/in/test", text: "Hello" },
      mockBridge
    );
    expect(result.success).toBe(true);
    expect(mockBridge).toHaveBeenCalledWith("https://linkedin.com/in/test", "Hello");
  });

  it("returns error when bridge throws", async () => {
    const throwBridge: LinkedInBridgeSender = vi.fn().mockRejectedValue(new Error("timeout"));
    const result = await sendLinkedIn(
      { recipient_url: "https://linkedin.com/in/x", text: "Y" },
      throwBridge
    );
    expect(result.success).toBe(false);
    expect(result.error).toContain("timeout");
  });
});
