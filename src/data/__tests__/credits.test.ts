/**
 * DAL — credits module tests
 * Tests: getUserCredits, countCreditTransactions
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

// Mock supabase client
const mockSelect = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import { getUserCredits, countCreditTransactions } from "@/data/credits";

describe("DAL — credits", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({ select: mockSelect });
    mockSelect.mockReturnValue({ limit: mockLimit, select: mockSelect });
    mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
  });

  describe("getUserCredits", () => {
    it("returns balance and total_consumed on success", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: { balance: 42, total_consumed: 58 },
        error: null,
      });
      const result = await getUserCredits();
      expect(mockFrom).toHaveBeenCalledWith("user_credits");
      expect(mockSelect).toHaveBeenCalledWith("balance, total_consumed");
      expect(result).toEqual({ balance: 42, total_consumed: 58 });
    });

    it("returns defaults when no row found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await getUserCredits();
      expect(result).toEqual({ balance: 0, total_consumed: 0 });
    });

    it("throws on supabase error", async () => {
      mockMaybeSingle.mockResolvedValue({
        data: null,
        error: { message: "connection failed" },
      });
      await expect(getUserCredits()).rejects.toEqual({ message: "connection failed" });
    });
  });

  describe("countCreditTransactions", () => {
    it("returns count from credit_transactions", async () => {
      mockSelect.mockReturnValue({ count: 15, error: null });
      const result = await countCreditTransactions();
      expect(mockFrom).toHaveBeenCalledWith("credit_transactions");
      expect(result).toBe(15);
    });

    it("returns 0 when count is null", async () => {
      mockSelect.mockReturnValue({ count: null, error: null });
      const result = await countCreditTransactions();
      expect(result).toBe(0);
    });

    it("throws on error", async () => {
      mockSelect.mockReturnValue({ count: null, error: { message: "denied" } });
      await expect(countCreditTransactions()).rejects.toEqual({ message: "denied" });
    });
  });
});
