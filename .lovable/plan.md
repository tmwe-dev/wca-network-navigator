## Obiettivo

Far sì che Command **converse sempre** e mostri sempre il canvas per le query di routine, eliminando la dipendenza dall'AI gateway (causa dei 429 "Troppe richieste") per conteggi ed elenchi standard.

## Causa radice confermata

Ogni interazione fa **2 chiamate AI** che vengono strozzate (429):
1. `ai-query-planner` → su 429 ritorna piano `INVALID` → canvas "Richiesta non supportata · 0 risultati".
2. `ai-assistant` (commento) → su 429 scatta `fallbackComment` → "Risultato disponibile nel canvas" senza voce.

Il piano deterministico locale attuale copre SOLO `partner + paese`, quindi qualsiasi variante ("pannelli", refusi, dettato) ricade sull'AI e prende 429.

## Principio (Codex)

Modifica **minima, locale, reversibile** su UN nodo: il parser di intento. Niente refactor opportunistici, niente tocchi a submit/batch/memoria/edge.

## Intervento

### 1. Generalizzare il parser deterministico (`aiQueryTool.ts`)
Estrarre `deterministicPartnerCountryPlan` in un piccolo **`localIntentParser`** che riconosce, senza AI:
- **Entità**: partner, contatti, prospect, attività, messaggi (sinonimi + tolleranza refusi/dettato).
- **Filtro geografico**: paese (mappa esistente) o città.
- **Intento**: conteggio vs elenco.

Se il parser riconosce entità+intento → costruisce il `QueryPlan` localmente e **salta del tutto il planner AI**. Questo copre l'80% delle query operative e le rende immuni al 429.

### 2. Degradare il planner AI con retry, non con "non supportata"
In `aiQueryTool.execute`, quando `planQuery` torna rate-limited:
- 1 retry con piccolo backoff (es. 1.2s);
- se ancora 429, fallback al `localIntentParser` (best-effort) invece di mostrare "Richiesta non supportata".

### 3. Commento sempre presente anche senza AI
`useResultCommentary` già prova il formatter locale per `ai-query`. Assicurare che quando il piano è deterministico il **commento locale** (dato + proposta + voce) venga sempre generato, così la voce parla anche durante i 429 del commentatore.

## Cosa NON tocco
- Edge functions (`ai-query-planner`, `ai-assistant`, `tts`).
- Logica submit, batch email, memoria/history, dedup, RLS.
- `safeQueryExecutor`, governance, audit.

## Verifica prima di "fatto"
- "quanti partner abbiamo a Malta" → conteggio + canvas + voce (deterministico).
- "quanti pannelli abbiamo Malta" (refuso) → riconosciuto come partner → canvas + voce.
- Query non-standard → planner AI con retry; su 429 persistente, fallback locale invece di "non supportata".
- Nessun side-effect duplicato, ordine messaggi invariato.

## Sezione tecnica
- File toccati: `src/v2/ui/pages/command/tools/aiQueryTool.ts` (estrazione parser + retry), eventualmente un nuovo `lib/localIntentParser.ts`, e ritocco minimo a `hooks/useResultCommentary.ts` solo se il commento locale non scatta sul piano deterministico.
- Nessuna migrazione DB, nessun deploy edge.
