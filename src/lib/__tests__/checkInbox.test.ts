import { describe, it, expect, vi } from "vitest";
import { ApiError } from "@/lib/api/apiError";

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

  it("does not throw on worker resource limit", async () => {
    vi.mocked(invokeEdge).mockRejectedValueOnce(new ApiError({
      code: "SERVER_ERROR",
      message: "Function failed due to not having enough compute resources",
      httpStatus: 546,
      details: { body: { code: "WORKER_RESOURCE_LIMIT" } },
    }));

    await expect(callCheckInbox()).resolves.toEqual(expect.objectContaining({
      total: 0,
      matched: 0,
      transient: true,
      resourceLimit: true,
    }));
  });

  it("deduplicates overlapping invocations", async () => {
    vi.mocked(invokeEdge).mockClear();
    let resolveInvoke: (value: any) => void = () => undefined;
    vi.mocked(invokeEdge).mockImplementationOnce(() => new Promise((resolve) => { resolveInvoke = resolve; }));

    const first = callCheckInbox();
    const second = callCheckInbox();
    resolveInvoke({ success: true, total: 1 });

    await expect(Promise.all([first, second])).resolves.toEqual([
      { success: true, total: 1 },
      { success: true, total: 1 },
    ]);
    expect(invokeEdge).toHaveBeenCalledTimes(1);
  });
});
