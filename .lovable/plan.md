

# LinkedIn URL Discovery — Ricerca Google Batch via Partner Connect

## Concetto

Un nuovo sistema **"LinkedIn Lookup"** che fa una sola cosa: cerca su Google l'URL del profilo LinkedIn di ogni contatto e lo salva in `enrichment_data.linkedin_url`. Nessuno scraping di LinkedIn, nessun accesso al profilo — solo una ricerca Google `site:linkedin.com/in "Nome" "Azienda"` tramite l'estensione Partner Connect.

Separando la **scoperta URL** dalla **Deep Search** (che poi legge il profilo), evitiamo blocchi e segnalazioni.

## Flusso operativo

```text
Per ogni contatto senza linkedin_url:
  1. Google Search via Partner Connect: site:linkedin.com/in "Nome" "Azienda"
  2. Valida il match (nome + azienda nel titolo/descrizione)
  3. Se trovato → salva URL in enrichment_data.linkedin_url
  4. Pausa umana tra contatti (pattern 2,19,4,3,22,5,4,7,18,4,25,3,7,13,3,11 sec)
  5. Ogni operazione dura almeno 16 secondi
```

## Dove si attiva

- **Contatti**: nuovo pulsante "🔗 LinkedIn Lookup" nella toolbar (accanto a Deep Search)
- **Contatti GroupStrip**: pulsante per gruppo
- **Cockpit**: pulsante nella toolbar batch
- **Business Cards**: pulsante nella toolbar
- **Operations/Partners**: pulsante nella toolbar

## Modifiche tecniche

### 1. Nuovo hook `src/hooks/useLinkedInLookup.ts`
- Usa `useFireScrapeExtensionBridge` (Partner Connect) per `googleSearch()`
- Riusa le funzioni esistenti di `useSmartLinkedInSearch` (buildGoogleQueries, extractGoogleCandidate, validateMatch, isLinkedInProfileUrl)
- Per ogni contatto: una sola query Google, max 2 tentativi se la prima non trova
- Salva `enrichment_data.linkedin_url` e `enrichment_data.linkedin_lookup_at` nel DB
- Skipping automatico: se `enrichment_data.linkedin_url` esiste già → skip
- Progress tracking: contatto corrente, trovati/non trovati/skippati
- Abort supportato
- Applica `ensureMinDuration(16s)` + `getPatternPause()` tra i contatti

### 2. Aggiornare `src/hooks/useContactActions.ts`
- Aggiungere `handleLinkedInLookup(contactIds[])` e `handleGroupLinkedInLookup(group)`
- Stessa logica di handleDeepSearch ma chiama il nuovo hook
- Esporre `linkedInLookupLoading` nello stato

### 3. UI — Pulsanti nelle toolbar
- **ContactListPanel.tsx**: aggiungere pulsante "LinkedIn Lookup" con icona Linkedin (lucide) accanto a Deep Search
- **GroupStrip.tsx**: aggiungere pulsante lookup per gruppo
- **Cockpit.tsx**: pulsante nella toolbar batch
- Mostrare un monitor di progresso (contatto corrente, contatore trovati/skip/errori)

### 4. Impatto sulla Deep Search
- La Deep Search esistente, quando trova `enrichment_data.linkedin_url` già presente, lo usa direttamente per leggere il profilo senza cercarlo di nuovo
- Nessuna modifica alla Deep Search stessa — già legge da enrichment_data

## Sicurezza e rate limiting
- Solo ricerche Google, zero accessi a LinkedIn
- Pattern di pausa umano hardcoded
- Min 16 secondi per operazione
- Skip automatico dei contatti già risolti
- Abort in qualsiasi momento

