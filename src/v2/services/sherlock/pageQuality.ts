/**
 * pageQuality — rileva pagine inutilizzabili (404, captcha, vuote)
 * PRIMA di mostrarle all'utente o passarle all'AI.
 *
 * Restituisce { usable, reason } così la UI può mostrare un badge "Non disponibile"
 * invece di un dump di markdown 404 con immagini di skater.
 */

const NOT_FOUND_PATTERNS: RegExp[] = [
  /\bthis page does not exist\b/i,
  /\bpage not found\b/i,
  /\b404\b.{0,20}(not found|page|error)/i,
  /\boops,? looks like the page is lost\b/i,
  /\boops,? this page is missing\b/i,
  /\bsorry,? we can'?t find that page\b/i,
  /\bla pagina (cercata )?non esiste\b/i,
  /\bpagina non trovata\b/i,
  /\bcontenuto non disponibile\b/i,
];

const CAPTCHA_PATTERNS: RegExp[] = [
  /unusual traffic from your computer/i,
  /traffico insolito proveniente dalla rete/i,
  /our systems have detected unusual traffic/i,
  /i nostri sistemi hanno rilevato un traffico/i,
  /please complete the security check/i,
  /verifica se sei davvero tu/i,
  /verify you are human/i,
  /\bcaptcha\b/i,
  /\/sorry\/index/i,
  /access to this page has been denied/i,
];

const PAYWALL_PATTERNS: RegExp[] = [
  /please (sign in|log in) to continue/i,
  /accedi per continuare/i,
  /this content is for (members|subscribers) only/i,
];

export type PageUsability =
  | { usable: true }
  | { usable: false; reason: "not_found" | "captcha" | "paywall" | "empty"; detail: string };

export function assessPageQuality(rawMarkdown: string): PageUsability {
  if (!rawMarkdown || rawMarkdown.trim().length < 80) {
    return { usable: false, reason: "empty", detail: "Pagina vuota o troppo corta per essere utile" };
  }

  // Captcha ha priorità — può comparire anche dentro pagine apparentemente lunghe
  for (const re of CAPTCHA_PATTERNS) {
    if (re.test(rawMarkdown)) {
      return { usable: false, reason: "captcha", detail: "Bloccato da captcha o anti-bot" };
    }
  }

  // 404 / page not found — match solo se il contenuto è dominato dal messaggio
  // (evitiamo di marcare 404 una pagina lunga che cita "not found" in un articolo)
  const head = rawMarkdown.slice(0, 1500);
  for (const re of NOT_FOUND_PATTERNS) {
    if (re.test(head)) {
      return { usable: false, reason: "not_found", detail: "Pagina inesistente (404)" };
    }
  }

  for (const re of PAYWALL_PATTERNS) {
    if (re.test(head)) {
      return { usable: false, reason: "paywall", detail: "Contenuto dietro login/paywall" };
    }
  }

  return { usable: true };
}

export function reasonLabel(reason: Exclude<PageUsability, { usable: true }>["reason"]): string {
  switch (reason) {
    case "not_found": return "Pagina inesistente";
    case "captcha": return "Bloccato (captcha)";
    case "paywall": return "Login richiesto";
    case "empty": return "Pagina vuota";
  }
}
