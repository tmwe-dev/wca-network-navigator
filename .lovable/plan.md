

# Audit AI — Secondo Passaggio: Hardcode Residuo

## Stato Attuale dopo il Primo Intervento

Il primo intervento ha fatto buoni progressi: `sameLocationGuard.ts` ora passa solo dati, `agent-execute` ha rimosso le 7 regole commerciali. Ma rimangono aree significative.

## BUG CRITICO

**`getChannelContext(ch)` in `generate-outreach/index.ts` riga 425** — questa funzione viene chiamata ma non è mai definita né importata. Il precedente refactoring ha rimosso `getChannelInstructions()` ma il codice usa `getChannelContext()` che non esiste. **Crasherà a runtime.**

## Hardcode Residuo — Cosa Rimane

### 1. `generate-outreach/index.ts` — Prompt ancora prescrittivo
- **Riga 449-452**: Istruzioni imperative nel saluto — `REGOLA: Rivolgiti a X, MAI all'azienda` — queste sono guardrail legittimi, ma il formato è troppo imperativo. Basterebbe passare il dato `recipientName` e un guardrail minimo.
- **Riga 463-477**: Il system prompt ha 6 guardrail hardcoded. Alcuni sono legittimi (zero allucinazioni), ma `Includi una call-to-action` e `Adatta lunghezza e stile al canale` sono istruzioni che l'AI dovrebbe decidere dalla KB.
- **Riga 491**: `OBIETTIVO COMMERCIALE FINALE: Convertire il lead...` con leve specifiche hardcoded (apertura account, tariffe privilegiate, semplificazione operativa) — queste leve commerciali dovrebbero essere in `app_settings` o KB.

### 2. `generate-email/index.ts` — Ancora prescrittivo
- **Righe 583-586**: `metInPersonContext` con `ISTRUZIONI: Usa un tono più caldo...` — imperativo. Bastava: `DATO: Incontro avvenuto a [evento]. L'AI decide come usare questa info.`
- **Righe 686-692**: `contactContext` con `REGOLA ASSOLUTA: Rivolgiti SEMPRE alla persona...` — troppo rigido. Il dato basta, l'AI sa come salutare.
- **Righe 788-795**: Stesse leve commerciali hardcoded di outreach (`apertura account, tariffe privilegiate...`)
- **Riga 766**: `Includi una call-to-action` — stesso problema di outreach.

### 3. `agent-execute/index.ts` — Guardrail residui hardcoded
- **Righe 205-209**: 4 guardrail operativi hardcoded (`7 giorni`, `storia interazioni`, `partner vs cliente`, `funnel`). La regola dei 7 giorni è un parametro che dovrebbe essere in `app_settings`. Gli altri 3 sono linee guida che dovrebbero essere nella KB.
- **Riga 211**: `Rispondi SEMPRE in italiano` — hardcoded. Dovrebbe essere `Rispondi nella lingua configurata dall'utente: ${settings.ai_language || "italiano"}`.
- **Riga 70**: `timingKeys` — lista di 13 chiavi hardcoded. Non è un problema grave (sono nomi di settings), ma meglio fare un `LIKE` query.
- **Riga 75**: `IMPORTANTE: Rispetta SEMPRE questi timing nelle operazioni.` — imperativo inutile, l'AI vede i dati.

### 4. `_shared/textUtils.ts` — Mappa lingue hardcoded
- **55 righe** di mappa paese→lingua. Come detto nel piano precedente, l'AI potrebbe ricevere solo il `country_code` e decidere la lingua, MA questa mappa è un "hint" ragionevole — è efficiente e non limita l'AI (il commento dice "AI can override"). **Opinione: TENERLA**, è un hint utile, non una gabbia.

### 5. `_shared/textUtils.ts` — `isLikelyPersonName()` 
- Lista di ~40 keyword di ruoli hardcoded. Questa è una funzione di utilità deterministica, non un prompt AI. **Opinione: TENERLA**, è logica di parsing, non "gabbia AI".

### 6. `generate-aliases/index.ts` — Prompt con regole
- **Righe 48-61**: Regole precise per generazione alias. **Opinione: TENERLA**, gli alias sono un task deterministico con output specifico. L'AI ha bisogno di regole precise qui.

## La Mia Opinione

Il sistema è al **70% liberato**. Le aree più critiche rimaste sono:

1. **Le leve commerciali hardcoded** (`apertura account, tariffe privilegiate`) in outreach e email — queste DEVONO essere in `app_settings` o KB perché variano per azienda
2. **Il tono imperativo residuo** nei prompt (`REGOLA ASSOLUTA`, `MAI`, `SEMPRE`) — può essere ridotto a dati + hint
3. **I guardrail di `agent-execute`** — il `7 giorni` dovrebbe essere una variabile, la lingua dovrebbe venire dai settings
4. **Il bug `getChannelContext`** — va fixato immediatamente

Cose che NON toccherei:
- `textUtils.ts` (mappa lingue + isPersonName) — sono utility deterministiche, non gabbie AI
- `generate-aliases` — task deterministico, servono regole precise
- Guardrail "zero allucinazioni" — questo è un guardrail di sicurezza essenziale

## Piano di Implementazione

### Step 1: Fixare il bug `getChannelContext`
Definire la funzione in `generate-outreach` — versione minimale che passa solo il nome del canale come contesto, senza istruzioni imperative.

### Step 2: Esternalizzare le leve commerciali
Spostare `apertura account, tariffe privilegiate, semplificazione operativa` in `app_settings` con chiave `ai_commercial_levers`. Usare nel prompt: `Leve commerciali configurate: ${settings.ai_commercial_levers || "non configurate"}`.

### Step 3: Snellire i prompt residui
- `generate-outreach`: Rimuovere `REGOLA:` imperativa nel saluto → passare solo il dato nome
- `generate-email`: Ridurre `metInPersonContext` a dato puro, rimuovere `ISTRUZIONI:`
- `generate-email`: Rimuovere `REGOLA ASSOLUTA` nel contactContext
- Entrambi: Rimuovere `Includi una call-to-action` (l'AI lo sa dalla KB)

### Step 4: Variabilizzare i guardrail di `agent-execute`
- `7 giorni` → leggere da `app_settings` chiave `comm_cooldown_days` (default 7)
- `Rispondi in italiano` → `Rispondi in ${lingua configurata}`
- Rimuovere `IMPORTANTE: Rispetta SEMPRE questi timing` — ridondante

### Stima
- 4 file da modificare
- ~50 righe di prompt da snellire/variabilizzare
- 1 bug critico da fixare

