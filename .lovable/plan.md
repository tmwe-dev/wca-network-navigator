
# Implementazione Fix Context Explosion — Fasi 1, 2, 4, 5, 6

Stato verificato:
- **Fase 0 GIÀ FATTA**: `aiCallHandler.ts` riga 217-246 propaga `temperature` + `maxTokens`. `kb-supervisor` ha `maxTokens: 32000`. Bug `operatorBriefing` già fixato in fix precedente.
- **Fase 3 GIÀ FATTA**: directory `harmonizer-v2/` completa con `ai-gateway-micro` deployato.
- **Nota nomenclatura**: il campo nello scope config è `maxTokens` (camelCase) **non** `max_tokens` come nel doc. Mantengo `maxTokens` per coerenza col codice esistente; aggiungo `contextRequirements`.

---

## FASE 1 — Context Assembly selettivo per scope

**Obiettivo**: ogni scope dichiara quali blocchi di contesto carica; gli altri vengono saltati.

### 1A — `supabase/functions/_shared/scopeConfigs.ts`
1. Aggiungere campo opzionale `contextRequirements?: string[]` all'interfaccia `ScopeConfig`.
2. Per ogni scope nel `getScopeConfig()` aggiungere il campo:
   - `cockpit`: `["profile", "memory", "kb", "doctrine"]`
   - `contacts`: `["profile", "kb"]`
   - `import`: `["profile"]`
   - `extension`: `["profile", "memory"]`
   - `strategic`: `["profile", "kb", "doctrine"]`
   - `kb-supervisor`: `[]` (nessun contesto — già bypassato esplicitamente in contextAssembly, lo formalizziamo qui)
   - `deep-search`: `["profile", "kb"]`
   - `chat`: `["profile", "memory", "kb"]`
   - `mission-builder`: `["profile", "mission_history"]`

### 1B — `supabase/functions/ai-assistant/contextAssembly.ts`
1. Aggiungere import `import { getScopeConfig } from "../_shared/scopeConfigs.ts";`
2. Dopo la costruzione di `contextBlocks` (riga 310-320), prima di `assembleContext`, inserire il filtro per `contextRequirements`:
   - Se lo scope ha `contextRequirements: []` → svuotare `contextBlocks`.
   - Se ha `contextRequirements` con elementi → filtrare solo i blocchi con `key` incluso.
   - Se è `undefined` → comportamento legacy (carica tutto).
3. Mantenere il bypass speciale per `kb-supervisor` già esistente (riga 252-260): è una scorciatoia che evita anche il caricamento. Aggiungere bypass simile (early-return prima di `loadContextParallel`) anche quando `contextRequirements: []` per evitare query DB inutili.

### 1C — Optimization (opzionale): in `loadContextParallel`
- Aggiungere parametro `requiredKeys?: string[]` e wrappare ciascun loader (`loadMemoryContext`, `loadKBContext`, `loadOperativePrompts`, `loadMissionHistory`, `loadSystemDoctrine`, `loadRecentEmailContext`) con check `requiredKeys.includes(...)` → ritorna `""` invece di caricare.
- Ridurrà query Supabase su scope con pochi requirements (es. `import` carica solo profile).

### Test
- Scope `import`: nessun blocco doctrine/memory/kb nei log.
- Scope `kb-supervisor`: prompt minimale come oggi.
- Scope `cockpit`: contiene tutti i 4 blocchi.

---

## FASE 2 — "Migliora tutto": ridurre contesto per blocco

**File**: `src/v2/ui/pages/prompt-lab/hooks/useContextBuilder.ts`

### 2A — Aggiornare costanti (riga 27-33)
- `MAX_RELEVANT_DOCTRINE_CHARS = 10_000` (era 100_000)
- `MAX_NEARBY_BLOCKS = 5` (era 50)
- `MAX_INDEX_BLOCKS = 100` (era 200)

### 2B — Riscrivere `filterDoctrineForBlock` (riga 82-114)
- Se doctrine ≤ 10K chars → passala intera con header "rilevante".
- Altrimenti: split per `### `, score per rilevanza, prendi top sezioni fino a esaurire il budget di 10K chars. Header indica quante sezioni omesse.

### 2C — Riscrivere `filterSystemMapForBlock` (riga 127-170)
- Top 5 blocchi dello stesso tab (per relevanceScore) con contenuto **completo**.
- Tutti gli altri (stesso tab residui + altri tab) → indice compatto: solo `[tab] label`, fino a `MAX_INDEX_BLOCKS` (100).
- Niente più snippet da 800 chars per ogni blocco.

### Test
- "Migliora tutto" su KB grande: contesto per blocco <15K chars.
- Tempo per blocco scende da ~15-30s a ~5-10s.

---

## FASE 4 — Sherlock: compattare findings e markdown

**File**: `src/v2/services/sherlock/sherlockEngine.ts` + `aiIntegrations.ts`

### 4A — Truncate markdown intelligente
1. In `sherlockEngine.ts`: aggiungere helper `truncateMarkdownSmart(markdown, targetFields)`:
   - Limit 8K chars.
   - Splitta su `\n\n`, score paragrafi per overlap con keyword da `targetFields`, mantiene i più rilevanti fino al budget.
