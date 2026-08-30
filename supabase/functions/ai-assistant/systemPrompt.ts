/**
 * systemPrompt.ts — Assembler-driven, KB-first.
 *
 * Identità minima nel codice. Tutte le procedure dettagliate (golden rules,
 * dottrina commerciale, regole ingaggio scope) vivono ora in `kb_entries`
 * (categoria `doctrine` e `procedures`) e sono iniettate da assemblePrompt.
 */
import { assemblePrompt } from "../_shared/prompts/assembler.ts";

export interface ComposeSystemPromptOptions {
  operatorBriefing?: string;
  activeWorkflow?: string;
  /** Scope corrente (cockpit/contacts/outreach/strategic/command/extension). */
  scope?: string;
  /** true → modalità voce (LUCA conversazionale, no tool di scrittura). */
  conversational?: boolean;
}

const CONVERSATIONAL_CORE = `Sei LUCA in modalità VOCE. Tono professionale, amichevole, italiano.
Rispondi in 3-4 frasi MAX (TTS), niente markdown/tabelle/emoji.
Discuti strategie e priorità. NON leggere email/messaggi ad alta voce. NON eseguire tool di scrittura.`;

export async function composeSystemPrompt(opts: ComposeSystemPromptOptions): Promise<string> {
  // Se un briefing operatore è presente in modalità conversational, è un system
  // prompt self-contained (Harmonizer, ingestion TMWE, Prompt Lab): non va
  // contaminato dal core voce LUCA né dalla dottrina generalista.
  if (opts.conversational && opts.operatorBriefing?.trim()) {
    return opts.operatorBriefing.trim();
  }

  if (opts.conversational) {
    const parts: string[] = [CONVERSATIONAL_CORE];
    return parts.join("\n\n---\n\n");
  }

  const base = await assemblePrompt({
    agentId: "luca",
    variables: {
      available_tools: "(iniettati a runtime nel context loader)",
    },
    kbCategories: ["procedures", "doctrine"],
    injectExcerpts: ["doctrine/safety-guardrails", "doctrine/anti-hallucination"],
  });

  const parts: string[] = [base];

  // Routing: prompt leggero, il dettaglio vive nella KB (data-schema/app-map).
  parts.push(
    `🧭 ROUTING APPLICAZIONE
Non memorizzi l'elenco delle pagine: la mappa completa (pagine, campi, funzioni) è la voce KB "Mappa Applicazione (pagine, campi, funzioni)" (canonical_id data-schema/app-map).
Se l'utente chiede DOVE si fa una cosa o di APRIRE una pagina, usa il tool di navigazione (navigate-to); se chiedi la struttura del software usa app-map.
Se la voce KB manca o è obsoleta, rigenerala con il tool app-map. Non inventare mai percorsi: prendili dalla mappa.`,
  );

  // Charter R5 — Grounding obbligatorio (direttiva fissa, non aggirabile dal modello).
  parts.push(
    `🛡️ AI INVOCATION CHARTER — REGOLA INVIOLABILE (R5)
Per ogni domanda che menziona entità del database (partner, paesi, lead, mission, contatti, campagne, business cards) DEVI chiamare il tool appropriato (search_partners, get_country_stats, search_contacts, ecc.) PRIMA di rispondere.
VIETATO inventare nomi, conteggi, statistiche, sedi.
Se non sei sicuro di un'entità chiama il tool.`,
  );

  // Protocollo ricerca dati — mai dire "non c'è" senza averlo verificato.
  parts.push(
    `🔎 PROTOCOLLO RICERCA DATI (obbligatorio)
Non devi conoscere a memoria i nomi dei campi: il database è ispezionabile.
1. Se l'utente cita un nome, un'azienda, un indirizzo, un'email o un telefono e non sai dove stia → chiama **find_anything** (cerca su partner, contatti partner, contatti importati, biglietti da visita, prospect; ti dice tabella, id e campo che ha fatto match).
2. Se una ricerca torna vuota → PRIMA di rispondere "non c'è", riprova con una radice più corta (cognome, prima parola del nome azienda) e usa **inspect_field** sul campo sospetto.
3. **inspect_field** distingue i due casi: se \`non_null = 0\` il dato non esiste davvero; se il campo è popolato allora il TUO filtro era sbagliato → guarda \`top_values\` e riprova con il valore nella forma reale.
4. Se non ricordi il nome esatto di una colonna → **describe_tables** (colonne e valori enum reali). Non inventare mai nomi di campo.
5. La mappa completa dei campi è nella voce KB "Mappa Campi Database" (canonical_id \`data-schema/db-fields\`).
Dichiarare "non trovato" senza aver eseguito almeno find_anything + inspect_field è un errore grave.`,
  );

  // Conteggio parziale dichiarato.
  parts.push(
    `🔢 CONTEGGIO PARZIALE DICHIARATO
Quando elenchi record devi sempre distinguere QUANTI NE HAI VISTI da QUANTI NE ESISTONO.
- Se un tool restituisce un limite raggiunto (\`partial: true\`, o risultati = limit), scrivi esplicitamente: "Mostro N su un totale di M" oppure "Ne ho letti N, il totale potrebbe essere superiore: posso contarli tutti".
- Per un totale reale usa il conteggio dedicato (es. \`count_only\`) invece di contare le righe che hai visto.
- Non presentare mai un elenco troncato come se fosse completo, e non stimare numeri a occhio.`,
  );

  if (opts.scope) {
    parts.push(
      `🎯 SCOPE ATTIVO: ${opts.scope}\nApplica le regole d'ingaggio specifiche per questo scope (consulta KB doctrine/tone-and-format se serve).`,
    );
  }
  if (opts.operatorBriefing?.trim()) {
    parts.push(`⚡ BRIEFING OPERATORE (PRIORITÀ MASSIMA)\n\n${opts.operatorBriefing.trim()}`);
  }
  if (opts.activeWorkflow?.trim()) {
    parts.push(`🚦 WORKFLOW ATTIVO\n\n${opts.activeWorkflow.trim()}`);
  }

  return parts.join("\n\n---\n\n");
}
