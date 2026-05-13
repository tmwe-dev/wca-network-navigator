/**
 * DAL — emailAddressRules module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const _mockIn = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: unknown[]) => mockFrom(...a) },
}));

import { findEmailAddressRules, updateEmailAddressRule } from "@/data/emailAddressRules";

describe("DAL — emailAddressRules", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect, update: mockUpdate });
    mockSelect.mockReturnValue({ eq: mockEq });
    mockEq.mockResolvedValue({ data: [], error: null });
    mockUpdate.mockReturnValue({ eq: mockEq });
  });

  describe("findEmailAddressRules", () => {
    it("returns rules for a user", async () => {
      const rules = [{ id: "r1", email_address: "a@b.com" }];
      mockEq.mockResolvedValue({ data: rules, error: null });
      const result = await findEmailAddressRules("u1");
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
      expect(result).toEqual(rules);
    });

    it("returns empty on no data", async () => {
      mockEq.mockResolvedValue({ data: [], error: null });
      const result = await findEmailAddressRules("u1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ data: null, error: { message: "denied" } });
      await expect(findEmailAddressRules("u1")).rejects.toEqual({ message: "denied" });
    });
  });

  describe("updateEmailAddressRule", () => {
    it("updates a rule by id", async () => {
      mockEq.mockResolvedValue({ error: null });
      await expect(updateEmailAddressRule("r1", { email_address: "new@b.com" })).resolves.not.toThrow();
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
    });

    it("throws on update error", async () => {
      mockEq.mockResolvedValue({ error: { message: "not found" } });
      await expect(updateEmailAddressRule("r1", {})).rejects.toEqual({ message: "not found" });
    });
  });
});
