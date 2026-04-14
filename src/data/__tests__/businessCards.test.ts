/**
 * DAL — businessCards module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockEq = vi.fn();
const mockOrder = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              order: (...oArgs: unknown[]) => {
                mockOrder(...oArgs);
                return { data: [{ id: "bc1" }], error: null };
              },
              single: () => ({ data: { id: "bc1" }, error: null }),
              maybeSingle: () => ({ data: { id: "bc1" }, error: null }),
            };
          },
          order: (...oArgs: unknown[]) => {
            mockOrder(...oArgs);
            return { data: [{ id: "bc1" }], error: null };
          },
        };
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return { select: () => ({ single: () => ({ data: { id: "new" }, error: null }) }) };
      },
      update: (...args: unknown[]) => {
        mockUpdate(...args);
        return { eq: () => ({ error: null }) };
      },
      delete: () => ({
        eq: (...args: unknown[]) => {
          mockDelete(...args);
          return { error: null };
        },
      }),
    }),
  },
}));

import * as bCards from "@/data/businessCards";

describe("DAL — businessCards", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports expected CRUD functions", () => {
    expect(typeof bCards.findBusinessCards).toBe("function");
    expect(typeof bCards.createBusinessCard).toBe("function");
    expect(typeof bCards.updateBusinessCard).toBe("function");
    expect(typeof bCards.deleteBusinessCards).toBe("function");
  });
});
