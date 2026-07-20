import { describe, it, expect } from "vitest";
import {
  buildCanonicalExtension,
  isMessageIntelligenceV1Enabled,
} from "../../../../../supabase/functions/classify-inbound-message/stages/canonicalFields.ts";

describe("buildCanonicalExtension (B2)", () => {
  it("mappa positive → interested e lascia null i campi non ancora disponibili", () => {
    const ext = buildCanonicalExtension({ classification: "positive" });
    expect(ext).toEqual({
      category: "interested",
      sender_group_id: null,
      folder_hint: null,
      policy_plan: null,
      triage: null,
      canonical_version: 1,
    });
  });

  it("mappa deterministicamente tutte le classificazioni note", () => {
    expect(buildCanonicalExtension({ classification: "negative" }).category).toBe("not_interested");
    expect(buildCanonicalExtension({ classification: "neutral" }).category).toBe("follow_up");
    expect(buildCanonicalExtension({ classification: "needs_human" }).category).toBe("question");
    expect(buildCanonicalExtension({ classification: "spam" }).category).toBe("spam");
  });

  it("non popola sender_group_id/folder_hint/policy_plan/triage nello stage 1", () => {
    const ext = buildCanonicalExtension({ classification: "neutral" });
    expect(ext.sender_group_id).toBeNull();
    expect(ext.folder_hint).toBeNull();
    expect(ext.policy_plan).toBeNull();
    expect(ext.triage).toBeNull();
  });
});

describe("isMessageIntelligenceV1Enabled (feature flag)", () => {
  const envFrom = (v: string | undefined) => ({ get: (_: string) => v });

  it("OFF quando la variabile è assente (default sicuro)", () => {
    expect(isMessageIntelligenceV1Enabled(envFrom(undefined))).toBe(false);
  });

  it("OFF per qualsiasi valore diverso dalla stringa esatta 'true'", () => {
    expect(isMessageIntelligenceV1Enabled(envFrom(""))).toBe(false);
    expect(isMessageIntelligenceV1Enabled(envFrom("false"))).toBe(false);
    expect(isMessageIntelligenceV1Enabled(envFrom("1"))).toBe(false);
    expect(isMessageIntelligenceV1Enabled(envFrom("TRUE"))).toBe(false);
  });

  it("ON solo per la stringa esatta 'true'", () => {
    expect(isMessageIntelligenceV1Enabled(envFrom("true"))).toBe(true);
  });
});
