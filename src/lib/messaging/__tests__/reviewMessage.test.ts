import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/lib/api/invokeEdge", () => ({
  invokeEdge: vi.fn(),
}));
vi.mock("@/lib/log", () => ({
  createLogger: () => ({ error: vi.fn(), warn: vi.fn(), info: vi.fn() }),
}));

import { reviewMessage, type ReviewMessageResult } from "../reviewMessage";
import { invokeEdge } from "@/lib/api/invokeEdge";

const mockedInvokeEdge = vi.mocked(invokeEdge);

const baseArgs = {
  channel: "whatsapp" as const,
  draft: "Hello partner, let's discuss the deal.",
  partnerId: "p-1",
  contactId: "c-1",
};

describe("reviewMessage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("returns pass verdict from edge function", async () => {
    const edgeResult: ReviewMessageResult = {
      verdict: "pass",
      edited_text: baseArgs.draft,
      warnings: [],
      reasoning_summary: "All good",
      quality_score: 95,
    };
    mockedInvokeEdge.mockResolvedValueOnce(edgeResult);

    const result = await reviewMessage(baseArgs);

    expect(result).toEqual(edgeResult);
    expect(result.verdict).toBe("pass");
    expect(mockedInvokeEdge).toHaveBeenCalledWith("review-message", {
      body: {
        channel: "whatsapp",
        draft: baseArgs.draft,
        partner_id: "p-1",
        contact_id: "c-1",
      },
      context: "reviewMessage.whatsapp",
    });
  });

  it("falls back to warn verdict when edge returns null", async () => {
    mockedInvokeEdge.mockResolvedValueOnce(null);

    const result = await reviewMessage(baseArgs);

    expect(result.verdict).toBe("warn");
    expect(result.edited_text).toBe(baseArgs.draft);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].severity).toBe("warning");
    expect(result.reasoning_summary).toContain("empty response");
  });

  it("returns block verdict on error (fail-closed doctrine)", async () => {
    mockedInvokeEdge.mockRejectedValueOnce(new Error("Edge timeout"));

    const result = await reviewMessage(baseArgs);

    expect(result.verdict).toBe("block");
    expect(result.edited_text).toBe(baseArgs.draft);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0].severity).toBe("blocking");
    expect(result.warnings[0].description).toContain("Edge timeout");
    expect(result.reasoning_summary).toContain("fail-closed");
  });

  it("returns pass_with_edits with edited_text", async () => {
    const edgeResult: ReviewMessageResult = {
      verdict: "pass_with_edits",
      edited_text: "Hello partner, let us discuss the deal.",
      warnings: [{ description: "Informal contraction replaced", severity: "minor" }],
      reasoning_summary: "Minor style edit applied",
      quality_score: 88,
    };
    mockedInvokeEdge.mockResolvedValueOnce(edgeResult);

    const result = await reviewMessage(baseArgs);

    expect(result.verdict).toBe("pass_with_edits");
    expect(result.edited_text).not.toBe(baseArgs.draft);
    expect(result.edited_text).toBe("Hello partner, let us discuss the deal.");
    expect(result.warnings).toHaveLength(1);
  });
});
