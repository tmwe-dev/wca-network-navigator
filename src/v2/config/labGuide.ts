/**
 * Lab Guide — contenuti didattici per ogni tab del Lab Hub.
 *
 * SSOT: una entry per ogni `LAB_TABS[i].id`. Aggiungere una nuova tab in
 * `labTabs.ts` => aggiungere qui una entry con lo stesso id, oppure la
 * guida mostrerà uno stato vuoto "documentazione in arrivo".
 */

export interface LabGuideStep {
  readonly title: string;
  readonly body: string;
}

export interface LabGuideEntry {
  /** Stesso id di LAB_TABS */
  readonly id: string;
  /** Cosa fa, in una frase */
  readonly purpose: string;
  /** Perché esiste / problema che risolve */
  readonly why: string;
  /** Step operativi consigliati */
  readonly steps: readonly LabGuideStep[];
  /** Output atteso / artefatti prodotti */
  readonly expected: string;
  /** Dove modificare comportamento o configurazione */
  readonly editing: string;
  /** Avvertenze, limiti, side-effect noti */
  readonly caveats?: string;
}

export const LAB_GUIDE: readonly LabGuideEntry[] = [
  // ─── TESTS ───────────────────────────────────────────────
  {
    id: "scenari",
    purpose: "Esegue scenari AI deterministici end-to-end (prompt → tool → output) e mostra pass/fail.",
    why: "Verifica che gli orchestratori AI rispettino le aspettative dopo ogni modifica a prompt, capabilities o personas.",
    steps: [
      { title: "1. Seleziona scenari", body: "Spunta gli scenari da eseguire. 'Esegui tutti' lancia l'intera suite." },
      { title: "2. Avvia run", body: "Il pulsante chiama l'edge function di run; ogni scenario esegue agent-execute con prompt + tool whitelist registrati." },
      { title: "3. Leggi risultati", body: "Per ogni scenario vedi pass/fail, output AI, tool invocati, latency, costo token." },
      { title: "4. Edita scenari", body: "Crea/modifica scenari dal pulsante 'Nuovo': prompt, expected_contains, expected_tools." },
    ],
    expected: "Riga risultato per scenario con badge PASS/FAIL e summary 'X/N test passati'. Nessun side-effect su CRM o invii reali.",
    editing: "Tabella DB `ai_test_scenarios`. UI editor inline. Per cambiare il runner: edge function `run-ai-test-scenarios`.",
    caveats: "Gli scenari girano in dry-run: tool come send-email sono mockati. Costo token reale viene comunque consumato dal modello.",
  },
  {
    id: "ai-lab",
    purpose: "Sandbox per testare la generazione email (generate-email + journalistReview) su contatti reali senza inviare.",
    why: "Permette di iterare prompt/tono/KB e vedere subito l'output finale post-review editoriale.",
    steps: [
      { title: "1. Scegli partner/contatto", body: "Seleziona destinatario reale dal CRM per caricare il contesto completo." },
      { title: "2. Configura tipo + tono", body: "Tipo email, tono, KB on/off, brief strutturato e custom goal." },
      { title: "3. Genera", body: "Chiama generate-email via invokeAi (scope=lab). Mostra subject, body, review notes." },
      { title: "4. Itera", body: "Modifica brief/tono e rigenera. Confronta output." },
    ],
    expected: "Email completa (subject + body) già passata da journalistReview. Nessun invio, nessuna riga in `email_messages`.",
    editing: "Prompt operativi in DB `operative_prompts` (scope=email). Persone in `agent_personas`. Modifiche istantanee, no redeploy.",
    caveats: "L'AI consuma token. Non bypassare mai il journalistReview cambiando edge function: è un nodo critico.",
  },
  {
    id: "email-lab",
    purpose: "Cabina di iterazione su email già in produzione: vedi versioni, diff, simula classify Funnemail.",
    why: "Quando una campagna o una risposta classificata sembra sbagliata, qui ricostruisci l'intera pipeline.",
    steps: [
      { title: "1. Production tab", body: "Seleziona email reale; mostra payload inviato, prompt usato, versione prompt, output AI." },
      { title: "2. Iterations", body: "Confronta versioni successive con DiffView. Capisci cosa è cambiato e perché." },
      { title: "3. Funnemail tab", body: "Incolla un'email inbound: chiama simulate-funnemail-classify e mostra categoria, confidence, reasoning." },
    ],
    expected: "Diff testuale lato-lato fra versioni; classificazione simulata senza scrivere su DB.",
    editing: "Logica simulazione: edge function `simulate-funnemail-classify`. Hook stato: `useFunnemailSimulation`, `useEmailLabIterations`.",
    caveats: "Il simulator è read-only: non aggiorna `inbound_messages` né triggera escalation lead_status.",
  },
  {
    id: "extensions",
    purpose: "Verifica che le browser extension (Partner Connect, WA, LinkedIn, RA, Email) siano installate, autorizzate e raggiungibili dal webapp-bridge.",
    why: "Il sistema multichannel dipende dal bridge: senza estensioni non parte nulla su WA/LI.",
    steps: [
      { title: "1. Health check", body: "La pagina ping-a ogni extension via window.postMessage e mostra stato." },
      { title: "2. Versione", body: "Confronta versione installata vs attesa (manifest)." },
      { title: "3. Auth", body: "Verifica che `requireExtensionAuth` accetti il token corrente." },
    ],
    expected: "Tabella con badge OK/MISSING/STALE per estensione e ultima sincronizzazione.",
    editing: "Manifesti in `public/<ext>/manifest.json`. Bridge: `webapp-bridge.js`. Auth guard: `_shared/extensionAuth.ts`.",
    caveats: "Senza estensione installata sul browser, la pagina riporta MISSING: è normale, non è un errore di sistema.",
  },
  {
    id: "e2e",
    purpose: "Cruscotto degli ultimi run E2E Playwright (smoke + nightly).",
    why: "Vedere senza CLI quali flussi critici sono verdi: auth, onboarding, contact CRUD, campaign, agent chat.",
    steps: [
      { title: "1. Apri tab", body: "Mostra ultimi N run con pass/fail/durata per ogni spec." },
      { title: "2. Drill-down", body: "Click sul run apre traceback e screenshot Playwright." },
    ],
    expected: "Lista run con stato, durata, link al report HTML.",
    editing: "Spec in `e2e/`. Workflow: `.github/workflows/e2e-smoke.yml`, `e2e-nightly.yml`.",
    caveats: "Solo lettura: i run reali partono in CI o via `bunx playwright test` locale.",
  },

  // ─── PROMPTS ─────────────────────────────────────────────
  {
    id: "prompt-lab",
    purpose: "Editor live dei prompt operativi caricati da DB (`operative_prompts`).",
    why: "Ogni edge function AI passa da `operativePromptsLoader`: modificare qui = effetto immediato senza redeploy.",
    steps: [
      { title: "1. Filtra per scope", body: "scope = email/outreach/classification/agent_loop/…" },
      { title: "2. Apri prompt", body: "Vedi system + user template, variabili attese, tag." },
      { title: "3. Edita e salva", body: "Salvataggio crea automaticamente snapshot in `prompt_versions` (trigger DB)." },
      { title: "4. Test rapido", body: "Tab Simulator (vedi sotto) per dry-run senza spendere token su flussi reali." },
    ],
    expected: "Prompt aggiornato e versionato. Loader serve la nuova versione alla prossima chiamata AI.",
    editing: "Tabella `operative_prompts` + versioning automatico via trigger.",
    caveats: "Modifiche entrano in produzione subito. Per rollback: helper SQL `rollback_prompt_to_version(id, version)`.",
  },
  {
    id: "prompt-catalog",
    purpose: "Vista catalogo: ogni prompt con versione, autore, orchestratori che lo usano, input attesi.",
    why: "Capire chi usa cosa prima di toccare un prompt e propagare effetti collaterali.",
    steps: [
      { title: "1. Sfoglia catalogo", body: "Tabella unificata. Filtra per orchestratore o tag." },
      { title: "2. Apri scheda", body: "Mostra mapping CONTEXT_TO_ORCHESTRATORS e edge functions consumatrici." },
    ],
    expected: "Mappa di dipendenze prompt ↔ orchestratore.",
    editing: "DAL `listPromptCatalog`. Mapping in `src/v2/data/promptCatalogMapping.ts`.",
  },
  {
    id: "prompt-tests",
    purpose: "Test di regressione sui prompt: dato input X, output deve contenere Y / non contenere Z.",
    why: "Evitare regressioni quando si tocca un prompt usato da più flussi.",
    steps: [
      { title: "1. Seleziona prompt + casi", body: "Prendi i `prompt_test_cases` collegati al prompt." },
      { title: "2. Run", body: "Edge function `prompt-test-runner` esegue ogni caso e salva in `prompt_test_runs`." },
      { title: "3. Diff vs baseline", body: "Confronta output con expected; segnala drift." },
    ],
    expected: "Report PASS/FAIL per caso + snapshot output.",
    editing: "Tabelle `prompt_test_cases`, `prompt_test_runs`. Runner: edge function `prompt-test-runner`.",
    caveats: "I run consumano token reali del modello configurato sul prompt.",
  },
  {
    id: "prompt-atlas",
    purpose: "Mappa visiva degli agenti, dei loro prompt, capabilities e personas.",
    why: "Vedere a colpo d'occhio l'architettura cognitiva del sistema.",
    steps: [
      { title: "1. Seleziona agente", body: "Pannello con system prompt, persona, tool whitelist." },
      { title: "2. Esplora dipendenze", body: "Click su un nodo apre il prompt o la capability." },
    ],
    expected: "Grafo / lista navigabile di agenti e relazioni.",
    editing: "Tabelle `agent_capabilities`, `agent_personas`, `operative_prompts`.",
  },
  {
    id: "prompt-suggest",
    purpose: "Coda di suggerimenti AI per migliorare i prompt esistenti (agent-prompt-refiner).",
    why: "Loop di apprendimento continuo: l'AI propone, l'umano approva.",
    steps: [
      { title: "1. Apri suggerimento", body: "Mostra prompt attuale, proposta, motivazione." },
      { title: "2. Approva o scarta", body: "Approve crea una nuova versione; reject archivia." },
    ],
    expected: "Nessuna modifica al prompt finché un umano non approva.",
    editing: "DAL suggerimenti + edge function `agent-prompt-refiner`.",
    caveats: "Le proposte non vengono mai applicate automaticamente: governance umana obbligatoria.",
  },
  {
    id: "prompt-proposals",
    purpose: "Proposte di nuovi prompt o cambi strutturali, da review umana.",
    why: "Differisce da Suggestions perché qui si valutano interi prompt, non micro-edit.",
    steps: [
      { title: "1. Lista proposte", body: "Filtra per stato: pending / approved / rejected." },
      { title: "2. Diff", body: "Confronta proposta vs prompt corrente." },
      { title: "3. Decidi", body: "Approve = nuovo prompt + version. Reject = archivio con motivo." },
    ],
    expected: "Audit trail completo della decisione.",
    editing: "Tabella `prompt_proposals`.",
  },
  {
    id: "prompt-reader",
    purpose: "Visualizzatore read-only del prompt finale risolto (con variabili sostituite).",
    why: "Debug: capire esattamente cosa l'AI ha visto in un'invocazione.",
    steps: [
      { title: "1. Inserisci scope + variabili", body: "Loader simula `loadOperativePrompts(scope, tag)`." },
      { title: "2. Vedi output finale", body: "System + user message renderizzati come arrivano al modello." },
    ],
    expected: "Prompt completo, sanitized, già passato dal sanitizer di injection.",
    editing: "Loader: `_shared/operativePromptsLoader.ts`. Sanitizer: `_shared/promptSanitizer.ts`.",
  },
  {
    id: "brand-voice",
    purpose: "Definizione del tono di voce aziendale iniettato nei prompt commerciali.",
    why: "Garantire coerenza stilistica su email, WA, LinkedIn anche cambiando agente.",
    steps: [
      { title: "1. Modifica voce", body: "Tono, parole-chiave preferite, parole vietate, esempi." },
      { title: "2. Salva", body: "Iniezione attiva su prossima generazione." },
    ],
    expected: "Le email generate dopo il salvataggio rispettano il nuovo tono.",
    editing: "Tabella `brand_voice_profiles`. Iniezione in `agent-execute/contextInjection`.",
  },

  // ─── OBSERVABILITY ───────────────────────────────────────
  {
    id: "diagnostica",
    purpose: "Check-up rapido del sistema: env vars, secrets, connettività edge, RLS sane.",
    why: "Primo posto da aprire quando 'qualcosa non va' senza errori chiari.",
    steps: [
      { title: "1. Run check", body: "Esegue una serie di probe lato edge + DB." },
      { title: "2. Leggi badge", body: "Verde = OK, giallo = warning, rosso = blocking." },
    ],
    expected: "Snapshot stato sistema con suggerimento azione per ogni rosso.",
    editing: "Probe in `_shared/diagnostics/*` + edge function `system-diagnostics`.",
  },
  {
    id: "telemetria",
    purpose: "Metriche aggregate: chiamate edge, errori, latenza, costo AI.",
    why: "Capire trend e individuare regressioni di performance/costo.",
    steps: [
      { title: "1. Scegli periodo", body: "24h / 7g / 30g." },
      { title: "2. Drill per edge function", body: "Vedi p50/p95, error rate, costo." },
    ],
    expected: "Grafici time-series + tabella per edge function.",
    editing: "Tabella `edge_metrics`. Logger: `_shared/structuredLogger.ts`.",
  },
  {
    id: "observability",
    purpose: "Dashboard SLO + alert routing live.",
    why: "Vista executive sull'affidabilità del sistema.",
    steps: [
      { title: "1. Vedi SLO correnti", body: "Burn rate, error budget residuo." },
      { title: "2. Alert attivi", body: "Lista incident aperti." },
    ],
    expected: "Stato salute aggregato.",
    editing: "Config SLO in `src/v2/observability/`. Alert: `Alert Routing` tab.",
  },
  {
    id: "health",
    purpose: "System Health Dashboard: stato infrastrutturale (DB, edge, queue, cron).",
    why: "Diagnosi infra prima di toccare codice.",
    steps: [
      { title: "1. Apri dashboard", body: "Mostra heartbeat, queue depth, cron lag." },
    ],
    expected: "Indicatori infra in tempo reale.",
    editing: "Component `SystemHealthDashboard`.",
  },
  {
    id: "alert-routing",
    purpose: "Configurazione regole di routing degli alert (Discord, email, livelli).",
    why: "Decidere chi viene svegliato e quando.",
    steps: [
      { title: "1. Crea regola", body: "Match per source/severity → destinazione." },
      { title: "2. Test invio", body: "Pulsante 'Test' manda alert finto al canale scelto." },
    ],
    expected: "Regole salvate e attive immediatamente.",
    editing: "Tabella `alert_routing_rules`. Dispatcher: edge `dispatch-alert`.",
    caveats: "Test invio consuma quota Discord/email reale.",
  },
  {
    id: "ai-log",
    purpose: "AI Interaction Log: ogni chiamata AI con scope, modello, costo, feedback umano.",
    why: "Audit completo + thumbs up/down per training futuro.",
    steps: [
      { title: "1. Filtra", body: "Per scope, modello, esito." },
      { title: "2. Espandi riga", body: "Vedi prompt, output, tool invocati." },
      { title: "3. Feedback", body: "Thumbs up/down salvato in `ai_message_feedback`." },
      { title: "4. Export", body: "CSV/JSON per analisi offline." },
    ],
    expected: "Tabella paginata + export.",
    editing: "Tabelle `ai_interaction_log`, `ai_message_feedback`. DAL `logAiInteraction`.",
  },
  {
    id: "pipeline-traces",
    purpose: "Trace end-to-end di pipeline (es. inbound email → classify → escalate → notify).",
    why: "Capire dove una pipeline si è fermata o ha rallentato.",
    steps: [
      { title: "1. Cerca trace", body: "Per id pipeline o per messaggio." },
      { title: "2. Timeline", body: "Step ordinati con durata e stato." },
    ],
    expected: "Timeline visuale + payload per step.",
    editing: "Tabella `pipeline_traces`. Emitter: `_shared/pipelineTracer.ts`.",
  },
  {
    id: "token-cockpit",
    purpose: "Cockpit consumo token AI: per modello, per scope, per giorno.",
    why: "Tenere sotto controllo il costo AI senza abilitare i guard rate-limit (disattivati per uso interno).",
    steps: [
      { title: "1. Filtra periodo", body: "Vedi token in/out e costo USD stimato." },
      { title: "2. Top scope", body: "Identifica gli scope più costosi." },
    ],
    expected: "Dashboard costi.",
    editing: "Aggregati da `ai_interaction_log`.",
    caveats: "I limit AI sono OFF (kill-switch `AI_USAGE_LIMITS_ENABLED`). Usa il cockpit come fonte verità.",
  },

  // ─── DESIGN ──────────────────────────────────────────────
  {
    id: "design",
    purpose: "Galleria del Design System V2: token colore, tipografia, atomi, molecole.",
    why: "Riferimento unico per costruire UI coerente, niente colori hardcoded.",
    steps: [
      { title: "1. Sfoglia atomi", body: "Button, Input, Badge, Card con tutte le varianti." },
      { title: "2. Copia esempio", body: "Snippet pronto per la pagina target." },
    ],
    expected: "Showcase visivo, nessuna business logic.",
    editing: "Token in `index.css` + `tailwind.config.ts`. Atomi in `src/v2/ui/atoms/`.",
    caveats: "Vietato hardcodare hex/rgb nei componenti: usare sempre token semantici.",
  },
] as const;

export function getLabGuide(id: string | null | undefined): LabGuideEntry | undefined {
  if (!id) return undefined;
  return LAB_GUIDE.find((g) => g.id === id);
}