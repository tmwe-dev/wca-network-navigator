import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useMemo } from "react";
import type { ContactOrigin } from "@/pages/Cockpit";

export interface CockpitContact {
  id: string;
  name: string;
  company: string;
  role: string;
  country: string;
  language: string;
  lastContact: string;
  priority: number;
  channels: string[];
  email: string;
  origin: ContactOrigin;
  originDetail: string;
}

const COUNTRY_LANGUAGE: Record<string, string> = {
  IT: "italiano", FR: "français", DE: "deutsch", ES: "español",
  BR: "português", PT: "português", JP: "日本語", CN: "中文",
};

function inferLanguage(countryCode: string | null): string {
  if (!countryCode) return "english";
  return COUNTRY_LANGUAGE[countryCode.toUpperCase().trim()] || "english";
}

function inferChannels(email?: string | null, phone?: string | null, mobile?: string | null): string[] {
  const ch: string[] = [];
  if (email) ch.push("email");
  if (phone || mobile) ch.push("whatsapp", "sms");
  ch.push("linkedin");
  return ch;
}

function computePriority(email?: string | null, phone?: string | null, mobile?: string | null, lastInteraction?: string | null): number {
  let p = 1;
  if (email) p += 3;
  if (phone || mobile) p += 2;
  if (lastInteraction) {
    const days = (Date.now() - new Date(lastInteraction).getTime()) / 86400000;
    if (days < 7) p += 3;
    else if (days < 30) p += 2;
    else if (days < 90) p += 1;
  }
  return Math.min(p, 10);
}

function formatRelativeDate(dateStr: string | null): string {
  if (!dateStr) return "Mai";
  const days = Math.floor((Date.now() - new Date(dateStr).getTime()) / 86400000);
  if (days < 1) return "Oggi";
  if (days === 1) return "Ieri";
  if (days < 7) return `${days} giorni fa`;
  if (days < 30) return `${Math.floor(days / 7)} settimane fa`;
  if (days < 365) return `${Math.floor(days / 30)} mesi fa`;
  return `${Math.floor(days / 365)} anni fa`;
}

function getImportedOriginDetail(origin: string | null, groupName?: string | null, fileName?: string | null): string {
  if (origin?.startsWith("business_card:")) {
    return `Biglietti da visita · ${origin.replace("business_card:", "")}`;
  }
  if (origin === "business_card") {
    return groupName ? `Biglietti da visita · ${groupName}` : "Biglietti da visita";
  }
  return groupName || fileName || "Import";
}

// ── Query: partner_contacts + partners ──
function usePartnerContactsQuery() {
  return useQuery({
    queryKey: ["cockpit-partner-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, name, title, email, direct_phone, mobile, partner_id, created_at, partners!inner(company_name, country_code, country_name, last_interaction_at, email, phone, mobile)")
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

// ── Query: imported_contacts + import_logs ──
function useImportedContactsQuery() {
  return useQuery({
    queryKey: ["cockpit-imported-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, position, email, phone, mobile, country, origin, created_at, last_interaction_at, import_logs!inner(file_name, group_name)")
        .not("name", "is", null)
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

// ── Query: prospect_contacts + prospects ──
function useProspectContactsQuery() {
  return useQuery({
    queryKey: ["cockpit-prospect-contacts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("prospect_contacts")
        .select("id, name, role, email, phone, prospect_id, created_at, prospects!inner(company_name, city, province, last_interaction_at)")
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

export function useCockpitContacts() {
  const partnerQ = usePartnerContactsQuery();
  const importedQ = useImportedContactsQuery();
  const prospectQ = useProspectContactsQuery();

  const isLoading = partnerQ.isLoading || importedQ.isLoading || prospectQ.isLoading;

  const contacts = useMemo<CockpitContact[]>(() => {
    const result: CockpitContact[] = [];

    // Partner contacts (WCA)
    for (const pc of partnerQ.data || []) {
      const p = pc.partners;
      if (!p) continue;
      const email = pc.email || p.email || "";
      const phone = pc.direct_phone || pc.mobile || p.phone || p.mobile || null;
      result.push({
        id: `pc-${pc.id}`,
        name: pc.name || "—",
        company: p.company_name || "—",
        role: pc.title || "",
        country: (p.country_code || "").trim(),
        language: inferLanguage(p.country_code),
        lastContact: formatRelativeDate(p.last_interaction_at || pc.created_at),
        priority: computePriority(email, phone, null, p.last_interaction_at),
        channels: inferChannels(email, phone),
        email: email || "",
        origin: "wca" as ContactOrigin,
        originDetail: "WCA",
      });
    }

    // Imported contacts
    for (const ic of importedQ.data || []) {
      const log = ic.import_logs;
      result.push({
        id: `ic-${ic.id}`,
        name: ic.name || "—",
        company: ic.company_name || "—",
        role: ic.position || "",
        country: (ic.country || "").trim(),
        language: inferLanguage(ic.country),
        lastContact: formatRelativeDate(ic.last_interaction_at || ic.created_at),
        priority: computePriority(ic.email, ic.phone, ic.mobile, ic.last_interaction_at),
        channels: inferChannels(ic.email, ic.phone, ic.mobile),
        email: ic.email || "",
        origin: "import" as ContactOrigin,
        originDetail: getImportedOriginDetail(ic.origin, log?.group_name, log?.file_name),
      });
    }

    // Prospect contacts (Report Aziende)
    for (const prc of prospectQ.data || []) {
      const pr = prc.prospects;
      if (!pr) continue;
      result.push({
        id: `prc-${prc.id}`,
        name: prc.name || "—",
        company: pr.company_name || "—",
        role: prc.role || "",
        country: "IT",
        language: "italiano",
        lastContact: formatRelativeDate(pr.last_interaction_at || prc.created_at),
        priority: computePriority(prc.email, prc.phone, null, pr.last_interaction_at),
        channels: inferChannels(prc.email, prc.phone),
        email: prc.email || "",
        origin: "report_aziende" as ContactOrigin,
        originDetail: "Report Aziende",
      });
    }

    // Sort by priority desc
    result.sort((a, b) => b.priority - a.priority);
    return result;
  }, [partnerQ.data, importedQ.data, prospectQ.data]);

  const contactsMap = useMemo(() => {
    const map: Record<string, CockpitContact> = {};
    for (const c of contacts) map[c.id] = c;
    return map;
  }, [contacts]);

  return { contacts, contactsMap, isLoading };
}
