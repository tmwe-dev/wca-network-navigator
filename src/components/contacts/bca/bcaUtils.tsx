import { useAppNavigate } from "@/hooks/useAppNavigate";
import { Mail, MessageCircle, Phone } from "lucide-react";
import { ContactActionMenu } from "@/components/cockpit/ContactActionMenu";
import { adaptBusinessCard } from "@/lib/contactActionAdapter";
import { resolveCountryCode } from "@/lib/countries";
import type { BusinessCardWithPartner } from "@/hooks/useBusinessCards";
import { createLogger } from "@/lib/log";

const log = createLogger("bcaUtils");

/* ═══ Status colors & labels ═══ */
export const STATUS_COLORS: Record<string, string> = {
  matched: "bg-emerald-500/15 text-emerald-400",
  unmatched: "bg-amber-500/15 text-amber-400",
  pending: "bg-muted text-muted-foreground",
};
export const STATUS_LABELS: Record<string, string> = {
  matched: "Match", unmatched: "No match", pending: "Attesa",
};

/* ═══ Origin accent border ═══ */
export function getCardOriginClasses(card: BusinessCardWithPartner): { border: string; bg: string } {
  if (card.match_status === "matched" && card.matched_partner_id) {
    return { border: "from-chart-1/60 to-chart-1/20", bg: "bg-chart-1/5" };
  }
  return { border: "from-amber-500/60 to-amber-500/20", bg: "bg-amber-500/5" };
}

/* ═══ Country flag ═══ */
export function countryFlag(code: string | null | undefined): string {
  if (!code) return "";
  try {
    return String.fromCodePoint(...[...code.toUpperCase()].map((c: string) => 0x1F1E6 + c.charCodeAt(0) - 65));
  } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return ""; }
}

/* ═══ Resolve country from card data ═══ */
export function getCardCountryCode(card: BusinessCardWithPartner): string | null {
  if (card.partner?.country_code) return card.partner.country_code;
  const rd = card.raw_data as any;
  if (rd?.country_code) return rd.country_code;
  if (rd?.country) {
    const resolved = resolveCountryCode(rd.country);
    if (resolved) return resolved;
  }
  if (card.location) {
    const resolved = resolveCountryCode(card.location);
    if (resolved) return resolved;
    const parts = card.location.split(",").map(s => s.trim());
    for (let i = parts.length - 1; i >= 0; i--) {
      const r = resolveCountryCode(parts[i]);
      if (r) return r;
    }
  }
  return null;
}

/* ═══ Get WCA membership year ═══ */
export function getWcaYear(card: BusinessCardWithPartner): string | null {
  if (!card.partner) return null;
  const ed = card.partner.enrichment_data;
  if (!ed) return null;
  const year = ed?.membership_year || ed?.member_since || ed?.wca_year;
  return year ? String(year) : null;
}

/* ═══ Google logo search URL ═══ */
export function googleLogoSearchUrl(companyName: string) {
  return `https://www.google.com/search?q=${encodeURIComponent(companyName + " logo")}&tbm=isch`;
}

/* ═══ BCA Quick Actions ═══ */
export function BCAQuickActions({ card }: { card: BusinessCardWithPartner }) {
  const navigate = useAppNavigate();
  const handleEmail = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!card.email) return;
    navigate("/email-composer", {
      state: {
        prefilledRecipient: {
          email: card.email,
          name: card.contact_name || undefined,
          company: card.company_name || undefined,
          partnerId: card.matched_partner_id || undefined,
        },
      },
    });
  };
  const handleWhatsApp = (e: React.MouseEvent) => {
    e.stopPropagation();
    const phone = (card.mobile || card.phone || "").replace(/[^0-9+]/g, "");
    if (phone) window.open(`https://wa.me/${phone.replace("+", "")}`, "_blank");
  };
  return (
    <div className="flex items-center gap-0.5 shrink-0" onClick={e => e.stopPropagation()}>
      {card.email && (
        <button onClick={handleEmail} className="p-0.5 rounded hover:bg-primary/10" title="Email">
          <Mail className="w-3 h-3 text-primary" />
        </button>
      )}
      {(card.phone || card.mobile) && (
        <button onClick={handleWhatsApp} className="p-0.5 rounded hover:bg-emerald-500/10" title="WhatsApp">
          <MessageCircle className="w-3 h-3 text-emerald-500" />
        </button>
      )}
      <ContactActionMenu contact={adaptBusinessCard(card)} />
    </div>
  );
}
