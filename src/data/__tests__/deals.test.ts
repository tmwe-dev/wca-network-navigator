/**
 * DAL — deals module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const _mockSelect = vi.fn();
const _mockInsert = vi.fn();
const _mockUpdate = vi.fn();
const _mockEq = vi.fn();
const _mockOrder = vi.fn();
const _mockLimit = vi.fn();
const _mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

describe("DAL — deals (types only)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("deals module exports types for DealStage", async () => {
    const mod = await import("@/data/deals");
    expect(mod).toBeDefined();
  });
});
