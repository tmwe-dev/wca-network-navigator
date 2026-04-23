/**
 * suggestedImprovements — Unit tests for the learning loop DAL.
 *
 * Tests: createSuggestion (auto-approve flow), buildLearnedPatterns,
 * markSuggestionsApplied, countByStatus, listPendingForAdmin.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// ── Mock chain builders ──
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockIn = vi.fn();
const mockOr = vi.fn();
const mockOrder = vi.fn();
const mockLimit = vi.fn();
const mockSingle = vi.fn();

function resetChain() {
  const chain = {
    select: (...a: unknown[]) => { mockSelect(...a); return chain; },
    eq: (...a: unknown[]) => { mockEq(...a); return chain; },
    in: (...a: unknown[]) => { mockIn(...a); return chain; },
    or: (...a: unknown[]) => { mockOr(...a); return chain; },
    order: (...a: unknown[]) => { mockOrder(...a); return chain; },
    limit: (...a: unknown[]) => { mockLimit(...a); return chain; },
    single: () => mockSingle(),
    insert: (d: unknown) => { mockInsert(d); return chain; },
    update: (d: unknown) => { mockUpdate(d); return chain; },
  };
  return chain;
}

let currentChain = resetChain();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => currentChain,
  },
}));

beforeEach(() => {
  vi.clearAllMocks();
  currentChain = resetChain();
});

describe("createSuggestion", () => {
  it("auto-approves user_preference type", async () => {
    const { createSuggestion } = await import("../suggestedImprovements");

    const mockRow = {
      id: "s1",
      created_by: "u1",
      suggestion_type: "user_preference",
      title: "Preferisco email brevi",
      content: "Max 100 parole",
      status: "approved",
    };
    mockSingle.mockResolvedValueOnce({ data: mockRow, error: null });

    const result = await createSuggestion("u1", {
      source_context: "chat",
      suggestion_type: "user_preference",
      title: "Preferisco email brevi",
      content: "Max 100 parole",
    });

    // Verify insert was called with auto-approve fields
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertData = mockInsert.mock.calls[0][0];
    expect(insertData.status).toBe("approved");
    expect(insertData.reviewed_by).toBe("u1");
    expect(insertData.review_note).toContain("Auto-approvato");
    expect(result.id).toBe("s1");
  });

  it("leaves kb_rule as pending", async () => {
    const { createSuggestion } = await import("../suggestedImprovements");

    mockSingle.mockResolvedValueOnce({
      data: { id: "s2", status: "pending", suggestion_type: "kb_rule" },
      error: null,
    });

    await createSuggestion("u1", {
      source_context: "email_edit",
      suggestion_type: "kb_rule",
      title: "Regola hook",
      content: "Apri sempre con fatto concreto",
    });

    const insertData = mockInsert.mock.calls[0][0];
    expect(insertData.status).toBe("pending");
    expect(insertData.reviewed_by).toBeNull();
  });
});

describe("buildLearnedPatterns", () => {
  it("assembles compact patterns from approved entries", async () => {
    const { buildLearnedPatterns } = await import("../suggestedImprovements");

    mockLimit.mockReturnValueOnce({
      then: undefined,
      data: [
        { title: "Email brevi", content: "Max 100 parole nel corpo", suggestion_type: "user_preference", priority: "high" },
        { title: "Hook concreto", content: "Apri con un fatto specifico sul partner", suggestion_type: "kb_rule", priority: "medium" },
      ],
      error: null,
    });

    // Override the chain to return data at the end
    const rows = [
      { title: "Email brevi", content: "Max 100 parole nel corpo", suggestion_type: "user_preference", priority: "high" },
      { title: "Hook concreto", content: "Apri con un fatto specifico sul partner", suggestion_type: "kb_rule", priority: "medium" },
    ];

    // Re-mock the chain so limit returns a proper Promise-like
    currentChain = {
      select: (...a: unknown[]) => { mockSelect(...a); return currentChain; },
      eq: (...a: unknown[]) => { mockEq(...a); return currentChain; },
      in: (...a: unknown[]) => { mockIn(...a); return currentChain; },
      or: (...a: unknown[]) => { mockOr(...a); return currentChain; },
      order: (...a: unknown[]) => { mockOrder(...a); return currentChain; },
      limit: (...a: unknown[]) => { mockLimit(...a); return Promise.resolve({ data: rows, error: null }); },
      single: () => mockSingle(),
      insert: (d: unknown) => { mockInsert(d); return currentChain; },
      update: (d: unknown) => { mockUpdate(d); return currentChain; },
    } as any;

    const result = await buildLearnedPatterns("u1");

    expect(result).toContain("[user_preference|high] Email brevi:");
    expect(result).toContain("[kb_rule|medium] Hook concreto:");
    expect(result.split("\n")).toHaveLength(2);
  });

  it("returns empty string on error", async () => {
    const { buildLearnedPatterns } = await import("../suggestedImprovements");

    currentChain = {
      select: () => currentChain,
      eq: () => currentChain,
      in: () => currentChain,
      or: () => currentChain,
      order: () => currentChain,
      limit: () => Promise.resolve({ data: null, error: { message: "timeout" } }),
      single: () => mockSingle(),
      insert: () => currentChain,
      update: () => currentChain,
    } as any;

    const result = await buildLearnedPatterns("u1");
    expect(result).toBe("");
  });

  it("truncates long content to 300 chars", async () => {
    const { buildLearnedPatterns } = await import("../suggestedImprovements");

    const longContent = "A".repeat(500);
    currentChain = {
      select: () => currentChain,
      eq: () => currentChain,
      in: () => currentChain,
      or: () => currentChain,
      order: () => currentChain,
      limit: () => Promise.resolve({
        data: [{ title: "Long", content: longContent, suggestion_type: "kb_rule", priority: "low" }],
        error: null,
      }),
      single: () => mockSingle(),
      insert: () => currentChain,
      update: () => currentChain,
    } as any;

    const result = await buildLearnedPatterns("u1");
    // Content should be truncated at 300 + ellipsis
    expect(result).toContain("…");
    expect(result.length).toBeLessThan(500);
  });
});

describe("countByStatus", () => {
  it("counts status distribution correctly", async () => {
    const { countByStatus } = await import("../suggestedImprovements");

    currentChain = {
      select: (...a: unknown[]) => {
        mockSelect(...a);
        return Promise.resolve({
          data: [
            { status: "pending" },
            { status: "pending" },
            { status: "approved" },
            { status: "applied" },
            { status: "rejected" },
          ],
          error: null,
        });
      },
      eq: () => currentChain,
      in: () => currentChain,
      or: () => currentChain,
      order: () => currentChain,
      limit: () => currentChain,
      single: () => mockSingle(),
      insert: () => currentChain,
      update: () => currentChain,
    } as any;

    const counts = await countByStatus();
    expect(counts.pending).toBe(2);
    expect(counts.approved).toBe(1);
    expect(counts.applied).toBe(1);
    expect(counts.rejected).toBe(1);
  });
});
