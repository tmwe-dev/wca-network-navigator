import { describe, it, expect } from "vitest";
import {
  normalizeEmail,
  normalizePhone,
  normalizeCompanyName,
  normalizePersonName,
  normalizeLinkedinUrl,
  emailDomain,
} from "../normalize";
import { scoreIdentity, resolveIdentity, DEFAULT_THRESHOLDS } from "../resolve";
import type { EntityRef } from "../../canonical";

describe("normalize", () => {
  it("canonicalizza le email con plus-tag e case", () => {
    expect(normalizeEmail(" Luca.Arcana+news@Example.COM ")).toBe("luca.arcana@example.com");
    expect(normalizeEmail("non-una-email")).toBe("");
    expect(emailDomain("A@B.com")).toBe("b.com");
  });

  it("normalizza i telefoni e scarta i troppo corti", () => {
    expect(normalizePhone("+39 02 1234 5678")).toBe("390212345678");
    expect(normalizePhone("0039 02 12345678")).toBe("390212345678");
    expect(normalizePhone("123")).toBe("");
  });

  it("rimuove le forme societarie dalla ragione sociale", () => {
    expect(normalizeCompanyName("Rossi Logistics S.r.l.")).toBe("rossi");
    expect(normalizeCompanyName("ACME S.p.A.")).toBe("acme");
    expect(normalizeCompanyName("SRL")).toBe("srl");
  });

  it("rende i nomi persona indipendenti dall'ordine", () => {
    expect(normalizePersonName("Mario Rossi")).toBe(normalizePersonName("Rossi, Mario"));
  });

  it("estrae lo slug LinkedIn", () => {
    expect(normalizeLinkedinUrl("https://www.linkedin.com/in/luca-arcana/?x=1")).toBe("luca-arcana");
    expect(normalizeLinkedinUrl("https://example.com")).toBe("");
  });
});

describe("scoreIdentity", () => {
  it("dà 0 senza segnali comuni", () => {
    expect(scoreIdentity({ email: "a@a.com" }, { email: "b@b.com" }).score).toBe(0);
  });

  it("supera la soglia con email + nome", () => {
    const { score, reason } = scoreIdentity(
      { email: "m.rossi@acme.com", fullName: "Mario Rossi" },
      { email: "M.Rossi@Acme.com", fullName: "Rossi Mario" },
    );
    expect(score).toBeGreaterThanOrEqual(DEFAULT_THRESHOLDS.matchThreshold);
    expect(reason).toContain("email");
  });

  it("resta sotto soglia con solo nome e azienda", () => {
    const { score } = scoreIdentity(
      { fullName: "Mario Rossi", companyName: "ACME Srl" },
      { fullName: "Mario Rossi", companyName: "ACME S.p.A." },
    );
    expect(score).toBeLessThan(DEFAULT_THRESHOLDS.matchThreshold);
  });
});

describe("resolveIdentity", () => {
  const refA = "contact:aaa" as EntityRef;
  const refB = "contact:bbb" as EntityRef;

  it("accetta un match netto", () => {
    const res = resolveIdentity({ email: "m.rossi@acme.com", fullName: "Mario Rossi" }, [
      { ref: refA, email: "m.rossi@acme.com", fullName: "Mario Rossi" },
      { ref: refB, email: "altro@acme.com" },
    ]);
    expect(res.matched?.ref).toBe(refA);
    expect(res.needsReview).toBe(false);
  });

  it("chiede revisione se due candidati sono entrambi sopra soglia", () => {
    const traits = { email: "m.rossi@acme.com", fullName: "Mario Rossi" };
    const res = resolveIdentity(traits, [
      { ref: refA, ...traits },
      { ref: refB, ...traits },
    ]);
    expect(res.matched).toBeUndefined();
    expect(res.needsReview).toBe(true);
  });

  it("segnala revisione nella fascia intermedia", () => {
    const res = resolveIdentity({ fullName: "Mario Rossi", phone: "+39 02 12345678" }, [
      { ref: refA, fullName: "Mario Rossi", phone: "0039 02 12345678" },
    ]);
    expect(res.matched).toBeUndefined();
    expect(res.needsReview).toBe(true);
  });

  it("ignora candidati senza ref e senza segnali", () => {
    const res = resolveIdentity({ email: "x@y.com" }, [{ email: "x@y.com" }, { ref: refB, email: "z@k.com" }]);
    expect(res.candidates).toHaveLength(0);
    expect(res.needsReview).toBe(false);
  });
});
