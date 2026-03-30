import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
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

// ── Query: business_cards only (BCA-dedicated cockpit) ──
function useBusinessCardContactsQuery() {
  return useQuery({
    queryKey: ["cockpit-business-cards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("business_cards")
        .select("id, contact_name, company_name, position, email, phone, mobile, location, met_at, event_name, created_at, match_status")
        .not("contact_name", "is", null)
        .order("created_at", { ascending: false })
        .limit(500);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });
}

export function useCockpitContacts() {
  const bcQ = useBusinessCardContactsQuery();

  const isLoading = bcQ.isLoading;

  const contacts = useMemo<CockpitContact[]>(() => {
    const result: CockpitContact[] = [];

    for (const bc of bcQ.data || []) {
      const email = bc.email || "";
      const phone = bc.phone || bc.mobile || null;
      result.push({
        id: `bc-${bc.id}`,
        name: bc.contact_name || "—",
        company: bc.company_name || "—",
        role: bc.position || "",
        country: "",
        language: "english",
        lastContact: formatRelativeDate(bc.met_at || bc.created_at),
        priority: computePriority(email, phone, bc.mobile, bc.met_at),
        channels: inferChannels(email, phone, bc.mobile),
        email: email,
        origin: "import" as ContactOrigin,
        originDetail: bc.event_name ? `BCA · ${bc.event_name}` : "Biglietto da visita",
      });
    }

    result.sort((a, b) => b.priority - a.priority);
    return result;
  }, [bcQ.data]);

  const contactsMap = useMemo(() => {
    const map: Record<string, CockpitContact> = {};
    for (const c of contacts) map[c.id] = c;
    return map;
  }, [contacts]);

  return { contacts, contactsMap, isLoading };
}

/**
 * Elimina contatti cockpit dalla tabella corretta in base al prefisso ID.
 * Gli ID cockpit sono: pc-{uuid}, ic-{uuid}, prc-{uuid}
 */
export function useDeleteCockpitContacts() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (prefixedIds: string[]) => {
      // Raggruppa per tabella sorgente
      const pcIds: string[] = [];
      const icIds: string[] = [];
      const prcIds: string[] = [];

      for (const pid of prefixedIds) {
        if (pid.startsWith("pc-")) pcIds.push(pid.slice(3));
        else if (pid.startsWith("ic-")) icIds.push(pid.slice(3));
        else if (pid.startsWith("prc-")) prcIds.push(pid.slice(4));
      }

      const errors: string[] = [];

      if (pcIds.length > 0) {
        // Pulisci FK: activities.selected_contact_id → null
        await supabase
          .from("activities")
          .update({ selected_contact_id: null } as any)
          .in("selected_contact_id", pcIds);
        // Pulisci FK: partner_social_links.contact_id
        await supabase
          .from("partner_social_links")
          .delete()
          .in("contact_id", pcIds);
        // Ora elimina il contatto
        const { error } = await supabase
          .from("partner_contacts")
          .delete()
          .in("id", pcIds);
        if (error) errors.push(`partner_contacts: ${error.message}`);
      }

      if (icIds.length > 0) {
        const { error } = await supabase
          .from("imported_contacts")
          .delete()
          .in("id", icIds);
        if (error) errors.push(`imported_contacts: ${error.message}`);
      }

      if (prcIds.length > 0) {
        const { error } = await supabase
          .from("prospect_contacts")
          .delete()
          .in("id", prcIds);
        if (error) errors.push(`prospect_contacts: ${error.message}`);
      }

      if (errors.length > 0) throw new Error(errors.join("; "));
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cockpit-partner-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["cockpit-imported-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["cockpit-prospect-contacts"] });
      queryClient.invalidateQueries({ queryKey: ["activities"] });
      queryClient.invalidateQueries({ queryKey: ["all-activities"] });
    },
  });
}
