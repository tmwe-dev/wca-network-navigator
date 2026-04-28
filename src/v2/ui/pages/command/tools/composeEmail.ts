import type { Tool, ToolResult } from "./types";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";

/**
 * compose-email tool — risolve partner/contatto nel CRM e usa la pipeline
 * ufficiale `generate-email` (Oracolo + Architetto + Prompt Lab + Giornalista).
 * NON usa più `unified-assistant` come scorciatoia.
 */

interface PartnerRow {
  id: string;
  company_name: string;
  company_alias: string | null;
  country_code: string | null;
  city: string | null;
  email: string | null;
  website: string | null;
  lead_status: string | null;
  status_reason: string | null;
  last_interaction_at: string | null;
}

interface ContactRow {
  id: string;
  partner_id: string;
  name: string | null;
  contact_alias: string | null;
  email: string | null;
  title: string | null;
}

function extractPersonAndCompany(prompt: string): { person: string | null; company: string | null; email: string | null } {
  const emailMatch = prompt.match(/[\w.+-]+@[\w-]+\.[\w.-]+/);
  const email = emailMatch ? emailMatch[0] : null;

  // Pattern: "a <Persona> di/della <Azienda>"
  // Cattura nome persona (1-3 token Capitalized) e azienda (fino a "di Città" / fine)
  const re = /\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,3})\s+(?:di|della|del|dello|dalla|presso)\s+(?:la\s+|il\s+|lo\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/i;
  const m = prompt.match(re);
  let person: string | null = null;
  let company: string | null = null;
  if (m) {
    person = m[1].trim();
    company = m[2].trim().replace(/\s+(e|ed)\s+invitalo.*$/i, "").trim();
  } else {
    // Fallback: cerca azienda dopo "di/della"
    const cm = prompt.match(/\b(?:di|della|del)\s+(?:la\s+|il\s+)?([A-ZÀ-Ý][\w\sÀ-ÿ'&.-]{2,60}?)(?:\s+(?:di|in|a)\s+[A-ZÀ-Ý]|[,.\n]|$)/);
    if (cm) company = cm[1].trim();
    const pm = prompt.match(/\ba\s+([A-ZÀ-Ý][\wÀ-ÿ'-]+(?:\s+[A-ZÀ-Ý][\wÀ-ÿ'-]+){0,2})\b/);
    if (pm) person = pm[1].trim();
  }
  return { person, company, email };
}

async function searchPartner(company: string | null, email: string | null): Promise<PartnerRow[]> {
  let q = supabase
    .from("partners")
    .select("id, company_name, company_alias, country_code, city, email, website, lead_status, status_reason, last_interaction_at")
    .limit(5);
  if (email) {
    q = q.eq("email", email);
  } else if (company) {
    q = q.or(`company_name.ilike.%${company}%,company_alias.ilike.%${company}%`);
  } else {
    return [];
  }
  const { data, error } = await q;
  if (error) return [];
  return (data ?? []) as PartnerRow[];
}

async function findContact(partnerId: string, person: string | null, email: string | null): Promise<ContactRow | null> {
  let q = supabase
    .from("partner_contacts")
    .select("id, partner_id, name, contact_alias, email, title")
    .eq("partner_id", partnerId)
    .limit(5);
  if (email) q = q.eq("email", email);
  const { data } = await q;
  const rows = (data ?? []) as ContactRow[];
  if (rows.length === 0) return null;
  if (!person) return rows[0];
  const norm = person.toLowerCase();
  return (
    rows.find((r) => (r.name ?? "").toLowerCase().includes(norm) || (r.contact_alias ?? "").toLowerCase().includes(norm)) ??
    rows[0]
  );
}

function leadStatusNote(s: string | null): string {
  if (!s) return "Lead status: non impostato";
  const map: Record<string, string> = {
    new: "Lead nuovo, mai contattato",
    contacted: "Già contattato in precedenza",
    qualified: "Lead qualificato",
    holding: "⚠️ In circuito d'attesa — verificare prima di rinviare",
    archived: "⚠️ Archiviato — invio sconsigliato",
    blacklisted: "⛔ In blacklist — invio bloccato",
    customer: "Cliente attivo",
  };
  return map[s] ?? `Lead status: ${s}`;
}

function daysSince(iso: string | null): string {
  if (!iso) return "mai";
  const d = Math.floor((Date.now() - new Date(iso).getTime()) / 86400000);
  if (d <= 0) return "oggi";
  if (d === 1) return "ieri";
  return `${d} giorni fa`;
}

export const composeEmailTool: Tool = {
  id: "compose-email",
  label: "Componi email",
  description: "Risolve partner/contatto, consulta Oracolo+Architetto e prepara la bozza con la pipeline ufficiale.",

  match(prompt: string): boolean {
    const p = prompt.toLowerCase();
    return /(?:scrivi|componi|invia|prepara|manda).*(?:e-?mail|mail)|\bbozz[ae].*(?:e-?mail|mail)|\bemail\s+a\s|draft.*email/.test(p);
  },

  async execute(prompt: string): Promise<ToolResult> {
    const { person, company, email } = extractPersonAndCompany(prompt);

    // 1) Cerca partner
    const candidates = await searchPartner(company, email);

    // Caso: nessun partner trovato → blocca, non aprire composer
    if (candidates.length === 0) {
      const reasonParts: string[] = [];
      if (company) reasonParts.push(`azienda "${company}"`);
      if (person) reasonParts.push(`persona "${person}"`);
      if (email) reasonParts.push(`email ${email}`);
      const reasonStr = reasonParts.length > 0 ? reasonParts.join(", ") : "i dati indicati";
      return {
        kind: "report",
        title: "Destinatario non trovato",
        meta: { count: 0, sourceLabel: "DB · partners + partner_contacts" },
        sections: [
          {
            heading: "Verifica Oracolo",
            body: `Non ho trovato nessun partner che corrisponda a ${reasonStr}.\n\nPrima di scrivere l'email serve identificare il destinatario nel CRM. Puoi:\n• Confermare la ragione sociale esatta (es. "Transport Management Srl")\n• Fornire il dominio email del destinatario\n• Censire prima il partner con "aggiungi partner ${company ?? "..."}".`,
          },
        ],
      };
    }

    // Caso: più candidati → chiedi disambiguazione
    if (candidates.length > 1 && !email) {
      const list = candidates
        .map((c, i) => `${i + 1}. **${c.company_name}**${c.city ? ` — ${c.city}` : ""}${c.country_code ? ` (${c.country_code})` : ""} · status: ${c.lead_status ?? "n/d"}`)
        .join("\n");
      return {
        kind: "report",
        title: "Più partner corrispondono",
        meta: { count: candidates.length, sourceLabel: "DB · partners" },
        sections: [
          {
            heading: "Verifica Oracolo — disambiguazione",
            body: `Ho trovato ${candidates.length} partner che corrispondono a "${company}". Indicami quale prima di procedere:\n\n${list}\n\nRiformula la richiesta specificando città o nazione (es. "scrivi a ${person ?? "Luca"} di ${candidates[0].company_name} ${candidates[0].city ?? ""}").`,
          },
        ],
      };
    }

    const partner = candidates[0];

    // Guard rail: blacklisted/archived → blocca
    if (partner.lead_status === "blacklisted") {
      return {
        kind: "report",
        title: "Invio bloccato dall'Oracolo",
        meta: { count: 1, sourceLabel: "DB · partners" },
        sections: [
          {
            heading: `${partner.company_name}`,
            body: `Questo partner è in **blacklist**${partner.status_reason ? ` (motivo: ${partner.status_reason})` : ""}. Non posso preparare email per loro. Se ritieni sia un errore, rimuovi prima la blacklist dal CRM.`,
          },
        ],
      };
    }

    // 2) Cerca contatto
    const contact = await findContact(partner.id, person, email);
    const recipientName = contact?.name ?? contact?.contact_alias ?? person ?? null;
    const recipientEmail = email ?? contact?.email ?? partner.email ?? "";

    // 3) Chiama generate-email (pipeline ufficiale)
    const emailType = "primo_contatto";
    let initialSubject = "";
    let initialBody = "";
    let generationWarning: string | null = null;
    try {
      const gen = await invokeEdge<{
        success?: boolean;
        subject?: string;
        body?: string;
        error?: string;
        message?: string;
      }>("generate-email", {
        body: {
          standalone: true,
          partner_id: partner.id,
          recipient_name: recipientName,
          recipient_company: partner.company_name,
          recipient_countries: partner.country_code ?? "",
          oracle_type: emailType,
          oracle_tone: "professionale",
          goal: prompt,
          quality: "standard",
          use_kb: true,
          language: "it",
        },
        context: "command:compose-email",
      });
      if (gen?.subject) initialSubject = gen.subject;
      if (gen?.body) initialBody = gen.body;
      if (!gen?.body && gen?.message) generationWarning = gen.message;
    } catch (e) {
      generationWarning = e instanceof Error ? e.message : "Errore generazione";
    }

    // 4) Costruisci dossier (Oracolo)
    const notes: string[] = [];
    notes.push(leadStatusNote(partner.lead_status));
    notes.push(`Ultima interazione: ${daysSince(partner.last_interaction_at)}`);
    if (partner.lead_status === "holding") {
      notes.push("Holding Pattern attivo: il partner è in attesa di follow-up programmato. Valuta se forzare un nuovo invio.");
    }
    if (partner.lead_status === "archived") {
      notes.push(`Archiviato${partner.status_reason ? ` — motivo: ${partner.status_reason}` : ""}. Rivaluta prima di scrivere.`);
    }
    if (!contact) {
      notes.push(`Nessun contatto censito per ${partner.company_name}: la mail userà il nome generico "${recipientName ?? "destinatario"}".`);
    } else if (!contact.email && !email) {
      notes.push("Contatto trovato ma senza email: aggiungi l'indirizzo prima di inviare.");
    }
    if (generationWarning) {
      notes.push(`Generazione AI: ${generationWarning}. Puoi rigenerare o scrivere manualmente.`);
    }

    return {
      kind: "composer",
      title: `Email a ${recipientName ?? partner.company_name}`,
      meta: { count: 1, sourceLabel: "Edge · generate-email (Oracolo+Architetto+Giornalista)" },
      initialTo: recipientEmail,
      initialSubject,
      initialBody,
      promptHint: prompt,
      partnerId: partner.id,
      recipientName,
      emailType,
      dossier: {
        partnerName: partner.company_name,
        contactName: recipientName,
        leadStatus: partner.lead_status,
        lastInteraction: partner.last_interaction_at,
        notes,
        emailType,
      },
    };
  },
};
