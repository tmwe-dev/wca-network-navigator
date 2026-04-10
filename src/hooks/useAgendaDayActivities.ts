import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { format } from "date-fns";
import type { AllActivity } from "./useActivities";
import type { Reminder } from "./useReminders";

export interface AgendaDayData {
  activities: AllActivity[];
  reminders: Reminder[];
  respondedPartnerIds: Set<string>;
}

// Mock data for agenda demo
const MOCK_AGENDA_ACTIVITIES: AllActivity[] = [
  {
    id: "ag-1", title: "Email primo contatto — Mazzetti Trasporti", description: "Presentazione servizi consolidato aereo MXP-DXB",
    activity_type: "send_email", status: "completed", priority: "high", created_at: new Date().toISOString().replace(/T.*/, "T09:15:00Z"),
    due_date: null, completed_at: new Date().toISOString().replace(/T.*/, "T09:20:00Z"), email_subject: "Collaborazione Aereo MXP–DXB",
    email_body: "<p>Gentile Sig. Rossi, le scrivo per presentare le nostre tariffe consolidate...</p>",
    partner_id: "mock-p1", source_id: "s1", source_type: "manual", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: null, source_meta: null,
    partners: { company_name: "Mazzetti Trasporti Srl", company_alias: null, country_code: "IT", country_name: "Italy", city: "Milano", enriched_at: null, website: null, logo_url: null, email: "m.rossi@mazzetti.it" },
    team_members: null, selected_contact: { id: "c1", name: "Marco Rossi", email: "m.rossi@mazzetti.it", direct_phone: null, mobile: "+39 335 1234567", title: "Operations Manager", contact_alias: null },
  } as any,
  {
    id: "ag-2", title: "Follow-up WhatsApp — Global Freight", description: "Secondo contatto dopo mancata risposta email",
    activity_type: "follow_up", status: "pending", priority: "medium", created_at: new Date().toISOString().replace(/T.*/, "T10:00:00Z"),
    due_date: new Date().toISOString().replace(/T.*/, "T14:00:00Z"), completed_at: null, email_subject: null, email_body: null,
    partner_id: "mock-p2", source_id: "s2", source_type: "ai_agent", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: "agent-1", reviewed: false, scheduled_at: null, selected_contact_id: null, sent_at: null,
    source_meta: { note: "Nessuna risposta dopo 5 giorni" },
    partners: { company_name: "Global Freight LLC", company_alias: null, country_code: "AE", country_name: "UAE", city: "Dubai", enriched_at: null, website: null, logo_url: null, email: "ops@globalfreight.ae" },
    team_members: null, selected_contact: { id: "c2", name: "Ahmed Al-Rashid", email: "ops@globalfreight.ae", direct_phone: null, mobile: null, title: "Operations", contact_alias: null },
  } as any,
  {
    id: "ag-3", title: "Chiamata Nordic Shipping — verifica interesse", description: "Chiamata programmata per verificare interesse dopo proposta aereo",
    activity_type: "phone_call", status: "in_progress", priority: "high", created_at: new Date().toISOString().replace(/T.*/, "T10:30:00Z"),
    due_date: new Date().toISOString().replace(/T.*/, "T10:00:00Z"), completed_at: null, email_subject: null, email_body: null,
    partner_id: "mock-p4", source_id: "s4", source_type: "manual", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: null,
    source_meta: { note: "Dopo 2 email senza risposta — escalation telefonica" },
    partners: { company_name: "Nordic Shipping AB", company_alias: null, country_code: "SE", country_name: "Sweden", city: "Göteborg", enriched_at: null, website: null, logo_url: null, email: "info@nordicship.se" },
    team_members: null, selected_contact: null,
  } as any,
  {
    id: "ag-4", title: "Email tariffe LCL — Pacifica Logistica", description: "Invio tariffe mare Santos-Genova Q2",
    activity_type: "send_email", status: "completed", priority: "low", created_at: new Date().toISOString().replace(/T.*/, "T08:30:00Z"),
    due_date: null, completed_at: new Date().toISOString().replace(/T.*/, "T08:45:00Z"),
    email_subject: "Tariffe Mare FCL Santos – Genova Q2 2026", email_body: "<p>Caro Carlos, in allegato le nostre migliori tariffe FCL per il Q2...</p>",
    partner_id: "mock-p3", source_id: "s3", source_type: "campaign", user_id: null, assigned_to: null,
    campaign_batch_id: "b2", executed_by_agent_id: null, reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: new Date().toISOString().replace(/T.*/, "T08:45:00Z"),
    source_meta: null,
    partners: { company_name: "Pacifica Logistica SA", company_alias: null, country_code: "BR", country_name: "Brazil", city: "São Paulo", enriched_at: null, website: null, logo_url: null, email: "carlos@pacifica.com.br" },
    team_members: null, selected_contact: { id: "c3", name: "Carlos Silva", email: "carlos@pacifica.com.br", direct_phone: null, mobile: null, title: "Import Manager", contact_alias: null },
  } as any,
  {
    id: "ag-5", title: "LinkedIn connection — CargoPrime", description: "Richiesta connessione LinkedIn a Sales Manager",
    activity_type: "follow_up", status: "completed", priority: "low", created_at: new Date().toISOString().replace(/T.*/, "T11:00:00Z"),
    due_date: null, completed_at: new Date().toISOString().replace(/T.*/, "T11:10:00Z"), email_subject: null, email_body: null,
    partner_id: "mock-p7", source_id: "s5", source_type: "ai_agent", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: "agent-1", reviewed: true, scheduled_at: null, selected_contact_id: null, sent_at: null,
    source_meta: null,
    partners: { company_name: "CargoPrime Ltd", company_alias: null, country_code: "GB", country_name: "UK", city: "London", enriched_at: null, website: null, logo_url: null, email: "sales@cargoprime.co.uk" },
    team_members: null, selected_contact: { id: "c5", name: "James Wilson", email: "sales@cargoprime.co.uk", direct_phone: null, mobile: null, title: "Sales Manager", contact_alias: null },
  } as any,
  {
    id: "ag-6", title: "Nota urgente: Silk Route richiede tariffe espresso", description: "Il cliente ha richiesto urgentemente tariffe espresso BOM-FCO",
    activity_type: "follow_up", status: "pending", priority: "urgent", created_at: new Date().toISOString().replace(/T.*/, "T07:30:00Z"),
    due_date: new Date().toISOString().replace(/T.*/, "T08:00:00Z"), completed_at: null, email_subject: null, email_body: null,
    partner_id: "mock-p8", source_id: "s6", source_type: "manual", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: null, reviewed: false, scheduled_at: null, selected_contact_id: null, sent_at: null,
    source_meta: { note: "Urgente: il cliente ha chiamato direttamente chiedendo tariffe espresso BOM-FCO per 500kg elettronica fragile" },
    partners: { company_name: "Silk Route Logistics", company_alias: null, country_code: "IN", country_name: "India", city: "Mumbai", enriched_at: null, website: null, logo_url: null, email: "priya@silkroute.in" },
    team_members: null, selected_contact: { id: "c6", name: "Priya Sharma", email: "priya@silkroute.in", direct_phone: null, mobile: null, title: "CEO", contact_alias: null },
  } as any,
  {
    id: "ag-7", title: "Email reminder TransAlp Spedizioni", description: "Reminder automatico dopo 5 giorni senza risposta",
    activity_type: "send_email", status: "pending", priority: "medium", created_at: new Date().toISOString().replace(/T.*/, "T12:00:00Z"),
    due_date: new Date().toISOString().replace(/T.*/, "T09:00:00Z"), completed_at: null,
    email_subject: "Re: Collaborazione spedizioni aeree", email_body: "<p>Gentile Sig. Bianchi, mi permetto di ricontattarla...</p>",
    partner_id: "mock-p6", source_id: "s7", source_type: "ai_agent", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: "agent-2", reviewed: false, scheduled_at: null, selected_contact_id: null, sent_at: null,
    source_meta: null,
    partners: { company_name: "TransAlp Spedizioni", company_alias: null, country_code: "IT", country_name: "Italy", city: "Verona", enriched_at: null, website: null, logo_url: null, email: "g.bianchi@transalp.it" },
    team_members: null, selected_contact: { id: "c7", name: "Giovanni Bianchi", email: "g.bianchi@transalp.it", direct_phone: null, mobile: null, title: "Direttore Commerciale", contact_alias: null },
  } as any,
  {
    id: "ag-8", title: "Meeting online Yangtze Express — partnership", description: "Video call per discutere partnership esclusiva PVG-MXP",
    activity_type: "phone_call", status: "pending", priority: "high", created_at: new Date().toISOString().replace(/T.*/, "T14:00:00Z"),
    due_date: new Date().toISOString().replace(/T.*/, "T15:00:00Z"), completed_at: null, email_subject: null, email_body: null,
    partner_id: "mock-p5", source_id: "s8", source_type: "manual", user_id: null, assigned_to: null,
    campaign_batch_id: null, executed_by_agent_id: null, reviewed: true, scheduled_at: new Date().toISOString().replace(/T.*/, "T15:00:00Z"), selected_contact_id: null, sent_at: null,
    source_meta: { note: "Confermato via email da Mr. Wang" },
    partners: { company_name: "Yangtze Express Co", company_alias: null, country_code: "CN", country_name: "China", city: "Shanghai", enriched_at: null, website: null, logo_url: null, email: "wang.li@yangtze-exp.cn" },
    team_members: null, selected_contact: { id: "c8", name: "Wang Li", email: "wang.li@yangtze-exp.cn", direct_phone: null, mobile: null, title: "Partnership Director", contact_alias: null },
  } as any,
];

