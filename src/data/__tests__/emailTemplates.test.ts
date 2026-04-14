/**
 * DAL — emailTemplates module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return {
              order: () => ({ data: [], error: null }),
              single: () => ({ data: { id: "t1" }, error: null }),
              maybeSingle: () => ({ data: { id: "t1" }, error: null }),
            };
          },
          order: () => ({ data: [], error: null }),
        };
      },
      insert: (...args: unknown[]) => {
        mockInsert(...args);
        return { select: () => ({ single: () => ({ data: { id: "new" }, error: null }) }), error: null };
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

import * as templates from "@/data/emailTemplates";

describe("DAL — emailTemplates", () => {
  beforeEach(() => vi.clearAllMocks());

  it("exports expected CRUD functions", () => {
    expect(typeof templates.findEmailTemplates).toBe("function");
    expect(typeof templates.createEmailTemplate).toBe("function");
    expect(typeof templates.deleteEmailTemplate).toBe("function");
  });
});
