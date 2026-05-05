/**
 * Sceglie il tipo email di default in base al contesto:
 * - se isReply → "contesto_email" (risposta a mail entrante)
 * - altrimenti → "primo_contatto" (outreach standard)
 */
import { DEFAULT_EMAIL_TYPES, type EmailType } from "@/data/defaultEmailTypes";

export function pickDefaultEmailTypeId(ctx: { isReply?: boolean } = {}): string {
  return ctx.isReply ? "contesto_email" : "primo_contatto";
}

export function pickDefaultEmailType(ctx: { isReply?: boolean } = {}): EmailType | null {
  const id = pickDefaultEmailTypeId(ctx);
  return DEFAULT_EMAIL_TYPES.find((t) => t.id === id) ?? DEFAULT_EMAIL_TYPES[0] ?? null;
}