const MOCK_REMINDERS: Reminder[] = [
  {
    id: "rem-1", title: "Scadenza proposta Mazzetti", partner_id: "mock-p1", due_date: new Date().toISOString().split("T")[0],
    status: "pending", created_at: new Date().toISOString(), user_id: "u1", description: "La proposta scade tra 2 giorni",
    partners: { company_name: "Mazzetti Trasporti Srl", country_code: "IT" },
  } as any,
  {
    id: "rem-2", title: "Follow-up Silk Route — tariffe espresso", partner_id: "mock-p8", due_date: new Date().toISOString().split("T")[0],
    status: "pending", created_at: new Date().toISOString(), user_id: "u1", description: "Verificare se hanno ricevuto quotazione",
    partners: { company_name: "Silk Route Logistics", country_code: "IN" },
  } as any,
];

function isMockEnabled(): boolean {
  try {
    return localStorage.getItem("demo-data-enabled") === "true" || localStorage.getItem("outreach-mock-enabled") === "true";
  } catch {
    return false;
  }
}

export function useAgendaDayActivities(day: Date | null) {
  const dayStr = day ? format(day, "yyyy-MM-dd") : null;
  const mockEnabled = isMockEnabled();

  return useQuery({
    queryKey: ["agenda-day", dayStr, mockEnabled],
    queryFn: async (): Promise<AgendaDayData> => {
      if (!dayStr) return { activities: [], reminders: [], respondedPartnerIds: new Set() };

      // Return mock data when enabled
      if (mockEnabled) {
        const todayStr = format(new Date(), "yyyy-MM-dd");
        if (dayStr === todayStr) {
          return {
            activities: MOCK_AGENDA_ACTIVITIES,
            reminders: MOCK_REMINDERS,
            respondedPartnerIds: new Set(["mock-p1", "mock-p3"]),
          };
        }
        return { activities: [], reminders: [], respondedPartnerIds: new Set() };
      }

      const dayStart = `${dayStr}T00:00:00`;
      const dayEnd = `${dayStr}T23:59:59`;

      // Fetch activities for the day
      const { data: acts, error: actErr } = await supabase
        .from("activities")
        .select(`
          *,
          partners(company_name, company_alias, country_code, country_name, city, enriched_at, website, logo_url, email),
          team_members(name),
          selected_contact:partner_contacts!activities_selected_contact_id_fkey(id, name, email, direct_phone, mobile, title, contact_alias)
        `)
        .gte("created_at", dayStart)
        .lte("created_at", dayEnd)
        .order("created_at", { ascending: false });

      if (actErr) throw actErr;

      // Fetch reminders for the day
      const { data: rems, error: remErr } = await supabase
        .from("reminders")
        .select(`*, partners(company_name, country_code)`)
        .eq("due_date", dayStr)
        .order("due_date", { ascending: true });

      if (remErr) throw remErr;

      // Check which partners have responded
      const partnerIds = (acts || [])
        .filter(a => a.partner_id && ["send_email", "follow_up"].includes(a.activity_type))
        .map(a => a.partner_id!);

      const uniquePartnerIds = [...new Set(partnerIds)];
      const respondedPartnerIds = new Set<string>();

      if (uniquePartnerIds.length > 0) {
        const { data: inbound } = await supabase
          .from("channel_messages")
          .select("partner_id")
          .in("partner_id", uniquePartnerIds.slice(0, 100))
          .eq("direction", "inbound")
          .gte("created_at", dayStart);

        if (inbound) {
          inbound.forEach(m => {
            if (m.partner_id) respondedPartnerIds.add(m.partner_id);
          });
        }
      }

      return {
        activities: (acts || []) as unknown as AllActivity[],
        reminders: (rems || []) as Reminder[],
        respondedPartnerIds,
      };
    },
    enabled: !!dayStr,
    staleTime: 30_000,
  });
}
