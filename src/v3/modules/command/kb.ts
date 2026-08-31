/**
 * Grounding di Command (V3) — i tre documenti previsti dal piano.
 *
 * 1. Mappa dell'app: generata dal contratto di pagina (nessuna lista duplicata).
 * 2. Dati: le tabelle che la V3 legge davvero, con i campi utili.
 * 3. Regole: tono, perimetro e cosa Command NON può fare.
 *
 * Testo compatto: serve a orientare il modello, non a sostituire i tool.
 */
import { V3_MODULE_LABELS, V3_PAGES, type V3PageDefinition } from "@/v3/app/pageContract";

function mappaPagine(): string {
  const righe = Object.values(V3_PAGES as Record<string, V3PageDefinition>)
    .filter((p) => p.implemented && !p.publicRoute)
    .map((p) => `- ${p.path} — ${p.title} (${V3_MODULE_LABELS[p.module]}): ${p.question}`);
  return `# Mappa dell'applicazione V3\n${righe.join("\n")}`;
}

const DOC_DATI = `# Dati principali (V3)
- imported_contacts / business_cards / partners: anagrafiche; unite dalla funzione v3_directory (nome, azienda, email, paese, città, interazioni).
- channel_messages: messaggi ricevuti e inviati (thread_id, subject, from_address, direction, received_at, body_text).
- email_sender_groups / email_address_rules: smistamento per mittente o dominio.
- email_classifications: esito del classificatore sui messaggi in arrivo.
- ai_pending_actions: bozze e azioni in attesa di approvazione umana.
- activities / interactions: storia dei contatti.
Se non conosci il nome esatto di un campo, usa l'introspezione (ai_field_values) o la ricerca vaga (ai_find_anything) invece di indovinare.`;

const DOC_REGOLE = `# Regole di Command (V3)
- Tre capacità, in quest'ordine: TROVA (indica la pagina e i filtri), SINTETIZZA (riassumi storia e stato), PREPARA (bozza in Approvazioni).
- Non invii nulla e non esegui operazioni massive: ogni azione passa dalle Approvazioni (/v3/approvazioni).
- Quando la risposta corrisponde a una maschera, cita il percorso esatto (es. /v3/contatti) così l'operatore può aprirlo.
- Dichiara sempre se un conteggio è parziale o stimato.
- Italiano, tono asciutto e concreto: prima la risposta, poi il dettaglio. Niente elenchi decorativi.`;

/** Blocco unico da accodare al prompt di sistema del cervello esistente. */
export function costruisciGroundingCommandV3(): string {
  return [mappaPagine(), DOC_DATI, DOC_REGOLE].join("\n\n");
}
