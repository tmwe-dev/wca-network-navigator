import { describe, it, expect } from "vitest";
import {
  CheckInboxResultSchema,
  CheckInboxMessageSchema,
  safeParseCheckInboxResult,
} from "@/lib/api/checkInbox.schemas";

describe("checkInbox.schemas", () => {
  describe("CheckInboxMessageSchema", () => {
    it("parsa messaggio minimo (tutti campi opzionali)", () => {
      expect(CheckInboxMessageSchema.parse({})).toEqual({});
    });

    it("parsa messaggio completo", () => {
      const m = {
        id: "abc",
        subject: "ciao",
        from_address: "x@y.it",
        from: "X <x@y.it>",
        email_date: "2026-01-01",
        date: "2026-01-01",
        body_html: "<p>x</p>",
        body_text: "x",
      };
      expect(CheckInboxMessageSchema.parse(m)).toEqual(m);
    });

    it("accetta body null", () => {
      const m = { body_html: null, body_text: null };
      expect(CheckInboxMessageSchema.parse(m)).toEqual(m);
    });

    it("passa campi extra (passthrough)", () => {
      const r = CheckInboxMessageSchema.parse({ id: "x", extra: "field" });
      expect((r as Record<string, unknown>).extra).toBe("field");
    });
  });

  describe("CheckInboxResultSchema", () => {
    it("richiede solo total", () => {
      expect(CheckInboxResultSchema.parse({ total: 0 })).toEqual({ total: 0 });
    });

    it("parsa risultato completo con messaggi", () => {
      const r = {
        total: 2,
        has_more: true,
        remaining: 5,
        messages: [{ id: "1" }, { id: "2", subject: "x" }],
      };
      const parsed = CheckInboxResultSchema.parse(r);
      expect(parsed.total).toBe(2);
      expect(parsed.messages).toHaveLength(2);
    });

    it("rifiuta total non numerico", () => {
      expect(() => CheckInboxResultSchema.parse({ total: "two" })).toThrow();
    });

    it("rifiuta total mancante", () => {
      expect(() => CheckInboxResultSchema.parse({})).toThrow();
    });

    it("ignora type-mismatch dentro un messaggio (campo opzionale)", () => {
      // body_html accetta string|null|undefined; un numero deve fallire
      expect(() => CheckInboxResultSchema.parse({ total: 1, messages: [{ body_html: 42 }] })).toThrow();
    });
  });

  describe("safeParseCheckInboxResult", () => {
    it("ritorna l'oggetto su shape valida", () => {
      const r = safeParseCheckInboxResult({ total: 3, has_more: false, messages: [] });
      expect(r?.total).toBe(3);
    });

    it("ritorna null e logga warn su shape invalida (mai throw)", () => {
      expect(safeParseCheckInboxResult({})).toBeNull();
      expect(safeParseCheckInboxResult(null)).toBeNull();
      expect(safeParseCheckInboxResult("string")).toBeNull();
      expect(safeParseCheckInboxResult(42)).toBeNull();
    });

    it("non lancia mai (strangler best-effort)", () => {
      expect(() => safeParseCheckInboxResult(undefined)).not.toThrow();
      expect(() => safeParseCheckInboxResult({ total: "x" })).not.toThrow();
    });
  });
});
