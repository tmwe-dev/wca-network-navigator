

## Piano: Knowledge Base Operativa + Orchestrazione AI Intelligente

### Analisi Attuale

**Stato AI attuale:**
- 1 singolo gateway (Lovable AI) che instrada verso Gemini/GPT
- 14 edge functions usano tutte lo stesso gateway con modelli diversi per qualità (flash-lite per task veloci, gemini-3-flash per ragionamento, gemini-2.5-flash per task standard)
- 4 agenti separati: `ai-assistant` (orchestratore), `cockpit-assistant` (comandi Cockpit), `contacts-assistant` (filtri CRM), `import-assistant` (analisi file)
- Le procedure operative NON sono codificate: l'AI non sa quali step servono per completare un workflow (es. "manda email a tutti i partner tedeschi")

**Cosa manca:**
1. Una **Operations Knowledge Base** strutturata che descriva OGNI workflow operativo con prerequisiti, step, strumenti necessari e output attesi
2. Un sistema di **tag/routing** che mappa richieste utente → procedure operative → tool necessari
3. L'AI non guida l'utente: esegue comandi ma non suggerisce il flusso corretto

### Risposta alla domanda multi-agente

**NON serve usare 5 agenti diversi.** Ecco perché:

- Tutti i modelli disponibili (Gemini, GPT) sono accessibili attraverso lo stesso Lovable AI Gateway
- Il costo/beneficio di instradare verso provider diversi è minimo: Gemini Flash è già usato ovunque ed è il miglior rapporto qualità/prezzo
- La complessità di gestire 5 API key, 5 fallback, 5 formati di risposta diversi supera il beneficio
- L'architettura attuale con **1 gateway + selezione modello per qualità** è già ottimale

**Cosa serve invece:** Un sistema di **procedure operative** che l'AI consulta per guidare l'utente, non più agenti.

### Design: Operations Procedures Knowledge Base

Creare un file `src/data/operationsProcedures.ts` che contiene tutte le procedure operative del sistema, strutturate come oggetti tipizzati:

```text
Procedura {
  id: "send_email_campaign"
  name: "Invio Campagna Email"
  tags: ["email", "outreach", "campagna", "invio"]
  category: "outreach" | "network" | "crm" | "enrichment" | "import" | "agenda"
  channels: ["email"]
  
  prerequisites: [
    { check: "ai_profile_configured", label: "Profilo AI configurato", path: "/settings" },
    { check: "has_recipients", label: "Destinatari selezionati con email valida" },
    { check: "goal_defined", label: "Obiettivo commerciale definito" }
  ]
  
  steps: [
    { order: 1, action: "Seleziona destinatari", tool: "search_partners/search_contacts", detail: "..." },
    { order: 2, action: "Definisci obiettivo", tool: null, detail: "Goal Bar nel Workspace" },
    { order: 3, action: "Genera contenuto", tool: "generate_outreach/generate_email", detail: "..." },
    { order: 4, action: "Revisiona e approva", tool: null, detail: "Cockpit tab REVISIONA" },
    { order: 5, action: "Invia", tool: "send_email/process_email_queue", detail: "..." }
  ]
  
  related_pages: ["/cockpit", "/workspace", "/email-composer"]
  ai_tools_required: ["search_partners", "generate_outreach", "send_email"]
  tips: ["Usa quality 'premium' per email importanti", "Verifica blacklist prima dell'invio"]
}
```

### Procedure da Codificare (catalogo completo)

**Outreach (6 procedure):**
1. `email_single` — Email singola a un partner/contatto
2. `email_campaign` — Campagna email massiva
3. `linkedin_message` — Messaggio LinkedIn
4. `whatsapp_message` — Messaggio WhatsApp
5. `sms_message` — SMS
6. `multi_channel_sequence` — Sequenza multi-canale

**Network (5 procedure):**
7. `scan_country` — Scansione directory per paese
8. `download_profiles` — Download profili WCA
9. `download_single` — Download singolo partner
10. `deep_search_partner` — Ricerca approfondita partner
11. `enrich_website` — Arricchimento sito web

**CRM (5 procedure):**
12. `import_contacts` — Importazione contatti da file
13. `deep_search_contact` — Ricerca approfondita contatto
14. `update_lead_status` — Aggiornamento stato lead
15. `export_contacts` — Esportazione contatti CSV
16. `assign_activity` — Assegnazione attività

**Agenda (3 procedure):**
17. `create_followup` — Creazione follow-up
18. `schedule_meeting` — Pianificazione meeting
19. `manage_reminders` — Gestione reminder

**Sistema (3 procedure):**
20. `generate_aliases` — Generazione alias AI
21. `blacklist_check` — Verifica blacklist
22. `bulk_update` — Aggiornamento massivo

### Integrazione nel System Prompt dell'AI

Iniettare le procedure nel prompt dell'`ai-assistant` come sezione dedicata:

```text
PROCEDURE OPERATIVE DISPONIBILI

Quando l'utente chiede di fare qualcosa, CONSULTA questa sezione per:
1. Identificare la procedura corretta
2. Verificare i prerequisiti (e avvisare se mancano)
3. Guidare l'utente step-by-step
4. Usare i tool giusti nell'ordine giusto

[Procedure JSON serializzate e compresse]
```

### Dettaglio Tecnico dei File da Modificare

**1. `src/data/operationsProcedures.ts`** — NUOVO
- Definizione TypeScript di tutte le 22 procedure
- Ogni procedura con prerequisiti verificabili, step ordinati, tool mapping
- Export di funzioni helper: `findProcedure(tags)`, `getProceduresByCategory()`, `getPrerequisiteChecks()`

**2. `supabase/functions/ai-assistant/index.ts`** — Modifica System Prompt
- Aggiungere sezione "PROCEDURE OPERATIVE" al prompt con le procedure serializzate
- Aggiungere tool `get_procedure` per consultare procedure specifiche a runtime
- Aggiungere logica di prerequisite-check: prima di eseguire un workflow, l'AI verifica che le condizioni siano soddisfatte (es. profilo AI configurato, credenziali WCA presenti)

**3. `src/components/home/HomeAIPrompt.tsx`** — Suggerimenti contestuali
- Usare le procedure per generare suggerimenti intelligenti basati sullo stato del sistema (es. "Hai 50 partner senza email — vuoi avviare una Deep Search?")

### Cosa NON fare

- NON aggiungere provider AI diversi (Anthropic, Grok, Qwen): il gateway Lovable già ottimizza il routing
- NON creare agenti separati per ogni procedura: un singolo orchestratore con procedure codificate è più affidabile
- NON duplicare la Sales KB: le procedure operative sono complementari, non sostitutive

