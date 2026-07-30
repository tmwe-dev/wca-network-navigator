import { describe, it, expect, vi, beforeEach } from "vitest";

const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (table: string) => mockFrom(table) },
}));

import {
  fetchSenderGroupsOrdered,
  fetchAssignedAddressRules,
  fetchUncategorizedAddressRules,
  fetchClassifiedAddressRules,
  fetchInboundEmailSenderAddresses,
} from "@/data/emailGrouping";

type Terminal = { data?: unknown; error?: unknown };

function chain(terminals: Terminal[]) {
  const calls: Record<string, unknown[][]> = {};
  let i = 0;
  const c: Record<string, unknown> = {};
  for (const m of ["select", "order", "not", "is", "or", "range", "eq"]) {
    c[m] = vi.fn((...args: unknown[]) => {
      (calls[m] ||= []).push(args);
      return c;
    });
  }
  c.then = (resolve: (v: Terminal) => void) => resolve(terminals[Math.min(i++, terminals.length - 1)]);
  return { c, calls };
}

beforeEach(() => mockFrom.mockReset());

describe("DAL — emailGrouping", () => {
  describe("fetchSenderGroupsOrdered", () => {
    it("queries email_sender_groups with * ordered by sort_order asc", async () => {
      const { c, calls } = chain([{ data: [{ id: "g1" }], error: null }]);
      mockFrom.mockReturnValue(c);
      const res = await fetchSenderGroupsOrdered();
      expect(mockFrom).toHaveBeenCalledWith("email_sender_groups");
      expect(calls.select[0]).toEqual(["*"]);
      expect(calls.order[0]).toEqual(["sort_order", { ascending: true }]);
      expect(res).toEqual([{ id: "g1" }]);
    });

    it("returns empty array when data is null (error ignored, legacy semantics)", async () => {
      const { c } = chain([{ data: null, error: { message: "denied" } }]);
      mockFrom.mockReturnValue(c);
      await expect(fetchSenderGroupsOrdered()).resolves.toEqual([]);
    });
  });

  describe("fetchAssignedAddressRules", () => {
    it("queries email_address_rules with group_name not null, created_at desc, paged range", async () => {
      const { c, calls } = chain([{ data: [{ id: "r1" }], error: null }]);
      mockFrom.mockReturnValue(c);
      const res = await fetchAssignedAddressRules();
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
      expect(calls.select[0]).toEqual([
        "id, email_address, display_name, group_name, created_at, company_name, domain",
      ]);
      expect(calls.not[0]).toEqual(["group_name", "is", null]);
      expect(calls.order[0]).toEqual(["created_at", { ascending: false }]);
      expect(calls.range[0]).toEqual([0, 999]);
      expect(res).toEqual([{ id: "r1" }]);
    });

    it("paginates until a partial page is returned", async () => {
      const full = Array.from({ length: 1000 }, (_, i) => ({ id: `r${i}` }));
      const { c, calls } = chain([
        { data: full, error: null },
        { data: [{ id: "last" }], error: null },
      ]);
      mockFrom.mockReturnValue(c);
      const res = await fetchAssignedAddressRules();
      expect(calls.range).toEqual([[0, 999], [1000, 1999]]);
      expect(res).toHaveLength(1001);
    });

    it("throws on query error", async () => {
      const { c } = chain([{ data: null, error: { message: "boom" } }]);
      mockFrom.mockReturnValue(c);
      await expect(fetchAssignedAddressRules()).rejects.toEqual({ message: "boom" });
    });
  });

  const UNCATEGORIZED_COLS =
    "id, email_address, display_name, email_count, last_email_at, domain, company_name, ai_suggested_group, ai_suggestion_confidence, ai_suggestion_accepted, is_blocked";

  describe("fetchUncategorizedAddressRules", () => {
    it("filters on group_id/group_name null, orders by email_count desc, paged range", async () => {
      const { c, calls } = chain([{ data: [{ id: "u1" }], error: null }]);
      mockFrom.mockReturnValue(c);
      const res = await fetchUncategorizedAddressRules();
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
      expect(calls.select[0]).toEqual([UNCATEGORIZED_COLS]);
      expect(calls.is).toEqual([["group_id", null], ["group_name", null]]);
      expect(calls.order[0]).toEqual(["email_count", { ascending: false }]);
      expect(calls.range[0]).toEqual([0, 999]);
      expect(res).toEqual([{ id: "u1" }]);
    });

    it("throws on query error", async () => {
      const { c } = chain([{ data: null, error: { message: "boom-u" } }]);
      mockFrom.mockReturnValue(c);
      await expect(fetchUncategorizedAddressRules()).rejects.toEqual({ message: "boom-u" });
    });
  });

  describe("fetchClassifiedAddressRules", () => {
    it("filters with or(group_id/group_name not null), orders by email_count desc, paged range", async () => {
      const { c, calls } = chain([{ data: [{ id: "c1" }], error: null }]);
      mockFrom.mockReturnValue(c);
      const res = await fetchClassifiedAddressRules();
      expect(mockFrom).toHaveBeenCalledWith("email_address_rules");
      expect(calls.select[0]).toEqual([`${UNCATEGORIZED_COLS}, group_id, group_name`]);
      expect(calls.or[0]).toEqual(["group_id.not.is.null,group_name.not.is.null"]);
      expect(calls.is).toBeUndefined();
      expect(calls.order[0]).toEqual(["email_count", { ascending: false }]);
      expect(calls.range[0]).toEqual([0, 999]);
      expect(res).toEqual([{ id: "c1" }]);
    });

    it("paginates until a partial page is returned", async () => {
      const full = Array.from({ length: 1000 }, (_, i) => ({ id: `c${i}` }));
      const { c, calls } = chain([
        { data: full, error: null },
        { data: [{ id: "tail" }], error: null },
      ]);
      mockFrom.mockReturnValue(c);
      const res = await fetchClassifiedAddressRules();
      expect(calls.range).toEqual([[0, 999], [1000, 1999]]);
      expect(res).toHaveLength(1001);
    });

    it("throws on query error", async () => {
      const { c } = chain([{ data: null, error: { message: "boom-c" } }]);
      mockFrom.mockReturnValue(c);
      await expect(fetchClassifiedAddressRules()).rejects.toEqual({ message: "boom-c" });
    });
  });
});

