
L'utente vuole:
1. **Backup** della versione FireScrape attuale (funziona bene).
2. Trasformare Deep Search in **"Sherlock"** — un investigatore con 3 livelli di profondità.
3. Le istruzioni di ricerca devono stare in una **Knowledge Base modificabile** (non hardcoded).
4. L'AI deve assistere lo scraper: parsing intelligente + decidere prossimo step in base a cosa trova.
5. Esecuzione **sequenziale e iterativa**: una richiesta alla volta, raccogli, valuta, poi prossima.

## Cosa abbiamo già che funziona (NON toccare)

- `bridge.ts` → `fs.readUrl(url)` con `navigate` + `settleMs` + `scrape` top-level. Testato, allineato all'API estensione v3.4.0.
- `DeepSearchCanvas.tsx` → UI canvas con feed live, Stop, render markdown formattato, persistenza in `scrape_cache`.
- `scrape_cache` → tabella con TTL 7gg già attiva.
- 4 pipeline base (Google Maps, sito multi-pagina, reputation, Google generale).
- Gate timing LI/WA (Fase 1 piano precedente, da completare).

## Piano "Sherlock"

### 1. Backup versione corrente
- Copiare i 3 file chiave in `src/v2/io/extensions/_backup/2026-04-20-firescrape-v1/`:
  - `bridge.ts`, `deep-search-pipelines.ts`, `DeepSearchCanvas.tsx`
- README breve con data, contratto API estensione, screenshot di funzionamento.
- Memoria `mem://features/firescrape-baseline-2026-04-20` con riferimento al backup.

### 2. Nuova KB "Sherlock Playbooks" (DB + UI)

Tabella `sherlock_playbooks`:
```text
id | level (1|2|3) | name | description | is_active | sort_order
   | steps (jsonb) — array di step ordinati
   | target_fields (text[]) — es. {email, phone, role, linkedin}
   | created_at | updated_at | user_id
```

Ogni **step** in `steps`:
```text
{
  order: 1,
  label: "Scheda Google Maps",
  url_template: "https://google.com/maps/search/{companyName}+{city}",
  required_vars: ["companyName"],
  settle_ms: 3000,
  channel: "generic" | "linkedin" | "whatsapp",
  ai_extract_prompt: "Estrai indirizzo, telefono, sito, orari…",
  ai_decide_next: true | false,   // se true, AI può saltare step successivi
  depends_on: [step.order]        // opzionale
}
```

**3 livelli predefiniti** (seed):
- **Livello 1 — Scout** (~30s): solo Google Maps + sito home. Per validazioni rapide.
- **Livello 2 — Detective** (~2min): + sito multi-pagina + LinkedIn company + reputation.
- **Livello 3 — Sherlock** (~5min): + LinkedIn profili dei contatti chiave + news ultimi 12 mesi + ricerche email pattern + cross-reference.

**UI editor** in Impostazioni → "Sherlock Playbooks":
- Lista livelli, drag-drop step, editor template URL con preview variabili, editor prompt AI per step, toggle attivo.
- Riusa pattern esistente `KBIngestPanel` / `BackupExportTab`.

### 3. Esecutore Sherlock (orchestratore sequenziale)

Nuovo file `src/v2/services/sherlock/sherlockEngine.ts`:

```text
runSherlock(level, vars, signal) {
  playbook = loadPlaybook(level)
  context = { vars, findings: {}, history: [] }

  for step in playbook.steps:
    if signal.aborted: break
    if !checkRequiredVars(step, context): skip
    
    url = renderTemplate(step.url_template, context)
    
    // Pre-check cache + rate gate (riusa fasi precedenti)
    if cacheHit(url): markdown = cached
    else: 
      awaitChannelSlot(step.channel, signal)
      markdown = await fs.readUrl(url, signal)
      persistScrape(...)
    
    // AI parsing mirato per QUESTO step
    extracted = await callAI({
      system: SHERLOCK_SYSTEM,
      user: step.ai_extract_prompt + markdown + JSON(context.findings)
    })
    
    context.findings[step.order] = extracted
    emitProgress({ step, extracted, markdown })
    
    // AI decide se continuare/saltare
    if step.ai_decide_next:
      decision = await callAI(decideNextPrompt(context))
      if decision.skip_to: jumpTo(decision.skip_to)
      if decision.stop_reason: break
  
  return consolidateFindings(context)
}
```

