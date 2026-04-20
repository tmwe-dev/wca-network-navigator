

## Diagnosi precisa dei 3 problemi

### Problema 1 — Formattazione brutta del Markdown
Il sistema mostra **il markdown grezzo restituito dallo scraper** (vedi `SherlockCanvas.tsx` riga 238: `<LazyMarkdown>{selected.markdown}</LazyMarkdown>`). Non c'è filtro: arrivano interi blocchi di navigazione Google (`Visualizza foto`, `Suggerisci nuovi orari`, `Aggiungi un'etichetta`), tabelle malformate degli orari (`| lunedì | - Aperto 24 ore |`), header ripetuti, footer di siti, link `[Learn more](...)` lasciati visibili. **Il valore vero** (l'AI extraction) è nascosto nella tab "Findings AI" che mostra solo JSON crudo.

### Problema 2 — LinkedIn azienda saltato
Step 6 del Detective ha `required_vars: ["linkedinCompanySlug"]` ma in `SherlockCanvas.tsx` riga 52 viene passato **stringa vuota hardcoded** → skip immediato. Lo slug non viene mai derivato né dal DB partner (`linkedin_url`) né dallo scrape del sito ufficiale (l'AI dello step "Sito — Home" potrebbe estrarlo, ma il valore non viene messo in `liveVars`).

### Problema 3 — Nessun rate limit LinkedIn dedicato
L'engine usa `extFs.readUrl` direttamente. Il rate limit di 1 req/sec esiste solo in `src/v2/agent/runtime/tools/scrape.ts` (un altro path). Per Sherlock **non c'è alcun limite per LinkedIn**: con 10 indagini parallele potresti fare 10 hit/sec a LinkedIn = ban garantito.

---

## Piano fix (4 interventi)

### Fix 1 — Formattazione intelligente del markdown raw (Pulizia + Sezioni)
Nuovo modulo `src/v2/services/sherlock/markdownPrettify.ts` che applica regole deterministiche **prima** del rendering:

- **Rimuove rumore Google Maps**: pattern `Visualizza foto`, `Salva`, `Condividi`, `Invia al telefono`, `Suggerisci…`, `Cronologia di Maps`, `Aggiungi un'etichetta`, `Orari di punta`.
- **Compatta tabelle orari**: `| lunedì | - Aperto 24 ore | | | --- | --- | --- |` → `**Orari**: 24/7`.
- **Linkifica vs nasconde**: `[Learn more](url)` su pagine generiche → rimosso; URL utili (email, telefono) → preservati come elenco puntato.
- **Deduplica righe consecutive identiche** e collassa multiple newline.
- **Toglie il blocco "Source: …"** (lo mostriamo già nell'header come URL).
- **Tronca a 800 righe** con avviso "[…contenuto troncato per leggibilità]".

Il markdown grezzo originale resta accessibile via toggle "Mostra raw" (tasto code icon).

### Fix 2 — Tab "Findings AI" come scheda leggibile (non più JSON crudo)
Sostituisce il `<pre>{JSON.stringify(...)}</pre>` con una **card view**:
- Titolo del campo (es. "Indirizzo") → valore in evidenza.
- Sintesi AI (campo `_summary`) in cima come callout.
- `other_findings` come lista chiara key→value.
- `suggested_next_url` come bottone "Indaga questo URL" (riutilizzabile).
- JSON raw resta dietro toggle "Vedi JSON".

### Fix 3 — LinkedIn slug discovery + persistenza
Tre layer di fallback in `sherlockEngine.ts`:

1. **Pre-run**: se `recipient.linkedinUrl` esiste sul partner DB → estrai slug (`/company/(.+?)/?$`) e popola `liveVars.linkedinCompanySlug`. Estendere `ForgeRecipientPicker.tsx` per leggere `partners.linkedin_url`.
2. **Runtime**: dopo lo step "Sito — Home", se l'AI ha trovato un link LinkedIn company nei `findings`, l'engine lo estrae e popola `liveVars.linkedinCompanySlug` (heuristica: regex `linkedin\.com/company/([^/?]+)`).
3. **Discovery automatica**: se anche dopo fix 1+2 lo slug manca, ricerca Google `"{companyName} site:linkedin.com/company"` e prendi il primo match.

Persistenza: se lo slug viene scoperto, scrivilo in `partners.linkedin_url` via DAL (analogo a `updatePartnerWebsiteIfMissing`).

### Fix 4 — Rate limiter globale LinkedIn (10 sec/req per dominio)
Nuovo modulo `src/v2/services/sherlock/rateLimiter.ts` con politica per `channel`:

| Channel    | Min interval | Note |
|------------|--------------|------|
| `linkedin` | **10000 ms** | Stealth: 1 hit ogni 10s globale per evitare ban |
| `generic`  | 1000 ms      | 1 req/s per dominio |

Implementato come **Map<domain, lastTs>** in modulo singleton, così è condiviso fra tutte le indagini Sherlock simultanee dell'utente. Prima di `extFs.readUrl` l'engine fa `await throttle(channel, url)` che attende se necessario. Lo step LinkedIn mostra un sub-text "⏱ throttle 10s in corso…" se in attesa.

Memo aggiornata in `mem://features/sherlock-investigator` per documentare le 3 nuove regole.

---

## File modificati

**Nuovi:**
- `src/v2/services/sherlock/markdownPrettify.ts` (pulizia regex)
- `src/v2/services/sherlock/rateLimiter.ts` (throttle per channel)
- `src/v2/ui/pages/email-forge/sherlock/FindingsView.tsx` (card view findings)

**Edit:**
- `src/v2/services/sherlock/sherlockEngine.ts` (LinkedIn slug discovery + throttle)
- `src/v2/ui/pages/email-forge/SherlockCanvas.tsx` (usa prettify + FindingsView + toggle raw)
- `src/v2/ui/pages/email-forge/ForgeRecipientPicker.tsx` (leggi `linkedin_url` dal DB)
- `src/data/sherlockPlaybooks.ts` (`updatePartnerLinkedinIfMissing`)

## Risultato atteso

- **Markdown leggibile**: niente più "Visualizza foto" o tabelle orari rotte; il dump Google Maps sintetizzato in 5-10 righe utili.
- **Findings AI presentati come scheda**: vedi subito "📍 Indirizzo: 630 Supreme Dr…", "📞 +1 630 616 5555", "🌐 anchorexpressinc.com" senza leggere JSON.
- **LinkedIn azienda funzionante**: scoperto via 3 fallback, persistito sul partner per le indagini future.
- **Rate limiter globale LinkedIn**: massimo 1 hit ogni 10s in tutta l'app, anche con 10 indagini parallele, evitando ban.

