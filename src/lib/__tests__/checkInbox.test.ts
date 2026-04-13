import { describe, it, expect, vi } from "vitest";

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn().mockResolvedValue({ success: true, newMessages: 5 }),
}));

vi.mock("@/lib/api/checkInbox.schemas", () => ({
  safeParseCheckInboxResult: vi.fn().mockReturnValue({ success: true }),
}));

import { callCheckInbox } from "@/lib/checkInbox";
import { invokeEdge } from "@/lib/api/invokeEdge";

describe("callCheckInbox", () => {
  it("calls check-inbox edge function", async () => {
    await callCheckInbox();
    expect(invokeEdge).toHaveBeenCalledWith("check-inbox", expect.objectContaining({ body: {} }));
  });

  it("returns the response from invokeEdge", async () => {
    const result = await callCheckInbox();
    expect(result).toEqual({ success: true, newMessages: 5 });
  });

  it("passes context parameter", async () => {
    await callCheckInbox();
    expect(invokeEdge).toHaveBeenCalledWith("check-inbox", expect.objectContaining({ context: "callCheckInbox" }));
  });
});
