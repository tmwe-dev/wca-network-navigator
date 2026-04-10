

# Audit AI: Troppo Hardcode, Poca Libertà per l'AI

## Problema Identificato

Il sistema attualmente "prende il volante" invece di lasciare che l'AI guidi. Ci sono **centinaia di righe di istruzioni imperative hardcoded** nei prompt e nella logica delle edge function che costringono l'AI a comportarsi in modo rigido. L'approccio corretto è: **dare contesto + guardrail + variabili**, e lasciare l'AI decidere *come* eseguire.

---

## Aree Critiche Trovate

### 1. **`sameLocationGuard.ts` — Tono e Strategia Hardcoded**
- `toneSuggestion` è un `switch/case` con 5 frasi fisse per ogni `relationship_stage` (cold/warm/active/stale/ghosted)
- `buildInterlocutorTypeBlock()` ha due blocchi di testo statici che dettano ESATTAMENTE cosa dire per partner vs cliente
- `buildRelationshipAnalysisBlock()` contiene istruzioni imperative specifiche ("Usa 'no strategico'", "Last attempt")
- `buildBranchCoordinationBlock()` dice esattamente come menzionare le sedi

**Cosa fare:** Passare solo i DATI (metriche, numeri, stage label) e lasciare che l'AI decida il tono e la strategia in base al contesto + KB.

### 2. **`generate-outreach/index.ts` — Prompt Iper-Prescrittivo**
- `getChannelInstructions()` (linee 114-150): 4 blocchi hardcoded che dettano formato, lunghezza, emoji, stile per ogni canale
- Limiti di parole hardcoded nel prompt (WhatsApp < 100, LinkedIn < 200, SMS < 160, Email < 150)
- `detectLanguage()` duplicata in 2 file con mappa statica di ~15 paesi
- `isLikelyPersonName()` duplicata in 2 file con lista hardcoded di ~30 keyword di ruoli
- `cleanCompanyName()` con regex hardcoded per suffissi legali
- 10 "REGOLE CRITICHE" imperative nel system prompt

**Cosa fare:** Spostare limiti canale e regole in `app_settings` o in KB entries. Dare i dati grezzi e lasciare l'AI decidere. La lingua dovrebbe essere rilevata dall'AI stessa, non da una mappa di 15 paesi.

### 3. **`generate-email/index.ts` — Strategic Advisor Rigido**
- `buildStrategicAdvisor()` (linee 101-153): dice esattamente quali tecniche usare e quando
- `fetchKbEntriesStrategic()`: switch/case hardcoded che mappa `emailCategory` → categorie KB specifiche
- 7 "Regole critiche" nel system prompt che micro-gestiscono l'output
- Alias, firma, formato HTML — tutto dettato con istruzioni imperative

**Cosa fare:** Eliminare lo switch/case delle categorie — dare TUTTE le categorie pertinenti e lasciare l'AI selezionare. Ridurre le regole a guardrail essenziali.

### 4. **`agent-execute/index.ts` — 7 Regole Commerciali Hardcoded**
- Linee 204-214: "REGOLE COMMERCIALI FONDAMENTALI" (7 punti imperativi)
- Queste regole dovrebbero essere in `kb_entries` o `operative_prompts`, non nel codice
- L'agente riceve un prompt di ~200 righe di istruzioni fisse

**Cosa fare:** Caricare le regole commerciali dalla KB/operative_prompts invece che dal codice.

### 5. **`agent-autonomous-cycle/index.ts` — Logica Decisionale Hardcoded**
- `isHighStakes()` (linea 26-31): condizioni hardcoded (lead_status, rating >= 4)
- Status "proposed" vs "pending" deciso da if/else nel codice, non dall'AI
- Budget e timing sono hardcoded come fallback

**Cosa fare:** I criteri high-stakes dovrebbero essere configurabili in app_settings.

### 6. **Duplicazioni di Codice**
- `detectLanguage()` identica in `generate-email` e `generate-outreach`
- `isLikelyPersonName()` identica in entrambi
- `cleanCompanyName()` identica in entrambi
- `getKBSlice()`/`getKBSliceLegacy()` quasi identici

---

## Piano di Implementazione

### Step 1: Centralizzare utility duplicate
- Spostare `detectLanguage`, `isLikelyPersonName`, `cleanCompanyName` in `_shared/textUtils.ts`
- Eliminare le copie locali

### Step 2: Esternalizzare regole commerciali e toni
- Creare una nuova tabella `ai_guardrails` (o usare `app_settings`) con chiavi tipo:
  - `channel_guidelines_email`, `channel_guidelines_whatsapp`, ecc.
  - `tone_rules_partner`, `tone_rules_client`
  - `high_stakes_criteria`
  - `word_limits_per_channel`
- Caricarle a runtime invece di hardcodarle

### Step 3: Snellire i prompt — da imperativo a contestuale
- **`sameLocationGuard.ts`**: `buildInterlocutorTypeBlock()` → passa solo `{ type: "partner" | "client", data }`, senza dettare il tono. `buildRelationshipAnalysisBlock()` → passa solo le metriche, senza le istruzioni imperative di tono
- **`generate-outreach`**: Rimuovere `getChannelInstructions()` hardcoded. Dare solo: `canale: whatsapp, linee guida: {da_settings}`
- **`generate-email`**: Semplificare `buildStrategicAdvisor()` — dare contesto + KB, non istruzioni step-by-step
- **`agent-execute`**: Spostare le 7 regole commerciali in `operative_prompts` o KB

### Step 4: Lasciare l'AI decidere la lingua
- Eliminare la mappa `detectLanguage()` hardcoded
- Passare solo `country_code` e `preferred_language` (se configurata) e lasciare che l'AI scelga

### Step 5: Rendere `isHighStakes` configurabile
- I criteri per high-stakes (rating, lead_status) dovrebbero essere in app_settings
- L'AI/sistema legge i criteri a runtime

---

## Principio Guida

```text
PRIMA (ingabbiato):
  "Scrivi in tono collaborativo. Usa Label + Mirroring. Max 100 parole."

DOPO (libero con guardrail):
  "Canale: WhatsApp. Relazione: cold. KB disponibile. Dati partner: {...}. 
   Guardrail: zero allucinazioni, no firma, rispetta la lingua del paese."
```

L'AI riceve DATI + CONTESTO + GUARDRAIL minimi, e decide autonomamente strategia, tono, lunghezza e tecniche.

---

## Stima
- ~8 file da modificare
- ~400 righe di prompt hardcoded da sostituire con caricamento da DB
- 1 migrazione DB per `ai_guardrails` o estensione `app_settings`
- 1 nuovo file `_shared/textUtils.ts`

Vuoi che proceda?
