import { describe, it, expect } from "vitest";
import {
  formatBytes,
  decodeRfc2047,
  blockRemoteImages,
  extractSenderBrand,
} from "@/components/outreach/email/emailUtils";
import {
  normalizeEmailHtml,
  normalizeEmailText,
  normalizeEmailContent,
  renderEmailTextAsHtml,
} from "@/components/outreach/email/emailContentNormalization";
import { nextStatus, STATUS_CYCLE } from "@/lib/activityConstants";

describe("emailUtils — pure helpers", () => {
  describe("formatBytes", () => {
    it("ritorna stringa vuota su null/0", () => {
      expect(formatBytes(null)).toBe("");
      expect(formatBytes(0)).toBe("");
    });

    it("formatta bytes < 1KB", () => {
      expect(formatBytes(512)).toBe("512 B");
    });

    it("formatta KB con un decimale", () => {
      expect(formatBytes(2048)).toBe("2.0 KB");
      expect(formatBytes(1500)).toBe("1.5 KB");
    });

    it("formatta MB con un decimale", () => {
      expect(formatBytes(2 * 1024 * 1024)).toBe("2.0 MB");
      expect(formatBytes(1.5 * 1024 * 1024)).toBe("1.5 MB");
    });
  });

  describe("decodeRfc2047", () => {
    it("decodifica encoded-word B base64 UTF-8", () => {
      // "Ciao mondo" in base64 utf-8
      const encoded = "=?UTF-8?B?Q2lhbyBtb25kbw==?=";
      expect(decodeRfc2047(encoded)).toBe("Ciao mondo");
    });

    it("decodifica encoded-word Q quoted-printable", () => {
      const encoded = "=?UTF-8?Q?Ciao=20mondo?=";
      expect(decodeRfc2047(encoded)).toBe("Ciao mondo");
    });

    it("decodifica underscore Q come spazio", () => {
      const encoded = "=?UTF-8?Q?Ciao_mondo?=";
      expect(decodeRfc2047(encoded)).toBe("Ciao mondo");
    });

    it("ritorna input invariato se non è encoded-word", () => {
      expect(decodeRfc2047("plain text")).toBe("plain text");
    });

    it("gestisce input vuoto", () => {
      expect(decodeRfc2047("")).toBe("");
    });
  });

  describe("blockRemoteImages", () => {
    it("sostituisce src http(s) con placeholder svg", () => {
      const html = '<img src="https://evil.com/track.gif" alt="x">';
      const result = blockRemoteImages(html);
      expect(result).not.toContain("https://evil.com");
      expect(result).toContain("data:image/svg+xml");
    });

    it("preserva data: URI", () => {
      const html = '<img src="data:image/png;base64,AAA">';
      expect(blockRemoteImages(html)).toBe(html);
    });

    it("non tocca link non-img", () => {
      const html = '<a href="https://x.com">link</a>';
      expect(blockRemoteImages(html)).toBe(html);
    });
  });

  describe("extractSenderBrand", () => {
    it("ritorna Sconosciuto su input vuoto", () => {
      expect(extractSenderBrand("")).toEqual({ brand: "Sconosciuto", detail: "" });
    });

    it("estrae brand da dominio aziendale", () => {
      const r = extractSenderBrand('"Twilio Support" <support@twilio.com>');
      expect(r.brand).toBe("Twilio");
      expect(r.detail).toContain("Twilio Support");
      expect(r.detail).toContain("support@twilio.com");
    });

    it("usa display name per provider personali (gmail)", () => {
      const r = extractSenderBrand('"Mario Rossi" <mario.rossi@gmail.com>');
      expect(r.brand).toBe("Mario Rossi");
      expect(r.detail).toBe("mario.rossi@gmail.com");
    });

    it("ricava brand da local part su provider personale senza display name", () => {
      const r = extractSenderBrand("luca.arcana@gmail.com");
      expect(r.brand).toBe("Luca Arcana");
    });

    it("gestisce dominio multi-livello (.co.uk)", () => {
      const r = extractSenderBrand("info@example.co.uk");
      expect(r.brand).toBe("Example");
    });

    it("capitalizza brand con trattino", () => {
      const r = extractSenderBrand("hello@my-cool-startup.com");
      expect(r.brand).toBe("My Cool Startup");
    });
  });
});

describe("emailContentNormalization", () => {
  describe("normalizeEmailHtml", () => {
    it("ritorna null su input vuoto", () => {
      expect(normalizeEmailHtml(null)).toBeNull();
      expect(normalizeEmailHtml("")).toBeNull();
    });

    it("ritorna null se non contiene tag HTML", () => {
      expect(normalizeEmailHtml("plain text")).toBeNull();
    });

    it("ritorna l'HTML se contiene tag", () => {
      const html = "<p>hello</p>";
      expect(normalizeEmailHtml(html)).toBe(html);
    });

    it("decodifica entità HTML", () => {
      const r = normalizeEmailHtml("<p>Caf&eacute; &amp; tea</p>");
      expect(r).toContain("&");
    });
  });

  describe("normalizeEmailText", () => {
    it("ritorna null su vuoto", () => {
      expect(normalizeEmailText(null)).toBeNull();
      expect(normalizeEmailText("")).toBeNull();
    });

    it("decodifica quoted-printable", () => {
      const r = normalizeEmailText("Ciao=20mondo");
      expect(r).toBe("Ciao mondo");
    });

    it("rimuove soft line breaks =\\n", () => {
      const r = normalizeEmailText("riga1=\nriga2");
      expect(r).toBe("riga1riga2");
    });
  });

  describe("normalizeEmailContent", () => {
    it("genera previewText combinando html/text", () => {
      const r = normalizeEmailContent({ bodyHtml: "<p>Hello world</p>", bodyText: null });
      expect(r.previewText).toContain("Hello");
      expect(r.bodyHtml).toBe("<p>Hello world</p>");
    });

    it("usa text quando html assente", () => {
      const r = normalizeEmailContent({ bodyHtml: null, bodyText: "plain content" });
      expect(r.bodyText).toBe("plain content");
      expect(r.bodyHtml).toBeNull();
      expect(r.previewText).toBe("plain content");
    });

    it("ritorna stringa vuota su entrambi null", () => {
      const r = normalizeEmailContent({ bodyHtml: null, bodyText: null });
      expect(r.bodyText).toBe("");
      expect(r.previewText).toBe("");
    });
  });

  describe("renderEmailTextAsHtml", () => {
    it("avvolge in pre con escape", () => {
      const r = renderEmailTextAsHtml("<script>x</script>");
      expect(r).toContain("&lt;script&gt;");
      expect(r).toContain("<pre");
    });

    it("placeholder su input vuoto", () => {
      expect(renderEmailTextAsHtml(null)).toContain("(nessun contenuto)");
      expect(renderEmailTextAsHtml("")).toContain("(nessun contenuto)");
    });
  });
});

describe("activityConstants — nextStatus", () => {
  it("avanza pending → in_progress", () => {
    expect(nextStatus("pending")).toBe("in_progress");
  });

  it("avanza in_progress → completed", () => {
    expect(nextStatus("in_progress")).toBe("completed");
  });

  it("torna a pending dopo completed", () => {
    expect(nextStatus("completed")).toBe("pending");
  });

  it("status sconosciuto rientra nel ciclo", () => {
    // idx === -1 → STATUS_CYCLE[0] === "pending"
    expect(nextStatus("xxx")).toBe(STATUS_CYCLE[0]);
  });
});