2. Trovare nei due punti di chiamata (`callExtractAI` riga ~76 e `callDecideAI` riga ~99) dove viene passato `markdown` → applicare `truncateMarkdownSmart(markdown, targetFields)` prima.
   - Stessa modifica eventualmente in `aiIntegrations.ts` se duplicato (riga 25, 33).

### 4B — Compattare prior_findings
1. Aggiungere helper `compactFindings(findings)` in `sherlockEngine.ts` o `aiIntegrations.ts`:
   - Output: lista `field: value(150 chars)`, max 2K chars totali.
2. Applicare nei due punti dove `prior_findings` / `findings_so_far` viene serializzato (riga ~102 e `aiIntegrations.ts:39, 103`).

### Test
- Sherlock su sito grande: markdown ≤ 8K, findings_so_far ≤ 2K, info chiave ancora estratte.

---

## FASE 5 — Email generation: contesto mirato

**File**: `supabase/functions/improve-email/index.ts`

### 5A — Budget hard sulle sorgenti
1. Aggiungere costanti `IMPROVE_EMAIL_BUDGETS = { enrichment: 3_000, kb: 5_000, history: 3_000, partner: 2_000 }`.
2. Trovare i punti dove enrichment/KB/history/partner data vengono serializzati per il prompt → `.slice(0, budget)` su ognuno.
3. Aggiungere helper `compactHistory(activities, maxChars)`:
   - Solo ultime 5 entries (non 20).
   - Format: `[type] YYYY-MM-DD: summary(150 chars)`.
   - Slice finale a maxChars.

### 5B — Filtrare KB per categoria email
1. Al loader KB di `improve-email`: derivare `relevantCategories` da `email_type`:
   - commercial → `["email", "doctrine", "commercial", "playbook"]`
   - operational → `["procedures", "guidelines", "operational"]`
   - default (se mancante) → mantenere comportamento attuale.
2. Aggiungere `.in("category", relevantCategories).limit(5)` (se la query attuale carica 15+).
3. Verificare prima la struttura attuale del loader (potrebbe già esistere un filtro diverso).

### Test
- Generare/migliorare email: prompt totale <15K chars.
- Qualità output invariata.

---

## FASE 6 — Agent loop + voice context loader

### 6A — `src/v2/agent/runtime/agentLoop.ts`
1. Riscrivere `trimContext` (riga 46):
   - Default `maxRecent = 10` (non 30).
   - Ultimi 10 messaggi integrali + summary dei vecchi (role assistant/tool, contenuto a 100 chars/msg, totale max 2K chars) come system message in cima.
2. Verificare che il chiamante (riga 86) passi parametri compatibili.

### 6B — `supabase/functions/voice-brain-bridge/index.ts`
1. Aggiungere helper `extractPartnerMention(userMessage)`:
   - Regex per nomi azienda significativi (parole capitalizzate ≥3 char, escludendo stopwords italiane comuni).
   - Limitarsi a un singolo match per evitare query multiple.
2. Dopo aver ricevuto user message, prima di chiamare il modello: query Supabase per `partners` con `ilike` su company_name.
3. Se trovato → push messaggio system con `[CONTESTO PARTNER] {company} ({country}) — Status: {lead_status}, Interazioni: {n}, Ultimo contatto: {date}`.
4. Verificare che la struttura attuale della funzione consenta l'iniezione (potrebbe essere già un orchestratore con messaggi gestiti).

### Test
- Agent loop con 20+ step: history serializzata <3K chars.
- Voice agent menziona partner: contesto partner appare nella risposta.

---

## ORDINE DI DEPLOY

1. **Fase 1** → deploy `ai-assistant` + `unified-assistant` → smoke test ogni scope.
2. **Fase 2** → frontend rebuild → test "Migliora tutto" su KB grande.
3. **Fase 4** → frontend rebuild → test Sherlock su un partner.
4. **Fase 5** → deploy `improve-email` → test generate/improve email.
5. **Fase 6** → frontend rebuild + deploy `voice-brain-bridge` → test agent loop e voice.

## NOTE / RISCHI

- **Fase 1**: il bypass `kb-supervisor` esistente in contextAssembly resta come fast-path; il filtro generale `contextRequirements: []` produce lo stesso effetto ma più tardi nella pipeline. Va bene mantenerli entrambi (il bypass evita anche il loadContextParallel).
- **Fase 5**: l'attuale `improve-email/index.ts` potrebbe avere già qualche filtro KB; lo verificherò leggendo il file completo prima di modificare.
- **Fase 6B**: il regex partner è euristico — limito a 1 match per non fare 5 query DB. Se `voice-brain-bridge` è uno streaming SSE, l'iniezione system va fatta prima di aprire lo stream.
- **Nessuna modifica al DB**: tutte le fasi sono code-only.
- **Backward compatibility**: scope senza `contextRequirements` mantengono il comportamento attuale (carica tutto).
- **Tempo stimato**: 8-10h totali (Fase 1: 2h, Fase 2: 2h, Fase 4: 2h, Fase 5: 2h, Fase 6: 2h).

---

Confermi e procedo in default mode? Oppure vuoi che modifichi qualche scelta (es. valori di soglia diversi, ordine fasi, skip di una fase)?
