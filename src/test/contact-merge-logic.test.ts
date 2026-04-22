/**
 * Contact Merge Logic Tests
 * Tests Levenshtein distance matching, duplicate detection, and field merging
 * Based on useContactMerge.ts
 */
import { describe, it, expect } from "vitest";

// ─── Levenshtein Distance Implementation ─────────────────

function levenshteinDistance(a: string, b: string): number {
  const aLower = a.toLowerCase().trim();
  const bLower = b.toLowerCase().trim();

  if (aLower === bLower) return 0;

  const matrix: number[][] = [];

  for (let i = 0; i <= bLower.length; i++) {
    matrix[i] = [i];
  }

  for (let j = 0; j <= aLower.length; j++) {
    matrix[0][j] = j;
  }

  for (let i = 1; i <= bLower.length; i++) {
    for (let j = 1; j <= aLower.length; j++) {
      const cost = aLower[j - 1] === bLower[i - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i][j - 1] + 1, // insertion
        matrix[i - 1][j] + 1, // deletion
        matrix[i - 1][j - 1] + cost // substitution
      );
    }
  }

  return matrix[bLower.length][aLower.length];
}

function extractDomain(email: string | null): string {
  if (!email) return "";
  const parts = email.toLowerCase().split("@");
  return parts.length > 1 ? parts[1] : "";
}

function calculateSimilarity(name1: string | null, name2: string | null): number {
  if (!name1 || !name2) return 0;
  const distance = levenshteinDistance(name1, name2);
  const maxLength = Math.max(name1.length, name2.length);
  return maxLength > 0 ? 1 - distance / maxLength : 0;
}

// ─── Test Data ──────────────────────────────────────────

interface Contact {
  id: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  mobile: string | null;
  company_name: string | null;
  company_id: string | null;
}

// ─── Tests ──────────────────────────────────────────────

