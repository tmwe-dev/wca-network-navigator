## Obiettivo

Due interventi distinti, indipendenti, sullo stesso preview:

1. **Migliora tutto**: 5 fix mirati che riducono salvataggi inutili, classificazioni sbagliate, payload doppi e missione hardcoded. Il flusso resta identico (raccogli blocchi → riscrivi → review → salva).
2. **Armonizzatore**: aggiunta di una pipeline di ingestione a sessione persistente per la libreria TMWE (5.708 righe / ~81K token), processata in 7 chunk sequenziali con stato (`facts_registry`, `conflicts`, `cross_references`, `entities_created`) trasportato tra un chunk e l'altro.

Nessuna modifica al motore Lab Agent sottostante. Le due aree restano separate, con UI separate.

---

## PARTE 1 — MIGLIORA TUTTO (fix chirurgici)

### Fix A4 — Propagare `tabActivation` nel primo run
File: `src/v2/ui/pages/prompt-lab/hooks/useGlobalPromptImprover.ts` (riga 285 e 334).
- In `initial: GlobalProposal[]`, valorizzare `tabActivation` con lookup in `PROMPT_LAB_TABS` (già usato in `useProposalProcessing.ts::activationFor`).
- Passare `tabActivation: p.tabActivation` nella chiamata `lab.improveBlockGlobal` del primo run (oggi è solo nel resume).

### Fix A2 — Parsing OUTCOME_TYPE robusto
File: `src/v2/ui/pages/prompt-lab/hooks/useLabAgent.ts` funzione `parseImproveResponse` (riga 30-53).
- Sostituire il loop `Math.min(lines.length, 5)` con regex multilinea sull'intera stringa: `/^OUTCOME_TYPE:\s*(\w+)\s*$/m` e `/^ARCHITECTURAL_NOTE:\s*(.+)$/m`.
- Rimuovere le righe matchate dal testo finale invece di affidarsi a `textStartIdx`.

