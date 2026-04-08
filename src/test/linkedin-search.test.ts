import { describe, it, expect } from "vitest";
import {
  getEmailDomain,
  unwrapGoogleResultUrl,
  isLinkedInProfileUrl,
  normalizeLinkedInProfileUrl,
  cleanGoogleLinkedInTitle,
  extractLinkedInCandidateFromGoogleResult,
  scoreLinkedInCandidate,
  pickBestLinkedInCandidate,
  buildLinkedInGoogleQueries,
} from "@/lib/linkedinSearch";

describe("linkedinSearch", () => {
  describe("getEmailDomain", () => {
    it("ritorna dominio aziendale", () => {
      expect(getEmailDomain("luca@cowork.it")).toBe("cowork.it");
      expect(getEmailDomain("info@globex.de")).toBe("globex.de");
    });

    it("ritorna null su provider personali", () => {
      expect(getEmailDomain("x@gmail.com")).toBeNull();
      expect(getEmailDomain("y@libero.it")).toBeNull();
      expect(getEmailDomain("z@pec.it")).toBeNull();
    });

    it("ritorna null su input vuoto/malformato", () => {
      expect(getEmailDomain(null)).toBeNull();
      expect(getEmailDomain("")).toBeNull();
      expect(getEmailDomain("not-an-email")).toBeNull();
    });

    it("è case-insensitive sul dominio", () => {
      expect(getEmailDomain("X@COWORK.IT")).toBe("cowork.it");
    });
  });

  describe("unwrapGoogleResultUrl", () => {
    it("estrae l'URL dal redirect google /url", () => {
      const r = unwrapGoogleResultUrl(
        "https://www.google.com/url?q=https://linkedin.com/in/luca&sa=t"
      );
      expect(r).toBe("https://linkedin.com/in/luca");
    });

    it("ritorna URL invariato se non è google", () => {
      const r = unwrapGoogleResultUrl("https://linkedin.com/in/x");
      expect(r).toBe("https://linkedin.com/in/x");
    });

    it("ritorna null su input vuoto", () => {
      expect(unwrapGoogleResultUrl(null)).toBeNull();
      expect(unwrapGoogleResultUrl("")).toBeNull();
    });

    it("ritorna URL originale se malformato", () => {
      expect(unwrapGoogleResultUrl("not-a-url")).toBe("not-a-url");
    });
  });

  describe("isLinkedInProfileUrl", () => {
    it("true su /in/ e /pub/ linkedin", () => {
      expect(isLinkedInProfileUrl("https://www.linkedin.com/in/luca")).toBe(true);
      expect(isLinkedInProfileUrl("https://it.linkedin.com/in/mario")).toBe(true);
      expect(isLinkedInProfileUrl("https://linkedin.com/pub/old-profile")).toBe(true);
    });

    it("false su /company/ o altre sezioni", () => {
      expect(isLinkedInProfileUrl("https://linkedin.com/company/acme")).toBe(false);
      expect(isLinkedInProfileUrl("https://linkedin.com/jobs/x")).toBe(false);
    });

    it("false su altri domini", () => {
      expect(isLinkedInProfileUrl("https://twitter.com/in/x")).toBe(false);
    });

    it("estrae da redirect google", () => {
      expect(
        isLinkedInProfileUrl("https://www.google.com/url?q=https://linkedin.com/in/x")
      ).toBe(true);
    });
  });

  describe("normalizeLinkedInProfileUrl", () => {
    it("rimuove trailing slash e query string", () => {
      const r = normalizeLinkedInProfileUrl("https://www.linkedin.com/in/luca/?source=x");
      expect(r).toBe("https://www.linkedin.com/in/luca");
    });

    it("ritorna null se non è profile URL", () => {
      expect(normalizeLinkedInProfileUrl("https://linkedin.com/company/x")).toBeNull();
    });

    it("normalizza URL da redirect google", () => {
      const r = normalizeLinkedInProfileUrl(
        "https://www.google.com/url?q=https://www.linkedin.com/in/luca/"
      );
      expect(r).toBe("https://www.linkedin.com/in/luca");
    });
  });

  describe("cleanGoogleLinkedInTitle", () => {
    it("rimuove suffisso ' | LinkedIn'", () => {
      expect(cleanGoogleLinkedInTitle("Mario Rossi | LinkedIn")).toBe("Mario Rossi");
    });

    it("rimuove suffisso ' - LinkedIn'", () => {
      expect(cleanGoogleLinkedInTitle("Mario Rossi - LinkedIn · Italy")).toBe("Mario Rossi");
    });

    it("input null/empty → ''", () => {
      expect(cleanGoogleLinkedInTitle(null)).toBe("");
      expect(cleanGoogleLinkedInTitle("")).toBe("");
    });
  });

  describe("extractLinkedInCandidateFromGoogleResult", () => {
    it("estrae candidate da risultato google valido", () => {
      const r = extractLinkedInCandidateFromGoogleResult({
        url: "https://www.linkedin.com/in/mario-rossi",
        title: "Mario Rossi - CEO at Acme | LinkedIn",
        description: "10+ anni nel settore logistica",
      });
      expect(r).not.toBeNull();
      expect(r?.profileUrl).toBe("https://www.linkedin.com/in/mario-rossi");
      expect(r?.name).toBe("Mario Rossi");
      expect(r?.headline).toContain("logistica");
    });

    it("ritorna null se URL non è linkedin profile", () => {
      const r = extractLinkedInCandidateFromGoogleResult({
        url: "https://linkedin.com/company/acme",
        title: "Acme",
      });
      expect(r).toBeNull();
    });

    it("usa snippet come fallback per description", () => {
      const r = extractLinkedInCandidateFromGoogleResult({
        url: "https://linkedin.com/in/x",
        title: "Luca Verdi | LinkedIn",
        snippet: "Esperienza nel settore IT",
      });
      expect(r?.headline).toContain("IT");
    });
  });

  describe("scoreLinkedInCandidate", () => {
    it("score più alto su match esatto nome+azienda+ruolo", () => {
      const r = scoreLinkedInCandidate(
        {
          name: "Mario Rossi",
          headline: "CEO at Acme Logistics — Milano",
          profileUrl: "https://linkedin.com/in/mario",
        },
        { name: "Mario Rossi", company: "Acme Logistics", role: "CEO" }
      );
      expect(r).toBeGreaterThan(0.9);
    });

    it("score base 0.3 su URL valido senza match", () => {
      const r = scoreLinkedInCandidate(
        { name: "Pippo", headline: "x", profileUrl: "https://linkedin.com/in/x" },
        { name: "Mario Rossi", company: "Acme" }
      );
      expect(r).toBeCloseTo(0.3, 5);
    });

    it("score 0 senza profileUrl", () => {
      expect(
        scoreLinkedInCandidate({ name: "Mario Rossi", profileUrl: null }, { name: "Mario Rossi" })
      ).toBe(0);
    });

    it("score capped a 1", () => {
      const r = scoreLinkedInCandidate(
        {
          name: "Mario Rossi",
          headline: "ceo at acme logistics, mario rossi acme acme acme",
          profileUrl: "https://linkedin.com/in/x",
        },
        { name: "Mario Rossi", company: "Acme Logistics", role: "ceo" }
      );
      expect(r).toBeLessThanOrEqual(1);
    });
  });

  describe("pickBestLinkedInCandidate", () => {
    it("seleziona il candidato con score più alto", () => {
      const items = [
        {
          url: "https://linkedin.com/in/wrong",
          title: "Pippo Pluto | LinkedIn",
          description: "Other person",
        },
        {
          url: "https://linkedin.com/in/right",
          title: "Mario Rossi - CEO at Acme | LinkedIn",
          description: "Acme Logistics",
        },
      ];
      const r = pickBestLinkedInCandidate(items, { name: "Mario Rossi", company: "Acme" });
      expect(r.candidate?.profileUrl).toBe("https://linkedin.com/in/right");
      expect(r.confidence).toBeGreaterThan(0.5);
      expect(r.candidates).toHaveLength(2);
    });

    it("ritorna candidate=null se nessun match LinkedIn", () => {
      const r = pickBestLinkedInCandidate(
        [{ url: "https://x.com/y", title: "x" }],
        { name: "Mario Rossi" }
      );
      expect(r.candidate).toBeNull();
      expect(r.confidence).toBe(0);
      expect(r.candidates).toEqual([]);
    });
  });

  describe("buildLinkedInGoogleQueries", () => {
    it("genera query progressivamente più larghe", () => {
      const queries = buildLinkedInGoogleQueries("Mario Rossi", "Acme", "mario@acme.it", "CEO");
      expect(queries.length).toBeGreaterThanOrEqual(3);
      expect(queries[0]).toContain('"Acme"');
      expect(queries[queries.length - 1]).toBe('site:linkedin.com/in "Mario Rossi"');
    });

    it("salta company se '—'", () => {
      const queries = buildLinkedInGoogleQueries("Luca", "—");
      expect(queries.every((q) => !q.includes("—"))).toBe(true);
    });

    it("dedup query identiche", () => {
      const queries = buildLinkedInGoogleQueries("Mario Rossi");
      expect(new Set(queries).size).toBe(queries.length);
    });

    it("salta dominio email su provider personali", () => {
      const queries = buildLinkedInGoogleQueries("Mario", "Acme", "mario@gmail.com");
      expect(queries.every((q) => !q.includes("gmail.com"))).toBe(true);
    });
  });
});
