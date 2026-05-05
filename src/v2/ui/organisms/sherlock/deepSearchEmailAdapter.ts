/**
 * deepSearchEmailAdapter — converte un indirizzo email (con/senza partner)
 * in un target compatibile con `SherlockLauncherDialog` / `useSherlock`.
 *
 * Permette di lanciare la Deep Search anche su address "puri" (Funnemail Inbox,
 * AISuggestionsTab) senza richiedere `partner_id`/`contact_id`.
 */
import type { SherlockLauncherTarget } from "./SherlockLauncherDialog";
import { extractSenderBrand } from "@/components/outreach/email/emailUtils";
import { deriveSenderDisplayName } from "@/lib/senderDisplayName";

export interface BuildEmailTargetOpts {
  email: string;
  displayName?: string | null;
  companyName?: string | null;
  partnerId?: string | null;
  contactId?: string | null;
  website?: string | null;
  city?: string | null;
  countryName?: string | null;
  countryCode?: string | null;
  linkedinUrl?: string | null;
}

function domainOf(email: string): string {
  const at = email.indexOf("@");
  return at >= 0 ? email.slice(at + 1).toLowerCase() : email;
}

/** Prova a inferire un company name "umano" dall'indirizzo. */
function inferCompanyName(email: string, displayName?: string | null): string {
  if (displayName && displayName.trim()) return displayName.trim();
  try {
    const { brand } = extractSenderBrand(email || "");
    if (brand && brand.trim()) return brand.trim();
  } catch { /* ignore */ }
  const fromHelper = deriveSenderDisplayName(email);
  if (fromHelper && fromHelper.trim()) return fromHelper.trim();
  return domainOf(email).split(".")[0] || email;
}

function inferWebsite(email: string, override?: string | null): string {
  if (override && override.trim()) return override.trim();
  const d = domainOf(email);
  if (!d || d.includes(" ")) return "";
  return `https://${d}`;
}

/**
 * Costruisce un `SherlockLauncherTarget` partendo da un'email.
 * `partnerId` / `contactId` rimangono opzionali (null se non esiste un record CRM).
 */
export function buildEmailDeepSearchTarget(opts: BuildEmailTargetOpts): SherlockLauncherTarget {
  const company = opts.companyName ?? inferCompanyName(opts.email, opts.displayName);
  return {
    partnerId: opts.partnerId ?? null,
    contactId: opts.contactId ?? null,
    companyName: company,
    contactName: opts.displayName ?? null,
    city: opts.city ?? null,
    countryName: opts.countryName ?? null,
    countryCode: opts.countryCode ?? null,
    website: inferWebsite(opts.email, opts.website),
    linkedinUrl: opts.linkedinUrl ?? null,
  };
}