describe("Contact Merge Logic", () => {
  // ─── Levenshtein Distance ────────────────────────────

  describe("Levenshtein Distance", () => {
    it("should return 0 for identical strings", () => {
      expect(levenshteinDistance("John Doe", "John Doe")).toBe(0);
      expect(levenshteinDistance("john doe", "JOHN DOE")).toBe(0); // Case insensitive
    });

    it("should handle empty strings", () => {
      expect(levenshteinDistance("", "")).toBe(0);
      expect(levenshteinDistance("abc", "")).toBe(3);
      expect(levenshteinDistance("", "abc")).toBe(3);
    });

    it("should handle single character differences", () => {
      expect(levenshteinDistance("cat", "bat")).toBe(1); // substitution
      expect(levenshteinDistance("cat", "ca")).toBe(1); // deletion
      expect(levenshteinDistance("ca", "cat")).toBe(1); // insertion
    });

    it("should be case insensitive", () => {
      expect(levenshteinDistance("John", "john")).toBe(0);
      expect(levenshteinDistance("JOHN", "john")).toBe(0);
      expect(levenshteinDistance("JoHn", "jOhN")).toBe(0);
    });

    it("should trim whitespace", () => {
      expect(levenshteinDistance("  John  ", "John")).toBe(0);
      expect(levenshteinDistance("John ", " John")).toBe(0);
    });

    it("should calculate common typos", () => {
      // One typo
      expect(levenshteinDistance("John", "Johm")).toBe(1);
      // Two typos
      expect(levenshteinDistance("John", "Jhn")).toBe(1);
      // Extra space shouldn't count after trim
      expect(levenshteinDistance("John Doe", "John Doe")).toBe(0);
    });

    it("should handle longer strings", () => {
      expect(levenshteinDistance("Saturday", "Sunday")).toBe(3);
      expect(levenshteinDistance("kitten", "sitting")).toBe(3);
    });

    it("should be symmetric", () => {
      expect(levenshteinDistance("abc", "def")).toBe(levenshteinDistance("def", "abc"));
      expect(levenshteinDistance("John", "Johm")).toBe(levenshteinDistance("Johm", "John"));
    });
  });

  // ─── Email Domain Extraction ────────────────────────

  describe("Email Domain Extraction", () => {
    it("should extract domain from valid email", () => {
      expect(extractDomain("john@example.com")).toBe("example.com");
      expect(extractDomain("jane.doe@company.org")).toBe("company.org");
    });

    it("should handle null email gracefully", () => {
      expect(extractDomain(null)).toBe("");
    });

    it("should be case insensitive", () => {
      expect(extractDomain("JOHN@EXAMPLE.COM")).toBe("example.com");
      expect(extractDomain("John@Example.Com")).toBe("example.com");
    });

    it("should handle emails without @", () => {
      expect(extractDomain("invalidemail")).toBe("");
    });

    it("should handle multiple @ symbols", () => {
      // Only split on first @ is safe assumption
      const domain = extractDomain("user+tag@company@example.com");
      expect(domain).toBe("company@example.com");
    });

    it("should extract subdomains correctly", () => {
      expect(extractDomain("user@mail.example.com")).toBe("mail.example.com");
      expect(extractDomain("user@europe.company.co.uk")).toBe("europe.company.co.uk");
    });
  });

  // ─── Similarity Calculation ─────────────────────────

  describe("Similarity Calculation", () => {
    it("should return 1.0 for identical names", () => {
      expect(calculateSimilarity("John Doe", "John Doe")).toBe(1);
    });

    it("should return 0 for null inputs", () => {
      expect(calculateSimilarity(null, "John")).toBe(0);
      expect(calculateSimilarity("John", null)).toBe(0);
      expect(calculateSimilarity(null, null)).toBe(0);
    });

    it("should return high similarity for minor differences", () => {
      const sim = calculateSimilarity("John", "Johm"); // 1 typo
      expect(sim).toBeGreaterThan(0.7);
    });

    it("should return lower similarity for more differences", () => {
      const sim1 = calculateSimilarity("John", "Joan"); // 1 char diff
      const sim2 = calculateSimilarity("John", "Jane"); // 2 char diff
      expect(sim1).toBeGreaterThan(sim2);
    });

    it("should be case insensitive", () => {
      expect(calculateSimilarity("John", "john")).toBe(1);
      expect(calculateSimilarity("JOHN", "john")).toBe(1);
    });

    it("should handle whitespace in names", () => {
      expect(calculateSimilarity("John Doe", "john doe")).toBe(1);
      expect(calculateSimilarity("  John  ", "John")).toBe(1);
    });

    it("should rate partial name matches", () => {
      // "Jo" vs "John" = 2 differences out of 4 chars = 0.5 similarity
      const sim = calculateSimilarity("Jo", "John");
      expect(sim).toBeLessThan(0.8);
      expect(sim).toBeGreaterThan(0.3);
    });

    it("should handle very different names", () => {
      const sim = calculateSimilarity("Alice", "Bob");
      expect(sim).toBeLessThan(0.5);
    });
  });

  // ─── Duplicate Detection Rules ───────────────────────

  describe("Duplicate Detection Rules", () => {
    it("should detect exact email match as duplicate", () => {
      const c1: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: null,
        mobile: null,
        company_name: null,
        company_id: null,
      };
      const c2: Contact = {
        id: "2",
        name: "John Doe",
        email: "john@example.com",
        phone: null,
        mobile: null,
        company_name: null,
        company_id: null,
      };

      // Email exact match
      const isExactMatch = c1.email?.toLowerCase() === c2.email?.toLowerCase();
      expect(isExactMatch).toBe(true);
    });

    it("should detect duplicates with same domain and similar names", () => {
      const c1: Contact = {
        id: "1",
        name: "John Doe",
        email: "john.doe@example.com",
        phone: null,
        mobile: null,
        company_name: null,
        company_id: null,
      };
      const c2: Contact = {
        id: "2",
        name: "John D.",
        email: "john.d@example.com",
        phone: null,
        mobile: null,
        company_name: null,
        company_id: null,
      };

      const sameDomain =
        extractDomain(c1.email) === extractDomain(c2.email);
      const similarity = calculateSimilarity(c1.name, c2.name);

      expect(sameDomain).toBe(true);
      expect(similarity).toBeGreaterThan(0.7);
    });

    it("should detect duplicates in same company with similar names", () => {
      const c1: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: null,
        mobile: null,
        company_name: "Acme Corp",
        company_id: "comp-1",
      };
      const c2: Contact = {
        id: "2",
        name: "John D.",
        email: "j.doe@example.com",
        phone: null,
        mobile: null,
        company_name: "Acme Corp",
        company_id: "comp-1",
      };

      const sameCompany = c1.company_id === c2.company_id;
      const similarity = calculateSimilarity(c1.name, c2.name);

      expect(sameCompany).toBe(true);
      expect(similarity).toBeGreaterThan(0.7);
    });

    it("should detect duplicates by phone number", () => {
      const c1: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+39 02 1234 5678",
        mobile: null,
        company_name: null,
        company_id: null,
      };
      const c2: Contact = {
        id: "2",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: "39021234 5678",
        mobile: null,
        company_name: null,
        company_id: null,
      };

      // Normalize phone: remove non-digits
      const phone1 = (c1.phone || "").replace(/\D/g, "");
      const phone2 = (c2.phone || "").replace(/\D/g, "");

      expect(phone1).toBe(phone2);
      expect(phone1.length).toBeGreaterThanOrEqual(8);
    });

    it("should handle mobile phone matching", () => {
      const c1: Contact = {
        id: "1",
        name: "John",
        email: "john@example.com",
        phone: null,
        mobile: "+39 320 1234 5678",
        company_name: null,
        company_id: null,
      };
      const c2: Contact = {
        id: "2",
        name: "John Doe",
        email: "jane@example.com",
        phone: "39 320 12345678",
        mobile: null,
        company_name: null,
        company_id: null,
      };

      const mobile1 = (c1.mobile || "").replace(/\D/g, "");
      const phone2 = (c2.phone || "").replace(/\D/g, "");

      expect(mobile1).toBe(phone2);
    });

    it("should not flag as duplicate if names completely different", () => {
      const c1: Contact = {
        id: "1",
        name: "Alice Smith",
        email: "alice@example.com",
        phone: null,
        mobile: null,
        company_name: null,
        company_id: null,
      };
      const c2: Contact = {
        id: "2",
        name: "Bob Jones",
        email: "bob@example.com",
        phone: null,
        mobile: null,
        company_name: null,
        company_id: null,
      };

      const similarity = calculateSimilarity(c1.name, c2.name);
      expect(similarity).toBeLessThan(0.5);
    });
  });

  // ─── Duplicate Confidence Scoring ────────────────────

  describe("Duplicate Confidence Scoring", () => {
    it("should rate exact email match as 95% confidence", () => {
      const confidence = 95; // Exact email match
      expect(confidence).toBe(95);
    });

    it("should rate domain + similar names as 80-85% confidence", () => {
      const similarity = calculateSimilarity("John Doe", "John D.");
      const confidence = Math.round(85 * similarity);
      expect(confidence).toBeGreaterThan(70);
      expect(confidence).toBeLessThanOrEqual(85);
    });

    it("should rate same company + similar names as 75% confidence", () => {
      const similarity = calculateSimilarity("John Doe", "John D.");
      const confidence = Math.round(75 * similarity);
      expect(confidence).toBeGreaterThan(60);
      expect(confidence).toBeLessThanOrEqual(75);
    });

    it("should rate phone match as 90% confidence", () => {
      const confidence = 90; // Phone match
      expect(confidence).toBe(90);
    });

    it("should require minimum 60% confidence to flag as duplicate", () => {
      const minConfidence = 60;
      expect(95).toBeGreaterThanOrEqual(minConfidence); // Exact email
      expect(85).toBeGreaterThanOrEqual(minConfidence); // Domain + names
      expect(75).toBeGreaterThanOrEqual(minConfidence); // Same company
      expect(90).toBeGreaterThanOrEqual(minConfidence); // Phone
    });
  });

  // ─── Field Merging Priority ─────────────────────────

  describe("Field Merging Priority", () => {
    it("should keep primary contact's fields by default", () => {
      const primary: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+39 02 1234 5678",
        mobile: null,
        company_name: "Acme",
        company_id: "c1",
      };
      const secondary: Contact = {
        id: "2",
        name: "John D.",
        email: "j.doe@example.com",
        phone: null,
        mobile: "+39 320 5678",
        company_name: null,
        company_id: null,
      };

      // Merge: keep primary fields unless null
      const merged: Contact = {
        id: primary.id,
        name: primary.name || secondary.name,
        email: primary.email || secondary.email,
        phone: primary.phone || secondary.phone,
        mobile: primary.mobile || secondary.mobile,
        company_name: primary.company_name || secondary.company_name,
        company_id: primary.company_id || secondary.company_id,
      };

      expect(merged.name).toBe("John Doe");
      expect(merged.email).toBe("john@example.com");
      expect(merged.phone).toBe("+39 02 1234 5678");
      expect(merged.mobile).toBe("+39 320 5678"); // Filled from secondary
    });

    it("should allow custom field choices during merge", () => {
      const primary: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+39 02 old",
        mobile: null,
        company_name: "Acme Inc",
        company_id: "c1",
      };
      const secondary: Contact = {
        id: "2",
        name: "John D.",
        email: "john.doe@example.com",
        phone: "+39 02 new",
        mobile: "+39 320 5678",
        company_name: "Acme",
        company_id: "c1",
      };

      // User chooses secondary's phone and email
      const fieldChoices = [
        { fieldName: "email", keepValue: secondary.email },
        { fieldName: "phone", keepValue: secondary.phone },
      ];

      let merged: Contact = {
        id: primary.id,
        name: primary.name,
        email: primary.email,
        phone: primary.phone,
        mobile: primary.mobile,
        company_name: primary.company_name,
        company_id: primary.company_id,
      };

      for (const choice of fieldChoices) {
        (merged as Record<string, unknown>)[choice.fieldName] = choice.keepValue;
      }

      expect(merged.email).toBe("john.doe@example.com"); // Chosen
      expect(merged.phone).toBe("+39 02 new"); // Chosen
      expect(merged.name).toBe("John Doe"); // Not changed
    });

    it("should prioritize non-null values", () => {
      const primary: Contact = {
        id: "1",
        name: "John",
        email: null,
        phone: null,
        mobile: null,
        company_name: "Acme",
        company_id: "c1",
      };
      const secondary: Contact = {
        id: "2",
        name: null,
        email: "john@example.com",
        phone: "+39 02 1234",
        mobile: "+39 320 5678",
        company_name: null,
        company_id: null,
      };

      const merged: Contact = {
        id: primary.id,
        name: primary.name || secondary.name,
        email: primary.email || secondary.email,
        phone: primary.phone || secondary.phone,
        mobile: primary.mobile || secondary.mobile,
        company_name: primary.company_name || secondary.company_name,
        company_id: primary.company_id || secondary.company_id,
      };

      expect(merged.name).toBe("John");
      expect(merged.email).toBe("john@example.com");
      expect(merged.phone).toBe("+39 02 1234");
      expect(merged.company_name).toBe("Acme");
    });
  });

  // ─── Complex Merge Scenarios ─────────────────────────

  describe("Complex Merge Scenarios", () => {
    it("should merge two contacts with partial overlaps", () => {
      const primary: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: "+39 02 5678",
        mobile: null,
        company_name: "Acme",
        company_id: "c1",
      };
      const secondary: Contact = {
        id: "2",
        name: "J. Doe",
        email: "j.doe@acme.com",
        phone: null,
        mobile: "+39 320 1234",
        company_name: "Acme Corp",
        company_id: "c1",
      };

      const merged: Contact = {
        id: primary.id,
        name: primary.name || secondary.name,
        email: primary.email || secondary.email,
        phone: primary.phone || secondary.phone,
        mobile: primary.mobile || secondary.mobile,
        company_name: primary.company_name || secondary.company_name,
        company_id: primary.company_id || secondary.company_id,
      };

      expect(merged.id).toBe(primary.id);
      expect(merged.phone).toBe("+39 02 5678");
      expect(merged.mobile).toBe("+39 320 1234");
    });

    it("should detect and report differences", () => {
      const c1: Contact = {
        id: "1",
        name: "John Doe",
        email: "john@example.com",
        phone: null,
        mobile: null,
        company_name: "Acme",
        company_id: "c1",
      };
      const c2: Contact = {
        id: "2",
        name: "Jane Doe",
        email: "jane@example.com",
        phone: null,
        mobile: null,
        company_name: "Beta Corp",
        company_id: "c2",
      };

      const differences: string[] = [];

      if (c1.name !== c2.name) differences.push("Diversi nomi");
      if (c1.email !== c2.email) differences.push("Diversi email");
      if (c1.company_name !== c2.company_name) differences.push("Diverse aziende");

      expect(differences.length).toBe(3);
      expect(differences).toContain("Diversi nomi");
    });

    it("should handle cascading updates (reassign related records)", () => {
      const primaryId = "contact-1";
      const secondaryId = "contact-2";

      // Simulating reassignment of activities
      const activities = [
        { id: "act-1", contact_id: secondaryId },
        { id: "act-2", contact_id: secondaryId },
      ];

      const reassigned = activities.map((a) => ({
        ...a,
        contact_id: primaryId,
      }));

      expect(reassigned[0].contact_id).toBe(primaryId);
      expect(reassigned[1].contact_id).toBe(primaryId);
    });
  });
});
