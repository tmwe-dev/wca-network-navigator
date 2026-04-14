/**
 * DAL — blacklist module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockInsert = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { data: [], error: null };
          },
          order: () => ({ data: [{ id: "b1", company_name: "BadCo" }], error: null }),
        };
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return { error: null };
      },
    }),
  },
}));

import * as blacklist from "@/data/blacklist";

describe("DAL — blacklist", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports expected functions", () => {
    expect(typeof blacklist.findAllBlacklistEntries).toBe("function");
    expect(typeof blacklist.insertBlacklistBatch).toBe("function");
    expect(typeof blacklist.updateBlacklistEntry).toBe("function");
  });
});
