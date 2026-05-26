import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const _mockDelete = vi.fn();
const mockEq = vi.fn();
const mockIs = vi.fn();
const mockOrder = vi.fn();
const mockIn = vi.fn();
const mockMaybeSingle = vi.fn();
const mockFrom = vi.fn();
const mockRpc = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: (...a: any[]) => mockFrom(...a),
    rpc: (...a: any[]) => mockRpc(...a),
  },
}));
vi.mock("@/lib/supabaseUntyped", () => ({
  untypedFrom: (...a: any[]) => mockFrom(...a),
}));

import {
  listAccessibleMailboxes,
  listSharedMailboxes,
  listOperatorMailboxAccess,
  deleteSharedMailbox,
} from "@/data/mailboxes";

describe("DAL — mailboxes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRpc.mockResolvedValue({ data: [], error: null });
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: () => ({ eq: mockEq }),
    });
    mockSelect.mockReturnValue({ eq: mockEq, is: mockIs, in: mockIn });
    mockIs.mockReturnValue({ order: mockOrder });
    mockEq.mockReturnValue({
      eq: mockEq,
      in: mockIn,
      order: mockOrder,
      select: mockSelect,
      maybeSingle: mockMaybeSingle,
    });
    mockOrder.mockResolvedValue({ data: [], error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockEq.mockResolvedValue({ error: null });
  });

  describe("listAccessibleMailboxes", () => {
    it("calls rpc and returns mailboxes", async () => {
      const mboxes = [{ mailbox_id: "m1", email: "a@b.com" }];
      mockRpc.mockResolvedValue({ data: mboxes, error: null });
      const result = await listAccessibleMailboxes("op1");
      expect(result).toEqual(mboxes);
    });

    it("throws on error", async () => {
      mockRpc.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(listAccessibleMailboxes()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listSharedMailboxes", () => {
    it("returns shared mailboxes", async () => {
      const mboxes = [{ id: "m1", email: "shared@co.com" }];
      mockOrder.mockResolvedValue({ data: mboxes, error: null });
      const result = await listSharedMailboxes();
      expect(result).toEqual(mboxes);
    });

    it("throws on error", async () => {
      mockOrder.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(listSharedMailboxes()).rejects.toEqual({ message: "fail" });
    });
  });

  describe("listOperatorMailboxAccess", () => {
    it("returns mailbox ids", async () => {
      mockEq.mockResolvedValue({ data: [{ shared_mailbox_id: "m1" }], error: null });
      const result = await listOperatorMailboxAccess("op1");
      expect(result).toEqual(["m1"]);
    });
  });

  describe("deleteSharedMailbox", () => {
    it("deletes by id", async () => {
      mockEq.mockResolvedValue({ error: null });
      await deleteSharedMailbox("m1");
      expect(mockFrom).toHaveBeenCalledWith("shared_mailboxes");
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ error: { message: "fail" } });
      await expect(deleteSharedMailbox("m1")).rejects.toEqual({ message: "fail" });
    });
  });
});
