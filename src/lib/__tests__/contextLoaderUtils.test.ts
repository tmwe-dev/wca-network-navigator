import { describe, it, expect } from "vitest";
import { extractMentions, getContextStrategy } from "@/lib/contextLoaderUtils";

describe("extractMentions", () => {
  it("extracts emails from text", () => {
    const result = extractMentions("Contact john@acme.com for info");
    expect(result.mentionedEmails).toEqual(["john@acme.com"]);
  });

  it("extracts proper names from text", () => {
    const result = extractMentions("please ask Jane Doe about it");
    expect(result.mentionedNames.length).toBeGreaterThan(0);
    expect(result.mentionedNames.some(n => n.includes("Jane"))).toBe(true);
  });

  it("returns empty arrays for text without mentions", () => {
    const result = extractMentions("no mentions here");
    expect(result.mentionedEmails).toEqual([]);
    expect(result.mentionedNames).toEqual([]);
  });

  it("limits emails to 3 and names to 2", () => {
    const text = "a@b.com c@d.com e@f.com g@h.com John Doe Jane Smith Bob Brown";
    const result = extractMentions(text);
    expect(result.mentionedEmails).toHaveLength(3);
    expect(result.mentionedNames).toHaveLength(2);
  });
});

describe("getContextStrategy", () => {
  it("returns email when emails present", () => {
    expect(getContextStrategy({ mentionedEmails: ["a@b.com"], mentionedNames: [] })).toBe("email");
  });

  it("returns name when only names present", () => {
    expect(getContextStrategy({ mentionedEmails: [], mentionedNames: ["John Doe"] })).toBe("name");
  });

  it("returns fallback when nothing found", () => {
    expect(getContextStrategy({ mentionedEmails: [], mentionedNames: [] })).toBe("fallback");
  });
});
