# Liberare l'AI Query Planner — meno binari, più intelligenza

## Il problema

Hai ragione: oggi il sistema "guida" l'AI invece di darle libertà. Tre sintomi concreti nel codice attuale:

1. **`ai-query-planner/index.ts`** ha uno `SYSTEM_PROMPT` di ~170 righe con:
   - Schema DB **duplicato a mano** (già esiste in `dbSchema.ts`, è copia-incolla disallineabile).
   - **15+ esempi rigidi** ("partner US attivi", "ultimi 20 prospect", "e a Miami?", ecc.) che insegnano frasi invece di principi.
   - **Regole specifiche per `campaign_jobs.status`** scritte nel prompt ("attive → pending+in_progress", "draft → pending"...).
   - Mappature paesi hardcoded ("USA→US, Cina→CN...").

2. **`aiQueryTool.ts`** ha logica di patching reattiva:
   - `normalizeCampaignStatusPrompt()` riscrive il prompt utente.
   - Blocco `if (plan.table === "campaign_jobs")` che ri-applica i filtri **dopo** la risposta dell'AI.
   - `try/catch` che fabbrica una tabella vuota fittizia se l'enum è sbagliato.

3. **`dbSchema.ts`** è **statico**. Quando aggiungi una colonna al DB (es. `city` su `imported_contacts`), il planner la rifiuta finché qualcuno non aggiorna il file TS a mano. Da qui l'errore `Colonna filtro "city" non valida`.

Risultato: ogni nuovo caso d'uso = nuova patch hardcoded. L'AI non può "ragionare", può solo seguire i binari che le abbiamo posato.

## Doctrine di riferimento

Già in memoria (`mem://architecture/ai-prompt-freedom-doctrine`):
> Diamo guardrail (cosa NON può fare, in codice), non binari (cosa DEVE dire, nei prompt).
> Vietato: liste di frasi, esempi step-by-step, doctrine duplicate, formato output rigido se non strettamente richiesto.

Questo piano applica quella dottrina al Query Planner.

## Cosa cambia

### 1. Schema vivo dal DB (non più hardcoded)

Nuova edge function condivisa `_shared/liveSchemaLoader.ts` che, alla cold-start dell'edge, interroga `information_schema.columns` + `pg_enum` per costruire lo schema reale. Cache 5 minuti in memory.

- Niente più `SCHEMA_TEXT` copia-incolla in `ai-query-planner/index.ts`.
- Niente più `DB_SCHEMA` array statico in `dbSchema.ts` (resta solo `ALLOWED_TABLES` come whitelist di sicurezza + i `searchable` hint opzionali).
- Quando aggiungi una colonna al DB, l'AI la vede al prossimo refresh cache. Zero modifiche TS.

L'AI riceve lo schema reale + valori enum reali + quali colonne sono nullable. Decide lei.

### 2. System prompt minimale (~30 righe vs ~170)

Nuovo prompt, solo:
- **Identità**: "Sei un Query Planner SELECT-only su un CRM logistico."
- **Schema** (iniettato dinamico).
- **Output JSON** schema obbligatorio.
- **Guardrail tecnici**: solo SELECT, solo tabelle in whitelist, limit ≤ 200, operatori ammessi.
- **Principio aperto**: "Se la richiesta è ambigua o vuota, decidi tu la tabella più probabile e spiega in `rationale`. Se nessuna tabella è plausibile, restituisci `table:'INVALID'` con motivazione."

**Eliminati**: tutti gli esempi rigidi, le regole su `campaign_jobs.status`, le mappature paesi hardcoded. L'AI vede gli enum reali nello schema e si arrangia.

### 3. Eliminare patching reattivo nel tool

Da `aiQueryTool.ts` rimuovo:
- `normalizeCampaignStatusPrompt()` — l'AI vede gli enum, scegli lei.
- Il blocco `if (plan.table === "campaign_jobs")` post-pianificazione.
- Il `try/catch` che fabbrica tabelle vuote fake.

In caso di errore enum, ritorna l'errore vero al chiamante; il `localResultFormatter` già gestisce zero-result in modo umano (memoria precedente).

### 4. Contesto utente nel prompt

