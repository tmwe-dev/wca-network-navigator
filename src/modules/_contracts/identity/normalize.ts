/**
 * Normalizzazione identità — funzioni PURE, nessun accesso a DB o rete.
 *
 * Usate dall'identity resolution del futuro Data Hub. Nessun modulo esistente
 * le importa: cambiarle non altera il comportamento runtime dell'app.
 */

const EMAIL_PLUS_TAG = /\+[^@]*/;
const NON_ALNUM = /[^a-z0-9]+/g;

/** Rimuove accenti, spazi multipli e case. */
export function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim()
    .replace(/\s+/g, " ");
}

/** Email canonica: lowercase, trim, rimozione plus-tag. */
export function normalizeEmail(value: string | null | undefined): string {
  const base = normalizeText(value).replace(/\s/g, "");
  if (!base.includes("@")) return "";
  const [local, domain] = base.split("@");
  if (!local || !domain) return "";
  return `${local.replace(EMAIL_PLUS_TAG, "")}@${domain}`;
}

export function emailDomain(value: string | null | undefined): string {
  const email = normalizeEmail(value);
  return email ? email.split("@")[1] : "";
}

/** Telefono in forma comparabile: solo cifre, prefisso 00 → +. */
export function normalizePhone(value: string | null | undefined): string {
  if (!value) return "";
  const digits = value.replace(/[^\d+]/g, "").replace(/^00/, "+");
  const onlyDigits = digits.replace(/\D/g, "");
  return onlyDigits.length < 6 ? "" : onlyDigits;
}

const COMPANY_STOPWORDS = new Set([
  "srl","s r l","spa","s p a","ltd","limited","llc","inc","gmbh","bv","nv","sa","sas","sarl",
  "co","company","corp","corporation","group","holding","logistics","international","the",
]);

/** Ragione sociale comparabile: senza forme societarie e punteggiatura. */
export function normalizeCompanyName(value: string | null | undefined): string {
  const base = normalizeText(value).replace(NON_ALNUM, " ").trim();
  if (!base) return "";
  const tokens = base.split(" ").filter((t) => t && !COMPANY_STOPWORDS.has(t));
  return (tokens.length ? tokens : base.split(" ")).join(" ");
}

/** Nome persona comparabile: token ordinati per rendere "Mario Rossi" == "Rossi Mario". */
export function normalizePersonName(value: string | null | undefined): string {
  const base = normalizeText(value).replace(NON_ALNUM, " ").trim();
  if (!base) return "";
  return base.split(" ").filter(Boolean).sort().join(" ");
}

/** URL LinkedIn ridotto allo slug del profilo. */
export function normalizeLinkedinUrl(value: string | null | undefined): string {
  const base = normalizeText(value);
  if (!base) return "";
  const match = base.match(/linkedin\.com\/(?:in|company)\/([^/?#\s]+)/);
  return match ? match[1] : "";
}
