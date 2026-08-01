import { describe, it, expect } from "vitest";
import { extractMentions, getContextStrategy } from "@/lib/contextLoaderUtils";

describe("extractMentions", () => {
  it("extracts email address from message text", () => {
    const result = extractMentions("Please contact test@acme.com for details");
    expect(result.mentionedEmails).toContain("test@acme.com");
  });

  it("extracts proper name from message text", () => {
    const result = extractMentions("I spoke with Mario Rossi yesterday");
    expect(result.mentionedNames).toContain("Mario Rossi");
  });

  it("returns empty arrays when no emails or names found", () => {
    const result = extractMentions("hello world 12345");
    expect(result.mentionedEmails).toHaveLength(0);
    expect(result.mentionedNames).toHaveLength(0);
  });

  it("slices emails to max 3", () => {
    const text = "a@b.com c@d.com e@f.com g@h.com i@j.com";
    const result = extractMentions(text);
    expect(result.mentionedEmails).toHaveLength(3);
    expect(result.mentionedEmails).toEqual(["a@b.com", "c@d.com", "e@f.com"]);
  });

  it("slices names to max 2", () => {
    const text = "Mario Rossi e Giovanni Bianchi e Marco Verdi";
    const result = extractMentions(text);
    expect(result.mentionedNames).toHaveLength(2);
  });

  it("extracts multiple emails correctly", () => {
    const result = extractMentions("Send to alice@test.com and bob@test.com");
    expect(result.mentionedEmails).toEqual(["alice@test.com", "bob@test.com"]);
  });
});

describe("getContextStrategy", () => {
  it("returns 'email' when emails present", () => {
    expect(getContextStrategy({ mentionedEmails: ["a@b.com"], mentionedNames: [] })).toBe("email");
  });

  it("returns 'name' when only names present", () => {
    expect(getContextStrategy({ mentionedEmails: [], mentionedNames: ["Mario Rossi"] })).toBe("name");
  });

  it("returns 'fallback' when nothing found", () => {
    expect(getContextStrategy({ mentionedEmails: [], mentionedNames: [] })).toBe("fallback");
  });

  it("prefers 'email' over 'name' when both present", () => {
    expect(getContextStrategy({ mentionedEmails: ["a@b.com"], mentionedNames: ["Mario Rossi"] })).toBe("email");
  });
});
