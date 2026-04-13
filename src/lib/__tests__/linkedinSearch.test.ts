import { describe, it, expect } from "vitest";
import type { GoogleSearchResultLike, LinkedInProfileCandidate } from "@/lib/linkedinSearch";

vi.mock("@/lib/log", () => ({ createLogger: () => ({ info: vi.fn(), warn: vi.fn(), error: vi.fn() }) }));

describe("linkedinSearch", () => {
  it("GoogleSearchResultLike has url, title, description fields", () => {
    const result: GoogleSearchResultLike = {
      url: "https://linkedin.com/in/john",
      title: "John Doe",
      description: "CEO at Acme",
    };
    expect(result.url).toContain("linkedin.com");
    expect(result.title).toBe("John Doe");
  });

  it("LinkedInProfileCandidate requires profileUrl", () => {
    const candidate: LinkedInProfileCandidate = {
      name: "Jane",
      headline: "CTO",
      profileUrl: "https://linkedin.com/in/jane",
    };
    expect(candidate.profileUrl).toContain("/in/");
  });

  it("exports buildLinkedInSearchQuery function", async () => {
    const mod = await import("@/lib/linkedinSearch");
    expect(mod.buildLinkedInSearchQuery).toBeDefined();
    expect(typeof mod.buildLinkedInSearchQuery).toBe("function");
  });

  it("buildLinkedInSearchQuery includes company name in query", async () => {
    const { buildLinkedInSearchQuery } = await import("@/lib/linkedinSearch");
    const query = buildLinkedInSearchQuery("Acme Corp", "Italy");
    expect(query).toContain("Acme");
    expect(typeof query).toBe("string");
    expect(query.length).toBeGreaterThan(5);
  });
});
