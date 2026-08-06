import { describe, it, expect } from "vitest";
import { parseProposals } from "@/data/promptLabGlobalRuns";
import { parseConversationMessages } from "@/data/aiConversations";
import { parseTimingSteps } from "@/data/outreachTimingTemplates";
import { parseSherlockSteps, parseSherlockStepResults } from "@/data/sherlockPlaybooks";

describe("parser runtime colonne Json", () => {
  it("parseProposals accetta righe valide e scarta le altre", () => {
    const out = parseProposals([
      { block_id: "b1", label: "L", before: "x", status: "saved", source: { kind: "kb_entry" } },
      { block_id: "b2", label: "L2", before: "y", status: "bogus" },
      { label: "no id", before: "z" },
      null,
      "stringa",
    ]);
    expect(out).toHaveLength(2);
    expect(out[0].status).toBe("saved");
    expect(out[1].status).toBe("pending");
    expect(out[0].source).toEqual({ kind: "kb_entry" });
  });

  it("parseProposals gestisce stringhe JSON e input corrotti", () => {
    expect(parseProposals('[{"block_id":"a","label":"l","before":"b"}]')).toHaveLength(1);
    expect(parseProposals("{ non json")).toEqual([]);
    expect(parseProposals(null)).toEqual([]);
    expect(parseProposals({ a: 1 })).toEqual([]);
  });

  it("parseConversationMessages filtra ruoli e contenuti non validi", () => {
    const out = parseConversationMessages([
      { role: "user", content: "ciao", timestamp: "2026-01-01" },
      { role: "assistant", content: "ok" },
      { role: "system", content: "no" },
      { role: "user", content: 42 },
    ]);
    expect(out).toEqual([
      { role: "user", content: "ciao", timestamp: "2026-01-01" },
      { role: "assistant", content: "ok", timestamp: undefined },
    ]);
    expect(parseConversationMessages(null)).toEqual([]);
  });

  it("parseTimingSteps normalizza i campi mancanti", () => {
    const out = parseTimingSteps([{ step: 1, channel: "email" }, { channel: "email" }]);
    expect(out).toEqual([{ step: 1, channel: "email", delay_days: 0, trigger: "", tone: "", template_hint: "" }]);
  });

  it("parseSherlockSteps richiede order/label/url_template", () => {
    const out = parseSherlockSteps([
      { order: 1, label: "a", url_template: "https://x", required_vars: ["v", 3] },
      { order: 2, label: "b" },
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].required_vars).toEqual(["v"]);
    expect(out[0].ai_extract_prompt).toBe("");
  });

  it("parseSherlockStepResults applica default sicuri", () => {
    const out = parseSherlockStepResults([{ order: 1, label: "s" }, {}]);
    expect(out).toHaveLength(1);
    expect(out[0].findings).toEqual({});
    expect(out[0].confidence).toBeNull();
    expect(out[0].started_at).toBe(0);
  });
});