describe("DAL — fetchInboundEmailSenderAddresses", () => {
  const BASE_EQ = [
    ["channel", "email"],
    ["direction", "inbound"],
    ["user_id", "u1"],
  ];

  it("personal mailbox uses .is('mailbox_id', null) and never .eq on mailbox_id", async () => {
    const { c, calls } = chain([{ data: [{ from_address: "a@b.c" }], error: null }]);
    mockFrom.mockReturnValue(c);
    const res = await fetchInboundEmailSenderAddresses({
      userId: "u1",
      mailbox: { kind: "personal" },
    });
    expect(mockFrom).toHaveBeenCalledWith("channel_messages");
    expect(calls.select[0]).toEqual(["from_address"]);
    expect(calls.eq).toEqual(BASE_EQ);
    expect(calls.is).toEqual([["mailbox_id", null]]);
    expect(calls.not[0]).toEqual(["from_address", "is", null]);
    expect(calls.order[0]).toEqual(["id", { ascending: true }]);
    expect(calls.range[0]).toEqual([0, 999]);
    expect(res).toEqual([{ from_address: "a@b.c" }]);
  });

  it("shared mailbox uses .eq('mailbox_id', id) and never .is on mailbox_id", async () => {
    const { c, calls } = chain([{ data: [], error: null }]);
    mockFrom.mockReturnValue(c);
    await fetchInboundEmailSenderAddresses({
      userId: "u1",
      mailbox: { kind: "shared", mailboxId: "mb-9" },
    });
    expect(calls.eq).toEqual([...BASE_EQ, ["mailbox_id", "mb-9"]]);
    expect(calls.is).toBeUndefined();
    expect(calls.select[0]).toEqual(["from_address"]);
    expect(calls.not[0]).toEqual(["from_address", "is", null]);
    expect(calls.order[0]).toEqual(["id", { ascending: true }]);
  });

  it("no mailbox → no mailbox_id filter at all", async () => {
    const { c, calls } = chain([{ data: [], error: null }]);
    mockFrom.mockReturnValue(c);
    await fetchInboundEmailSenderAddresses({ userId: "u1", mailbox: null });
    expect(calls.eq).toEqual(BASE_EQ);
    expect(calls.is).toBeUndefined();
  });

  it("paginates until a partial page is returned", async () => {
    const full = Array.from({ length: 1000 }, (_, i) => ({ from_address: `x${i}@y.z` }));
    const { c, calls } = chain([
      { data: full, error: null },
      { data: [{ from_address: "tail@y.z" }], error: null },
    ]);
    mockFrom.mockReturnValue(c);
    const res = await fetchInboundEmailSenderAddresses({
      userId: "u1",
      mailbox: { kind: "personal" },
    });
    expect(calls.range).toEqual([[0, 999], [1000, 1999]]);
    expect(res).toHaveLength(1001);
  });

  it("throws on query error", async () => {
    const { c } = chain([{ data: null, error: { message: "boom-m" } }]);
    mockFrom.mockReturnValue(c);
    await expect(
      fetchInboundEmailSenderAddresses({ userId: "u1", mailbox: null }),
    ).rejects.toEqual({ message: "boom-m" });
  });
});
