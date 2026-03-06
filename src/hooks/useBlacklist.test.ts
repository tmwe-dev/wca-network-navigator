import { describe, it, expect } from "vitest";
import type { BlacklistEntry, BlacklistSyncLog } from "./useBlacklist";

/**
 * The useBlacklist module primarily exports React Query hooks that depend
 * on Supabase. We test the exported TypeScript interfaces and any pure
 * logic. The hooks themselves would require a full QueryClient + Supabase
 * mock setup, which is out of scope for unit tests of this module.
 *
 * Here we validate that the type contracts are consistent and test any
 * derivable logic patterns from the module.
 */

describe("BlacklistEntry interface", () => {
  it("can be constructed with all required fields", () => {
    const entry: BlacklistEntry = {
      id: "uuid-1",
      blacklist_no: 42,
      company_name: "Bad Corp",
      city: "Milan",
      country: "Italy",
      status: "active",
      claims: "Non-payment",
      total_owed_amount: 10000,
      matched_partner_id: "partner-uuid",
      source: "manual",
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-02T00:00:00Z",
    };
    expect(entry.company_name).toBe("Bad Corp");
    expect(entry.total_owed_amount).toBe(10000);
  });

  it("allows null for optional fields", () => {
    const entry: BlacklistEntry = {
      id: "uuid-2",
      blacklist_no: null,
      company_name: "Unknown Corp",
      city: null,
      country: null,
      status: null,
      claims: null,
      total_owed_amount: null,
      matched_partner_id: null,
      source: null,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    };
    expect(entry.blacklist_no).toBeNull();
    expect(entry.matched_partner_id).toBeNull();
  });
});

describe("BlacklistSyncLog interface", () => {
  it("can be constructed with all required fields", () => {
    const log: BlacklistSyncLog = {
      id: "log-uuid-1",
      sync_type: "manual_import",
      entries_count: 100,
      matched_count: 25,
      created_at: "2024-01-01T00:00:00Z",
    };
    expect(log.sync_type).toBe("manual_import");
    expect(log.entries_count).toBe(100);
    expect(log.matched_count).toBe(25);
  });
});

describe("Blacklist matching logic patterns", () => {
  // This tests the matching algorithm pattern used in useImportBlacklist
  // without requiring Supabase.

  function matchBlacklistEntry(
    entryName: string,
    entryCountry: string,
    partners: { company_name: string; country_name: string }[]
  ) {
    const en = entryName.toLowerCase().trim();
    const ec = entryCountry.toLowerCase().trim();

    return partners.find((p) => {
      const pn = (p.company_name || "").toLowerCase().trim();
      const pc = (p.country_name || "").toLowerCase().trim();
      const nameMatch = pn === en || pn.includes(en) || en.includes(pn);
      const countryMatch = pc === ec || pc.includes(ec) || ec.includes(pc);
      return nameMatch && countryMatch;
    });
  }

  it("matches exact name and country", () => {
    const partners = [{ company_name: "Bad Corp", country_name: "Italy" }];
    const result = matchBlacklistEntry("Bad Corp", "Italy", partners);
    expect(result).toBeDefined();
    expect(result!.company_name).toBe("Bad Corp");
  });

  it("matches case-insensitively", () => {
    const partners = [{ company_name: "BAD CORP", country_name: "ITALY" }];
    const result = matchBlacklistEntry("bad corp", "italy", partners);
    expect(result).toBeDefined();
  });

  it("matches when entry name is a substring of partner name", () => {
    const partners = [{ company_name: "Bad Corp International", country_name: "Italy" }];
    const result = matchBlacklistEntry("Bad Corp", "Italy", partners);
    expect(result).toBeDefined();
  });

  it("matches when partner name is a substring of entry name", () => {
    const partners = [{ company_name: "Bad", country_name: "Italy" }];
    const result = matchBlacklistEntry("Bad Corp", "Italy", partners);
    expect(result).toBeDefined();
  });

  it("returns undefined when country does not match", () => {
    const partners = [{ company_name: "Bad Corp", country_name: "Germany" }];
    const result = matchBlacklistEntry("Bad Corp", "Italy", partners);
    expect(result).toBeUndefined();
  });

  it("returns undefined when name does not match", () => {
    const partners = [{ company_name: "Good Corp", country_name: "Italy" }];
    const result = matchBlacklistEntry("Bad Corp", "Italy", partners);
    expect(result).toBeUndefined();
  });

  it("handles empty partner list", () => {
    const result = matchBlacklistEntry("Bad Corp", "Italy", []);
    expect(result).toBeUndefined();
  });
});