Oggi il planner riceve solo `prompt + history + contextHint`. Aggiungo:
- **Lista compatta delle tabelle whitelisted con purpose** (1 riga ciascuna).
- **Hint sull'ultima query riuscita** (già c'è via `contextHint`, ma lo formalizzo).
- **Conteggi rough** (opzionale, fase 2): "partners ha ~25k record, campaign_jobs ha N record con status [...]" — così l'AI sa se vale la pena cercare.

### 5. Guardrail in codice (non nel prompt)

Spostiamo le **vere** regole hard in `safeQueryExecutor.ts`:
- Whitelist tabelle ✅ (già c'è).
- Whitelist operatori ✅ (già c'è).
- Cap limit 200 ✅ (già c'è).
- Validazione colonne contro lo **schema vivo** (non più array TS).
- Validazione valori enum contro `pg_enum` (errore chiaro se l'AI sbaglia, non patch silenziose).

## Architettura post-refactor

```text
User prompt
    │
    ▼
ai-query-planner (edge)
  ├─ SystemPrompt: 30 LOC (identità + schema vivo + output JSON + guardrail)
  ├─ Schema: liveSchemaLoader() ← information_schema, cache 5min
  └─ Output: QueryPlan JSON
    │
    ▼
aiQueryTool.execute()
  ├─ NO normalize, NO patch
  └─ executeQueryPlan(plan)
        │
        ▼
safeQueryExecutor
  ├─ Validazione contro schema vivo
  ├─ Whitelist tabelle/operatori/limit
  └─ supabase.from() con RLS
```

## File toccati

**Nuovi**
- `supabase/functions/_shared/liveSchemaLoader.ts` — carica schema da `information_schema` + `pg_enum`, cache 5min, formatta per LLM.

**Modificati**
- `supabase/functions/ai-query-planner/index.ts` — system prompt da ~170 → ~30 LOC, usa `liveSchemaLoader`.
- `src/v2/ui/pages/command/tools/aiQueryTool.ts` — rimuovi `normalizeCampaignStatusPrompt`, rimuovi blocco campaign_jobs, rimuovi catch enum fittizio.
- `src/v2/agent/kb/dbSchema.ts` — riduco a `ALLOWED_TABLES` (whitelist sicurezza) + flag `searchable` opzionali. Niente più descrittori statici di colonne (vengono dal DB).
- `src/v2/ui/pages/command/lib/safeQueryExecutor.ts` — validazione colonne contro schema vivo (caricato lazy, cached client-side).

**Non toccati**
- `localResultFormatter.ts` (la gestione zero-results umana resta).
- `usePromptAnalysis.ts` (fast-lane resta).
- Tool d'azione (create/update/scrape...) — non c'entrano.

## Cosa aspettarsi dopo

- **"Mostra stato campagne attive"** quando il DB è vuoto → l'AI vede che `campaign_jobs.status` non ha record, risponde "Non ci sono campagne in nessuno stato al momento" senza messaggi di "errore tecnico".
- **"Cerca contatti a Milano"** → l'AI vede `imported_contacts.city` nello schema vivo, filtra. Nessuna modifica TS necessaria.
- **Nuova colonna aggiunta al DB** → disponibile all'AI entro 5 min (cache TTL), zero deploy.
- **Nuova tabella business** → basta aggiungerla a `ALLOWED_TABLES` (1 riga) e l'AI la conosce subito.

## Rischi e mitigazioni

- **Schema vivo + LLM = prompt più lungo**: lo schema reale ha più colonne di quelle "curate". Mitigato filtrando colonne `*_internal`, `*_secret`, e troncando a max 15 colonne per tabella ordinate per rilevanza (PK, name fields, status, date).
- **AI può scegliere colonne sensibili**: la whitelist tabelle resta. RLS Supabase fa il resto. Per colonne sensibili intra-tabella (es. token), aggiungo blacklist colonne in `safeQueryExecutor`.
- **Enum cambiati al volo**: cache 5min può servire enum vecchio per qualche minuto. Accettabile; se vogliamo zero lag aggiungiamo invalidazione su `pg_notify`.

Conferma che l'approccio è corretto e procedo con l'implementazione.
