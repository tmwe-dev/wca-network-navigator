/**
 * DAL — channelMessages module tests
 */
import { describe, it, expect, vi, beforeEach } from "vitest";

const mockInsert = vi.fn();
const mockSelect = vi.fn();
const mockEq = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      insert: mockInsert,
      select: (...args: unknown[]) => {
        mockSelect(...args);
        return {
          eq: (...eqArgs: unknown[]) => {
            mockEq(...eqArgs);
            return { count: 5, error: null };
          },
          count: 10,
          error: null,
        };
      },
    }),
  },
}));

import { insertChannelMessage, countChannelMessages } from "@/data/channelMessages";

describe("DAL — channelMessages", () => {
  beforeEach(() => vi.clearAllMocks());

  describe("insertChannelMessage", () => {
    it("inserts a message", async () => {
      mockInsert.mockResolvedValue({ error: null });
      await insertChannelMessage({
        user_id: "u1",
        channel: "email",
        direction: "inbound",
      });
      expect(mockInsert).toHaveBeenCalledWith(
        expect.objectContaining({ channel: "email", direction: "inbound" })
      );
    });

    it("throws on error", async () => {
      mockInsert.mockResolvedValue({ error: { message: "constraint" } });
      await expect(
        insertChannelMessage({ user_id: "u1", channel: "email", direction: "out" })
      ).rejects.toEqual({ message: "constraint" });
    });
  });

  describe("countChannelMessages", () => {
    it("returns count without filter", async () => {
      const result = await countChannelMessages();
      expect(mockSelect).toHaveBeenCalledWith("id", { count: "planned", head: true });
      expect(result).toBe(10);
    });

    it("filters by channel when provided", async () => {
      const result = await countChannelMessages("email");
      expect(mockEq).toHaveBeenCalledWith("channel", "email");
      expect(result).toBe(5);
    });
  });
});