### 4. Edge function `sherlock-extract`

Riusa Lovable AI Gateway (`google/gemini-3-flash-preview` default).
- Input: `{ markdown, extract_prompt, target_fields, prior_findings }`
- Tool calling con schema dinamico generato da `target_fields` (no JSON-by-prompt).
- Output: `{ findings: {...}, confidence: 0-1, suggested_next_url?: string }`
- Il campo `suggested_next_url` è la "intelligenza Sherlock": se trova nel markdown un link LinkedIn del CEO, lo propone come prossimo step.

### 5. UI Canvas evoluzione (minimal change)

Rinominare `DeepSearchCanvas` → `SherlockCanvas`:
- Header: selettore livello (Scout / Detective / Sherlock) con stima tempo + chip target_fields.
- Sidebar sinistra: timeline step (✓ done, ⏳ running, 💡 AI-suggested-next, ⏭ skipped-by-AI).
- Centro: tab **Markdown** | **Findings AI** (JSON formattato per step) | **Sintesi finale**.
- Pulsante "Salva risultati nel CRM" → applica findings al partner/contatto via DAL esistente.

### 6. Integrazione futura (cockpit/email)
Esposto come hook `useSherlock(level)` riusabile in EmailComposer per arricchire contatti prima di un invio (toggle "Approfondisci con Sherlock prima di scrivere").

## File interessati

**Nuovi**:
- `src/v2/io/extensions/_backup/2026-04-20-firescrape-v1/` (3 file)
- `supabase/migrations/<ts>_sherlock_playbooks.sql`
- `src/data/sherlockPlaybooks.ts` (DAL)
- `src/v2/services/sherlock/sherlockEngine.ts`
- `src/v2/services/sherlock/sherlockTemplates.ts` (render `{var}`)
- `src/v2/hooks/useSherlock.ts`
- `src/v2/ui/pages/email-forge/SherlockCanvas.tsx` (sostituisce DeepSearchCanvas)
- `src/components/settings/SherlockPlaybooksEditor.tsx`
- `supabase/functions/sherlock-extract/index.ts`
- Memoria `mem://features/sherlock-investigator`

**Edit**:
- `LabBottomTabs.tsx` — bottone "Apri Sherlock" invece di "FireScrape Canvas"
- `BackupExportTab.tsx` — aggiunge editor playbooks
- `mem://index.md` — registra Sherlock + backup

## Ordine di esecuzione (autonomo dopo approvazione)

1. Backup file (copy + README + memoria).
2. Migration `sherlock_playbooks` + seed 3 livelli.
3. DAL + tipi.
4. Edge function `sherlock-extract`.
5. Engine + hook.
6. SherlockCanvas (basato su DeepSearchCanvas, riusa render markdown già perfetto).
7. Editor playbooks in Impostazioni.
8. Wire in LabBottomTabs.
9. Test E2E sui 3 livelli.

## Tecnica chiave

- **Sequenzialità rigorosa**: `for await` loop, mai `Promise.all` (rispetto rate limit LI/WA).
- **AI in 2 punti**: estrazione strutturata per step (tool calling) + decisione next-step (opzionale per step).
- **Cache-first**: ogni URL passa da `scrape_cache` prima di chiamare l'estensione.
- **Abortable a ogni step**: `AbortSignal` propagato a `fs.readUrl` e a `fetch` AI.
- **KB editabile**: tutti i prompt, URL template e step in DB → l'utente può raffinare senza redeploy.
- **Persistenza findings**: nuova tabella `sherlock_investigations` (run, livello, partner_id, findings jsonb, status) per audit + riusabilità.
