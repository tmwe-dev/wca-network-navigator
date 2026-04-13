import { describe, it, expect } from "vitest";
import {
  shouldCreateSenderPattern,
  shouldCreateDomainPattern,
  buildPatternTag,
  buildDomainPatternTag,
} from "@/lib/kbPatternDetection";

describe("shouldCreateSenderPattern", () => {
  it("5 classifications + confidence ≥ 0.75 → true", () => {
    expect(shouldCreateSenderPattern(5, 0.75)).toBe(true);
  });

  it("4 classifications → false", () => {
    expect(shouldCreateSenderPattern(4, 0.80)).toBe(false);
  });

  it("5 classifications but confidence < 0.75 → false", () => {
    expect(shouldCreateSenderPattern(5, 0.70)).toBe(false);
  });

  it("10 classifications + high confidence → true", () => {
    expect(shouldCreateSenderPattern(10, 0.90)).toBe(true);
  });
});

describe("shouldCreateDomainPattern", () => {
  it("3 unique addresses → true", () => {
    expect(shouldCreateDomainPattern(3)).toBe(true);
  });

  it("2 unique addresses → false", () => {
    expect(shouldCreateDomainPattern(2)).toBe(false);
  });

  it("5 unique addresses → true", () => {
    expect(shouldCreateDomainPattern(5)).toBe(true);
  });
});

describe("buildPatternTag", () => {
  it("builds correct sender pattern tag", () => {
    expect(buildPatternTag("acme.com", "interested")).toBe("email_pattern_acme.com_interested");
  });
});

describe("buildDomainPatternTag", () => {
  it("builds correct domain pattern tag", () => {
    expect(buildDomainPatternTag("logistics.de", "spam")).toBe("domain_pattern_logistics.de_spam");
  });

  it("no duplicate check logic — that's caller responsibility", () => {
    const tag1 = buildDomainPatternTag("test.com", "auto_reply");
    const tag2 = buildDomainPatternTag("test.com", "auto_reply");
    expect(tag1).toBe(tag2);
  });
});