### Fix A1 — Delta threshold su skip
File: `useGlobalPromptImprover.ts` (riga 194-195 nel resume e 345-346 nel primo run).
- Aggiungere helper `computeChangeRatio(before, after): number` (Levenshtein normalizzata o ratio word-diff veloce; basta `Math.abs(after.length - before.length) / Math.max(before.length, 1)` + check token-level).
- Estendere lo stato `GlobalProposal` (in `useProposalProcessing.ts`) con un nuovo status `"minor_change"`.
- Logica: se `parsed.outcomeType === "no_change"` o `isSame` → `skipped`; se `changeRatio < 0.05` → `minor_change`; altrimenti `ready`.
- `HarmonizeReviewPanel` / `GlobalImproverDialog` (verifico nome esatto): mostrare badge distinto per `minor_change` e disattivarlo di default nella selezione "salva" (ma lasciare l'utente libero di attivarlo).

### Fix A3 — Retry compatto
File: `useLabAgent.ts` funzioni `improveBlock` (riga 595-607) e `improveBlockGlobal` (riga 692-702).
- Nuovo helper `buildRetryPrompt(blockContent, violations, contextHint)` che invia: testo originale del blocco + violazioni + un riassunto a 1 riga del briefing (no system map, no doctrine completa, no rubric ripetuta).
- Sostituire la concatenazione `${userPrompt}\n--- VIOLAZIONI ---` con questo payload compatto. Risparmio atteso: ~70-80% del token retry.

### Fix B3 — `SYSTEM_MISSION` da `app_settings`
File: `useGlobalPromptImprover.ts` riga 35-39.
- Spostare la costante in `app_settings` con chiave `system_mission_text` (default = la stringa attuale come fallback).
- Helper `loadSystemMission()` async dentro `useGlobalPromptImprover` chiamato all'inizio di `startImprovement` e `resumeRun`.
- Aggiungere campo readonly nella tab "AI Profile" (`AIProfileTab.tsx`) per modificarlo dal Prompt Lab senza deploy.

---

## PARTE 2 — ARMONIZZATORE: pipeline ingestione TMWE

### Scopo
L'Armonizzatore oggi processa gap actionable in chunk da 6 (`harmonizeAnalyzer.ts::CHUNK_SIZE = 6`), ma NON ha:
- una sessione persistente che accumula fatti tra chunk diversi,
- la capacità di processare un documento sorgente lungo (5.708 righe) senza riniziare da zero a ogni call,
- un protocollo per pre-caricare conflitti/duplicati noti.

Aggiungiamo una **pipeline parallela** dedicata all'ingestione di sorgenti grandi, che riusa l'attuale executor ma sostituisce collector + analyzer con varianti session-aware.

### 2.1 — Nuova tabella DB: `harmonizer_sessions`
Migration:
```sql
create table public.harmonizer_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null,
  source_file text not null,
  source_kind text not null default 'library',  -- 'library' | 'mission_output' | 'email_attachment'
  total_chunks integer not null,
  current_chunk integer not null default 0,
  status text not null default 'pending',       -- pending|in_progress|completed|error
  facts_registry jsonb not null default '{}'::jsonb,
  conflicts_found jsonb not null default '[]'::jsonb,
  cross_references jsonb not null default '[]'::jsonb,
  entities_created jsonb not null default '[]'::jsonb,
  errors jsonb not null default '[]'::jsonb,
  harmonize_run_id uuid references public.harmonize_runs(id) on delete set null,
  started_at timestamptz default now(),
  last_chunk_completed_at timestamptz,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.harmonizer_sessions enable row level security;
create policy "Users manage own harmonizer sessions"
  on public.harmonizer_sessions for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);
```

Nuovo DAL: `src/data/harmonizerSessions.ts` con `createSession`, `loadSession`, `appendFacts`, `appendConflicts`, `appendEntities`, `advanceChunk`, `markError`, `complete`.

### 2.2 — Definizione 7 chunk: `src/v2/ui/pages/prompt-lab/harmonizer/tmweChunks.ts`
File nuovo che dichiara la mappa:
```ts
export interface TmweChunkDef {
  index: number;        // 0..6
  name: string;         // "KB Core", "Agenti Doer", ...
  sourceLines: [number, number];
  preloadedConflicts: ConflictEntry[];
  preloadedDuplicates: DuplicateEntry[];
  contractGuidance: string;  // istruzioni dettagliate per il modello
}
export const TMWE_CHUNKS: TmweChunkDef[] = [/* i 7 chunk con i confini di riga indicati */];
export const TMWE_EXECUTION_ORDER = [0, 2, 1, 4, 3, 5, 6]; // 1→3→2→5→4→6→7
```

### 2.3 — Nuovo collector: `harmonizerLibraryCollector.ts`
Funzione `runLibraryChunkCollector(sourceText, chunkDef, sessionState)`:
- Estrae le righe del chunk dal sorgente (passato come `string` da `ParsedFile`).
- Carica inventario reale FILTRATO sulle tabelle target del chunk (es. solo `kb_entries` per chunk 1, solo `operative_prompts` + `commercial_playbooks` per chunk 3).
- Usa `sessionState.entities_created` per marcare come "già esistente" ciò che chunk precedenti hanno inserito (evita re-INSERT).
- Applica `preloadedDuplicates` per skip automatico.
- Restituisce `CollectorOutput` compatibile con l'analyzer.

### 2.4 — Analyzer session-aware: `harmonizerLibraryAnalyzer.ts`
Variante di `harmonizeAnalyzer.ts`:
- Riceve `sessionState` come parametro.
- Aggiunge al `userPrompt` una sezione `=== STATO SESSIONE PRECEDENTE ===` con: facts_registry compatti (top 30 fatti), conflicts già aperti (titolo+stato), entities_created (lista titoli+id+tabella).
- Aggiunge sezione `=== CONFLITTI/DUPLICATI PRE-CARICATI PER QUESTO CHUNK ===` da `chunkDef`.
- Estende lo schema Zod con campi opzionali: `extracted_facts: Record<string,string>`, `new_conflicts: ConflictEntry[]`, `cross_references: CrossRef[]`.
- Dopo il parse, ritorna sia le `HarmonizeProposal[]` sia il delta di stato sessione da accumulare.

### 2.5 — Nuovo orchestratore: `useHarmonizerLibraryIngestion.ts`
Hook separato (NON modifica `useHarmonizeOrchestrator.ts`):
- Input: `{ sourceFile: ParsedFile, goal: string }`.
- Crea `harmonizer_sessions` row + un `harmonize_runs` figlio per l'esecuzione finale.
- Loop su `TMWE_EXECUTION_ORDER`:
  1. Carica `sessionState`.
  2. Esegue collector → analyzer (session-aware) per il chunk corrente.
  3. Persiste proposte in `harmonize_runs.proposals`.
  4. Aggiorna `sessionState` con nuovi facts/conflicts/cross_refs.
  5. Avanza `current_chunk`.
  6. UI: callback `onChunkComplete(chunkIndex, summary)`.
- Su errore: salva in `errors[]`, NON avanza il chunk, espone `retryChunk()` idempotente.
- A fine pipeline: passa il controllo all'UI di review esistente (`HarmonizeReviewPanel`) — l'utente approva e l'executor attuale (`harmonizeExecutor.ts`) esegue.

### 2.6 — UI: pulsante "Ingerisci libreria" in `HarmonizeSystemDialog`
Aggiungere modalità duale nel dialog esistente:
- Tab "Modalità classica" → flow attuale (analizza tutto il DB vs libreria breve).
- Tab "Ingestione documento grande" → carica file (drag&drop), seleziona protocollo (es. "TMWE Library"), avvia pipeline 7-chunk.
- Progress bar a 7 step con label del chunk corrente + counter facts/conflicts/entities.
- Banner di sessione ripresabile se esiste una `harmonizer_sessions` con `status='in_progress'` per l'utente.

### 2.7 — Briefing dedicato: `tmwe-ingestion-briefing.ts`
In `src/v2/agent/prompts/core/`:
- Riusa `HARMONIZER_BRIEFING` come base.
- Aggiunge sezioni: gerarchia destinazioni (kb_entries vs operative_prompts vs commercial_playbooks vs agent_personas), regole su `facts_registry` (estrai SOLO fatti numerici e dichiarazioni canoniche), regole su detection conflitti (formato `ConflictEntry`), regole su skip duplicati noti.
- Spiega il dominio: TMWE = azienda di Luca, libreria = KB interna che alimenta il Brain WCA.

### 2.8 — Report finale
A fine pipeline, l'orchestratore genera un sommario testuale (rendered in un modal):
- Chunk completati (X/7), errori per chunk
- N kb_entries / operative_prompts / playbooks / agent_personas creati
- N conflitti aperti (con dettaglio top 10)
- N duplicati skippati
- Azioni richieste a Luca (lista conflitti `pending`)
- Pulsante "Vai a review proposte" → apre `HarmonizeReviewPanel` con il `harmonize_run_id` figlio.

---

## Dettagli tecnici (per chi implementa)

- Tutto il codice nuovo in `src/v2/ui/pages/prompt-lab/harmonizer/` (nuova subdir) per non inquinare `hooks/`.
- `harmonizerLibraryAnalyzer` riusa `callHarmonizer` e `parseProposalsFromText` esportandoli da `harmonizeAnalyzer.ts`.
- `harmonizer_sessions.facts_registry` cap a ~30KB JSON per evitare blow-up; se supera → consolidamento (top-priority facts).
- I 7 chunk sono dichiarativi: l'utente carica lo `.md`, il sistema legge `chunkDef.sourceLines` e fa lo slice in client-side. Niente parsing AI per delimitarli.
- Le 5 fix di "Migliora tutto" sono indipendenti dalla Parte 2 e possono essere committate prima.
- Nessuna nuova edge function: tutto il flusso passa per `unified-assistant` con briefing diversi.

## Cosa NON viene fatto in questo piano (esplicito)

- Nessuna modifica all'executor (`harmonizeExecutor.ts`): l'esecuzione finale resta identica.
- Nessuna pipeline universale per documenti generici (mission output, email attachments) — quella resta come piano futuro, qui ci si focalizza solo su TMWE library.
- Nessuna nuova tabella per `kb_chunks` o storage di chunk parsati: il sorgente vive solo come ParsedFile in memoria + riferimento in `harmonizer_sessions.source_file`.
- Nessun cambiamento a `useGlobalPromptImprover.saveAccepted` / `useProposalSaver`.

## Ordine di implementazione consigliato

1. Migration `harmonizer_sessions` + DAL.
2. Tutte le 5 fix di "Migliora tutto" (commit unico, basso rischio).
3. `tmweChunks.ts` con la mappa dei 7 chunk e conflitti/duplicati pre-caricati.
4. `tmwe-ingestion-briefing.ts`.
5. `harmonizerLibraryCollector.ts` + `harmonizerLibraryAnalyzer.ts`.
6. `useHarmonizerLibraryIngestion.ts`.
7. UI: estensione di `HarmonizeSystemDialog` con tab dedicato + report finale.
8. Smoke test: caricare la libreria reale e processare i primi 2 chunk.