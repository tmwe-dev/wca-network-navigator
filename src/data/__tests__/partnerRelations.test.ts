import { describe, it, expect, vi, beforeEach } from "vitest";

const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockEq = vi.fn();
const mockIlike = vi.fn();
const mockIn = vi.fn();
const mockLimit = vi.fn();
const mockMaybeSingle = vi.fn();
const mockSingle = vi.fn();
const mockFrom = vi.fn();

vi.mock("@/integrations/supabase/client", () => ({
  supabase: { from: (...a: any[]) => mockFrom(...a) },
}));

import {
  findPartnerContacts,
  findPartnerContactByEmail,
  insertPartnerContact,
  updatePartnerContact,
  countPartnerContacts,
  findPartnerNetworks,
  findPartnerServices,
  findPartnerCertifications,
  findPartnerSocialLinks,
} from "@/data/partnerRelations";

describe("DAL — partnerRelations", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
    });
    mockSelect.mockReturnValue({ eq: mockEq, in: mockIn, ilike: mockIlike });
    mockEq.mockReturnValue({ eq: mockEq, in: mockIn });
    mockEq.mockResolvedValue({ data: [], error: null });
    mockInsert.mockReturnValue({ select: mockSelect });
    mockUpdate.mockReturnValue({ eq: mockEq });
    mockIlike.mockReturnValue({ limit: mockLimit });
    mockLimit.mockReturnValue({ maybeSingle: mockMaybeSingle });
    mockMaybeSingle.mockResolvedValue({ data: null, error: null });
    mockSingle.mockResolvedValue({ data: { id: "c1" }, error: null });
    mockIn.mockResolvedValue({ data: [], error: null });
  });

  describe("findPartnerContacts", () => {
    it("returns contacts for partner", async () => {
      const contacts = [{ id: "c1", name: "Test" }];
      mockEq.mockResolvedValue({ data: contacts, error: null });
      const result = await findPartnerContacts("p1");
      expect(mockFrom).toHaveBeenCalledWith("partner_contacts");
      expect(result).toEqual(contacts);
    });

    it("returns empty on null data", async () => {
      mockEq.mockResolvedValue({ data: null, error: null });
      const result = await findPartnerContacts("p1");
      expect(result).toEqual([]);
    });

    it("throws on error", async () => {
      mockEq.mockResolvedValue({ data: null, error: { message: "fail" } });
      await expect(findPartnerContacts("p1")).rejects.toEqual({ message: "fail" });
    });
  });

  describe("findPartnerContactByEmail", () => {
    it("returns contact by email", async () => {
      const contact = { partner_id: "p1", name: "Test" };
      mockMaybeSingle.mockResolvedValue({ data: contact, error: null });
      const result = await findPartnerContactByEmail("test@co.com");
      expect(result).toEqual(contact);
    });

    it("returns null when not found", async () => {
      mockMaybeSingle.mockResolvedValue({ data: null, error: null });
      const result = await findPartnerContactByEmail("x@y.com");
      expect(result).toBeNull();
    });
  });

  describe("insertPartnerContact", () => {
    it("inserts and returns contact", async () => {
      mockSelect.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({ data: { id: "c1", name: "New" }, error: null });
      const result = await insertPartnerContact({ name: "New", partner_id: "p1" });
      expect(result).toEqual({ id: "c1", name: "New" });
    });
  });

  describe("updatePartnerContact", () => {
    it("updates contact", async () => {
      mockEq.mockResolvedValue({ error: null });
      await updatePartnerContact("c1", { name: "Updated" });
      expect(mockFrom).toHaveBeenCalledWith("partner_contacts");
    });
  });

  describe("countPartnerContacts", () => {
    it("returns count", async () => {
      mockSelect.mockResolvedValue({ count: 42, error: null });
      const result = await countPartnerContacts();
      expect(result).toBe(42);
    });

    it("returns 0 on null count", async () => {
      mockSelect.mockResolvedValue({ count: null, error: null });
      const result = await countPartnerContacts();
      expect(result).toBe(0);
    });
  });

  describe("findPartnerNetworks", () => {
    it("returns networks", async () => {
      mockEq.mockResolvedValue({ data: [{ network_name: "WCA" }], error: null });
      const result = await findPartnerNetworks("p1");
      expect(result).toEqual([{ network_name: "WCA" }]);
    });
  });

  describe("findPartnerServices", () => {
    it("returns services", async () => {
      mockEq.mockResolvedValue({ data: [{ service_category: "freight" }], error: null });
      const result = await findPartnerServices("p1");
      expect(result).toEqual([{ service_category: "freight" }]);
    });
  });

  describe("findPartnerCertifications", () => {
    it("returns certifications", async () => {
      mockEq.mockResolvedValue({ data: [{ certification: "ISO9001" }], error: null });
      const result = await findPartnerCertifications("p1");
      expect(result).toEqual([{ certification: "ISO9001" }]);
    });
  });

  describe("findPartnerSocialLinks", () => {
    it("returns social links", async () => {
      mockEq.mockResolvedValue({ data: [{ platform: "linkedin", url: "https://linkedin.com" }], error: null });
      const result = await findPartnerSocialLinks("p1");
      expect(result).toEqual([{ platform: "linkedin", url: "https://linkedin.com" }]);
    });
  });
});
