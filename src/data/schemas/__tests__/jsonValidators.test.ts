import { describe, expect, it, vi } from "vitest";
import {
  safeParsePartnerEnrichment,
  safeParseAssignedTools,
  parsePartnerEnrichmentStrict,
  parseAssignedToolsStrict,
} from "../jsonValidators";

describe("jsonValidators", () => {
  describe("safeParsePartnerEnrichment", () => {
    it("accepts valid shape", () => {
      const res = safeParsePartnerEnrichment({
        source_url: "https://example.com",
        summary_it: "Test",
        employee_count: 100,
        has_own_fleet: true,
      });
      expect(res.ok).toBe(true);
    });

    it("accepts unknown extra keys (passthrough)", () => {
      const res = safeParsePartnerEnrichment({
        source_url: "https://example.com",
        future_field: "anything",
      });
      expect(res.ok).toBe(true);
      expect((res.data as Record<string, unknown>).future_field).toBe("anything");
    });

    it("returns ok=false on invalid type but does not throw", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = safeParsePartnerEnrichment({
        source_url: "not-a-url",
        employee_count: "not-a-number",
      });
      expect(res.ok).toBe(false);
      expect(res.errors?.length).toBeGreaterThan(0);
    });

    it("strict version throws on invalid", () => {
      expect(() =>
        parsePartnerEnrichmentStrict({ employee_count: "wrong" }),
      ).toThrow();
    });
  });

  describe("safeParseAssignedTools", () => {
    it("accepts valid snake_case tool names", () => {
      const res = safeParseAssignedTools(["search_partners", "get_partner_detail"]);
      expect(res.ok).toBe(true);
      expect(res.data).toEqual(["search_partners", "get_partner_detail"]);
    });

    it("rejects invalid names but returns sanitized list", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = safeParseAssignedTools([
        "search_partners",
        "Bad-Name",
        "ALSO_BAD",
        "ok_tool",
      ]);
      expect(res.ok).toBe(false);
      expect(res.data).toEqual(["search_partners", "ok_tool"]);
    });

    it("rejects non-array input", () => {
      vi.spyOn(console, "warn").mockImplementation(() => {});
      const res = safeParseAssignedTools("not-an-array");
      expect(res.ok).toBe(false);
      expect(res.data).toEqual([]);
    });

    it("strict version throws on invalid", () => {
      expect(() => parseAssignedToolsStrict(["Bad-Name"])).toThrow();
    });

    it("rejects > 100 tools", () => {
      const tools = Array.from({ length: 101 }, (_, i) => `tool_${i}`);
      expect(() => parseAssignedToolsStrict(tools)).toThrow();
    });
  });
});