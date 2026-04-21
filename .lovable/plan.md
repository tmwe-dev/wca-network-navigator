

## Problema riscontrato

1. **Pulsante "Arricchimento Base" sparito visivamente** → in realtà è nella `BulkActionBar` che compare SOLO con righe selezionate. Tu hai selezionato e poi deselezionato → barra sparita.
2. **Niente feedback in tempo reale visibile sulle righe** → il sistema c'è (`rowStates` + spinner + glow LinkedIn), ma:
   - Funziona solo finché la riga è "running"/"done" nella sessione corrente
   - Dopo il refetch, le icone tornano a leggere `hasLogo`/`hasLinkedin` dal DB con cache 60s → percezione di "non è successo nulla"
   - Non c'è invalidazione automatica al termine del job

## Soluzione

### 1. Pulsante "Arricchimento Base" sempre visibile (toolbar fissa)
Spostare il pulsante "Arricchimento Base" + barra di progresso dalla `BulkActionBar` (condizionale) a una **toolbar fissa** sempre visibile sopra la lista, accanto a Search + Filter.

- Se **0 selezionati** → pulsante azzurro "Arricchimento Base" disabilitato con tooltip "Seleziona almeno una riga"
- Se **N selezionati** → pulsante azzurro attivo, etichetta "Arricchimento Base (N)"
- Se **job in corso** → pulsante diventa "Stop" rosso + barra di progresso live sotto

Le altre azioni bulk (LinkedIn Batch, Logo Google, Deep Search, Esporta) restano nella `BulkActionBar` condizionale come oggi.

### 2. Feedback live visibile e persistente sulle righe

**a) Invalidazione cache al completamento job**
In `EnrichmentSettings.tsx`, dopo `start()` aggiungere refetch anche di `bcaItems` + `queryClient.invalidateQueries({ queryKey: queryKeys.partners.enrichment() })` così che le icone "vere" si aggiornino dal DB.

**b) Riga arricchita in questa sessione resta evidenziata**
Mantenere `rowStates` anche dopo il refetch, mostrando un piccolo badge ✨ "Arricchita ora" sulla riga per ~5 minuti dopo la fine del job (visibile finché l'utente non ricarica la pagina).

**c) Icone della riga: priorità a stato live**
Nella riga, le icone Linkedin/Logo/Site devono leggere PRIMA `liveState` (se presente) e POI `row.hasX`. Già implementato per LinkedIn/Logo, da estendere per **Site** (oggi visibile solo se `liveState.site === true`, ma dovrebbe restare visibile come "🌐 sito letto" anche dopo refetch leggendo da `enrichment_data.website_excerpt`).

**d) Counter in alto**
Aggiungere accanto agli stat (`totali · domain · linkedin · logo`) un counter live durante il job: `⚡ Arricchendo: X/Y` che sostituisce gli stat fissi durante l'esecuzione.

### 3. Dettagli tecnici (per il dev)

**File da toccare:**
- `src/components/settings/EnrichmentSettings.tsx` — passare `progress`/`start`/`stop` anche fuori dalla `BulkActionBar` condizionale; aggiungere `queryClient.invalidateQueries` dopo `handleStart`
- `src/components/settings/enrichment/EnrichmentToolbar.tsx` — accettare props opzionali `baseEnrichment: { progress, onStart, onStop, selectedCount }` e renderizzare il pulsante azzurro fisso + barra progresso compatta
- `src/components/settings/enrichment/BulkActionBar.tsx` — rimuovere il pulsante "Arricchimento Base" e la barra di progresso (ora nella toolbar)
- `src/components/settings/enrichment/EnrichmentRowList.tsx` — estendere `rowStates` per mostrare icona 🌐 anche dopo refetch leggendo `row.hasWebsiteExcerpt` (nuovo campo da aggiungere a `EnrichedRow`)
- `src/hooks/useEnrichmentData.ts` — aggiungere `hasWebsiteExcerpt: !!ed.website_excerpt` ai partners; esporre `refetchAll()` che fa anche `invalidateQueries`

**Comportamento atteso post-fix:**
1. Apro Arricchimento → vedo subito pulsante azzurro "Arricchimento Base" in toolbar (disabilitato finché 0 selezionati)
2. Seleziono 10 righe → pulsante diventa attivo "Arricchimento Base (10)"
3. Click → pulsante diventa "Stop" rosso, barra progresso compare sotto, righe iniziano ad evidenziarsi una alla volta con spinner blu
4. Riga completata → spinner sparisce, icone LinkedIn/Logo/🌐 si accendono e RESTANO accese (sia per liveState sia per dato DB refetched)
5. Job finito → toast "Completato", barra sparisce, badge ✨ resta sulle righe arricchite per evidenziarle visivamente
6. Anche se cambio tab e torno, le icone restano corrette (DB invalidato + refetched)

Pronto a procedere con l'implementazione end-to-end appena confermi.

