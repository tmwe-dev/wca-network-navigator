import { describe, it, expect } from "vitest";
import { listScopes } from "@/v2/services/bulkOps";
import { getEntry } from "@/v2/services/bulkOps/registry";

describe("bulkOps — registry", () => {
  it("registra esattamente i 14 scope previsti", () => {
    const scopes = listScopes();
    expect(scopes.length).toBe(14);
    const expected = [
      "enrich.base", "deepsearch.sherlock", "download.partner", "enrich.inbound",
      "verify.wa", "verify.li", "verify.email", "verify.dedup",
      "update.origin", "update.leadStatus", "update.emailRules",
      "update.backfill", "update.analyzeAi", "update.dispatch",
    ];
    expected.forEach((s) => expect(scopes).toContain(s));
  });

  it("ogni scope ha handler unico e itemId definito", () => {
    listScopes().forEach((s) => {
      const e = getEntry(s);
      expect(typeof e.handler).toBe("function");
      expect(typeof e.itemId).toBe("function");
      expect(e.scope).toBe(s);
    });
  });

  it("scope sconosciuto lancia errore", () => {
    expect(() => getEntry("unknown.scope" as never)).toThrow(/Scope sconosciuto/);
  });
});