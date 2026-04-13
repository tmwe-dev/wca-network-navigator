import { describe, it, expect } from "vitest";
import {
  shouldCreateSenderPattern,
  shouldCreateDomainPattern,
  buildPatternTag,
  buildDomainPatternTag,
} from "@/lib/kbPatternDetection";

describe("kbPatternDetection", () => {
  describe("shouldCreateSenderPattern", () => {
    it("returns true for 5+ classifications with high confidence", () => {
      expect(shouldCreateSenderPattern(5, 0.80)).toBe(true);
    });
    it("returns false for less than 5 classifications", () => {
      expect(shouldCreateSenderPattern(4, 0.90)).toBe(false);
    });
    it("returns false for low confidence", () => {
      expect(shouldCreateSenderPattern(10, 0.74)).toBe(false);
    });
    it("returns true at exact threshold", () => {
      expect(shouldCreateSenderPattern(5, 0.75)).toBe(true);
    });
  });

  describe("shouldCreateDomainPattern", () => {
    it("returns true for 3+ unique addresses", () => {
      expect(shouldCreateDomainPattern(3)).toBe(true);
    });
    it("returns false for fewer than 3", () => {
      expect(shouldCreateDomainPattern(2)).toBe(false);
    });
  });

  describe("buildPatternTag", () => {
    it("builds correct tag", () => {
      expect(buildPatternTag("acme.com", "spam")).toBe("email_pattern_acme.com_spam");
    });
  });

  describe("buildDomainPatternTag", () => {
    it("builds correct domain tag", () => {
      expect(buildDomainPatternTag("acme.com", "auto_reply")).toBe("domain_pattern_acme.com_auto_reply");
    });
  });
});
