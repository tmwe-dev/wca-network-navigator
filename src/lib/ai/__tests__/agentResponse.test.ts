import { describe, it, expect, vi } from "vitest";
import { parseAiAgentResponse, sanitizeVisibleAiText, dispatchAiUiActions } from "@/lib/ai/agentResponse";

vi.mock("@/lib/log", () => ({
  createLogger: () => ({ debug: vi.fn(), info: vi.fn(), warn: vi.fn(), error: vi.fn() }),
}));

describe("sanitizeVisibleAiText", () => {
  it("removes hidden marker delimiters and content after them", () => {
    const input = "Hello user!---STRUCTURED_DATA---{\"type\":\"partners\"}";
    expect(sanitizeVisibleAiText(input)).toBe("Hello user!");
  });

  it("removes code blocks", () => {
    const input = "Here is info\n```json\n{\"x\":1}\n```\nDone";
    expect(sanitizeVisibleAiText(input)).toBe("Here is info\n\nDone");
  });

  it("returns empty string for empty input", () => {
    expect(sanitizeVisibleAiText("")).toBe("");
    expect(sanitizeVisibleAiText(null as unknown as string)).toBe("");
  });

  it("preserves normal text without markers", () => {
    expect(sanitizeVisibleAiText("Normal response text")).toBe("Normal response text");
  });

  it("collapses excessive newlines", () => {
    expect(sanitizeVisibleAiText("a\n\n\n\n\nb")).toBe("a\n\nb");
  });
});

describe("parseAiAgentResponse", () => {
  it("extracts partners from STRUCTURED_DATA marker", () => {
    const content = 'Some text---STRUCTURED_DATA---{"type":"partners","data":[{"name":"Co A"}]}';
    const result = parseAiAgentResponse(content);
    expect(result.partners).toHaveLength(1);
    expect((result.partners[0] as { name: string }).name).toBe("Co A");
    expect(result.text).toBe("Some text");
  });

  it("extracts jobCreated from JOB_CREATED marker", () => {
    const job = { job_id: "j1", country: "IT", mode: "full", total_partners: 50, estimated_time_minutes: 10 };
    const content = `Avvio download---JOB_CREATED---${JSON.stringify(job)}`;
    const result = parseAiAgentResponse(content);
    expect(result.jobCreated).toEqual(job);
    expect(result.operations).toHaveLength(1);
    expect(result.operations[0].job_id).toBe("j1");
  });

  it("extracts UI actions from UI_ACTIONS marker", () => {
    const actions = [{ action_type: "navigate", path: "/partners" }];
    const content = `Go here---UI_ACTIONS---${JSON.stringify(actions)}`;
    const result = parseAiAgentResponse(content);
    expect(result.uiActions).toHaveLength(1);
    expect(result.uiActions[0].path).toBe("/partners");
  });

  it("handles content with no markers", () => {
    const result = parseAiAgentResponse("Just plain text");
    expect(result.text).toBe("Just plain text");
    expect(result.partners).toEqual([]);
    expect(result.jobCreated).toBeNull();
    expect(result.uiActions).toEqual([]);
    expect(result.operations).toEqual([]);
  });

  it("handles malformed JSON gracefully", () => {
    const content = "Text---STRUCTURED_DATA---{broken json!!!}";
    const result = parseAiAgentResponse(content);
    expect(result.partners).toEqual([]);
    expect(result.text).toBe("Text");
  });

  it("handles empty string", () => {
    const result = parseAiAgentResponse("");
    expect(result.text).toBe("");
    expect(result.partners).toEqual([]);
  });
});

describe("dispatchAiUiActions", () => {
  it("dispatches custom events for each action", () => {
    const spy = vi.spyOn(window, "dispatchEvent");
    dispatchAiUiActions([
      { action_type: "navigate", path: "/test" },
      { action_type: "show_toast", message: "Done" },
    ]);
    expect(spy).toHaveBeenCalledTimes(2);
    const event1 = spy.mock.calls[0][0] as CustomEvent;
    expect(event1.type).toBe("ai-ui-action");
    expect(event1.detail.path).toBe("/test");
    spy.mockRestore();
  });

  it("handles empty array without errors", () => {
    expect(() => dispatchAiUiActions([])).not.toThrow();
  });
});
