/**
 * Unit test — dispatch-urgent-alert template builder & quiet hours
 *
 * Riproduce in locale le funzioni pure (`buildTemplate`, `inQuietHours`)
 * dell'edge function per garantirne stabilità nel tempo.
 */
import { assertEquals, assert } from "https://deno.land/std@0.224.0/assert/mod.ts";

function inQuietHours(start: string | null, end: string | null, tz: string | null, now = new Date()): boolean {
  if (!start || !end) return false;
  const fmt = new Intl.DateTimeFormat("en-GB", {
    timeZone: tz || "Europe/Rome",
    hour: "2-digit", minute: "2-digit", hour12: false,
  });
  const hhmm = fmt.format(now);
  if (start <= end) return hhmm >= start && hhmm < end;
  return hhmm >= start || hhmm < end;
}

function buildTemplate(b: {
  subject: string; from_address: string; business_category: string;
  urgency_score: number; summary: string; message_id: string;
}, recipientName: string): string {
  const cat = b.business_category.toUpperCase();
  const subj = (b.subject || "").slice(0, 80);
  const summary = (b.summary || "").slice(0, 240);
  return `🚨 ALERT TMWE [${cat} · urgency ${b.urgency_score}]
Per: ${recipientName}
Da: ${b.from_address}
Oggetto: ${subj}

${summary}

Apri: https://wca-network-navigator.lovable.app/v2/email-intelligence?msg=${b.message_id}`;
}

Deno.test("buildTemplate: contiene tutti i campi chiave", () => {
  const t = buildTemplate({
    subject: "Cargo bloccato Malpensa",
    from_address: "ops@partner.com",
    business_category: "operations",
    urgency_score: 92,
    summary: "Spedizione AWB123 ferma in dogana, serve intervento entro 2 ore.",
    message_id: "abc-123",
  }, "Mario");
  assert(t.includes("ALERT TMWE"));
  assert(t.includes("OPERATIONS"));
  assert(t.includes("urgency 92"));
  assert(t.includes("Per: Mario"));
  assert(t.includes("ops@partner.com"));
  assert(t.includes("Cargo bloccato Malpensa"));
  assert(t.includes("abc-123"));
});

Deno.test("buildTemplate: tronca subject a 80 e summary a 240", () => {
  const longSubj = "x".repeat(200);
  const longSum = "y".repeat(500);
  const t = buildTemplate({
    subject: longSubj, from_address: "a@b.c",
    business_category: "admin", urgency_score: 80,
    summary: longSum, message_id: "m1",
  }, "X");
  assert(t.includes("x".repeat(80)));
  assert(!t.includes("x".repeat(81)));
  assert(t.includes("y".repeat(240)));
  assert(!t.includes("y".repeat(241)));
});

Deno.test("inQuietHours: finestra normale 22-08 cross-midnight", () => {
  // 23:30 Rome → dentro
  const inside = new Date("2026-05-05T21:30:00Z"); // 23:30 CEST
  assertEquals(inQuietHours("22:00", "08:00", "Europe/Rome", inside), true);
  // 12:00 Rome → fuori
  const outside = new Date("2026-05-05T10:00:00Z"); // 12:00 CEST
  assertEquals(inQuietHours("22:00", "08:00", "Europe/Rome", outside), false);
});

Deno.test("inQuietHours: nessuna config → mai quiet", () => {
  assertEquals(inQuietHours(null, null, "Europe/Rome"), false);
  assertEquals(inQuietHours("22:00", null, "Europe/Rome"), false);
});

Deno.test("inQuietHours: finestra diurna 13-14", () => {
  const inside = new Date("2026-05-05T11:30:00Z"); // 13:30 CEST
  const outside = new Date("2026-05-05T13:00:00Z"); // 15:00 CEST
  assertEquals(inQuietHours("13:00", "14:00", "Europe/Rome", inside), true);
  assertEquals(inQuietHours("13:00", "14:00", "Europe/Rome", outside), false);
});