

# Audit Completo + Refactor Pipeline LinkedIn: Problemi, Monitor AI, Ricerca Libera

## Problemi Critici Trovati

### BUG 1: LinkedIn URL mai trovata nel Cockpit
In `useCockpitContacts.ts` riga 251-253, per i contatti importati (`imported_contacts`), il sistema cerca la LinkedIn URL in:
```
enrich.social_links?.linkedin                    // campo che NON viene mai scritto
|| Array.isArray(enrich.contact_profiles) ? ...  // contact_profiles è un OGGETTO, non un array → sempre false
```
Risultato: **`linkedinUrl` e sempre vuota** per i contatti importati.

### BUG 2: Se linkedinUrl e vuota, lo scraping LinkedIn viene saltato
In `Cockpit.tsx` riga 249:
```ts
const canScrapeLinkedIn = isLinkedInChannel && liBridge.isAvailable && linkedinUrl;
```
Se `linkedinUrl` e vuota → `canScrapeLinkedIn = false` → nessuno scraping, nessuna ricerca, direttamente generazione AI senza dati LinkedIn.

### BUG 3: Google Search via Partner Connect e fragile
`useDeepSearchLocal.ts` usa `fs.agentAction({ action: "navigate", url: googleSearchUrl })` poi `fs.extract()` con selettori CSS di Google (`div.g a[href^='http']`). Google cambia questi selettori frequentemente → risultati vuoti.

### BUG 4: contact_profiles salvato come oggetto, letto come array
`useDeepSearchLocal.ts` riga 337 salva `{ contact_profiles: { [contactId]: {...} } }` (oggetto con chiave ID), ma `useCockpitContacts.ts` riga 252 fa `Array.isArray(enrich.contact_profiles)` → sempre false.

### BUG 5: LinkedIn URL trovata dalla Deep Search non viene propagata al Cockpit
La Deep Search salva l'URL in `partner_social_links`, ma il Cockpit la cerca anche in `enrichment_data.social_links.linkedin` che non viene mai scritto.

## Piano di Intervento

### 1. Fix risoluzione LinkedIn URL (useCockpitContacts.ts)
- Correggere la logica per i contatti importati: cercare in `contact_profiles` come oggetto (non array)
- Aggiungere lookup nella tabella `partner_social_links` anche per i contatti importati che hanno un `partner_id` associato
- Cercare anche in `enrichment_data.linkedin_profile_url` (scritto dal LinkedIn Flow)

### 2. Auto-ricerca LinkedIn quando URL manca (Cockpit.tsx handleDrop)
Quando `canScrapeLinkedIn` sarebbe false per mancanza di URL:
- Usare `liBridge.searchProfile()` (LinkedIn People Search interno all'estensione) per cercare il profilo
- Se trovato: aggiornare `linkedinUrl`, procedere con lo scraping
- Se non trovato: usare `useDeepSearchLocal.googleSearch` come fallback (cascata)
- Loggare ogni tentativo nel `searchLog` per il monitor

### 3. Ricerca AI libera — eliminare query rigide
Attualmente le query di cascata sono hardcoded:
```
"Nome Cognome" "Azienda" site:linkedin.com/in
```
Nuovo approccio:
- Dare all'AI (Lovable AI Gateway) il contesto completo: nome, azienda, email, posizione, paese
- Chiedere all'AI di **proporre** le query migliori in base ai dati disponibili
- L'AI decide quante query fare e in che ordine
- L'AI valida i risultati con ragionamento libero (non solo pattern matching URL)
- Creazione di un nuovo hook `useSmartLinkedInSearch.ts` che orchestra questo flusso

### 4. Monitor AI — Popup on demand
Nuovo componente `AISearchMonitor.tsx`:
- Pulsante discreto nella toolbar del Cockpit (icona lente/radar)
- Click apre un **drawer/dialog** con log in tempo reale:
  - Step corrente (es. "Cercando su LinkedIn People Search...")
  - Query utilizzata
  - Risultati trovati (con URL)
  - Decisione AI (match/skip/retry)
  - Tempo impiegato
- I dati del monitor sono salvati nello state del draft (`searchLog[]`)

### 5. Persistenza completa nel DB
Ogni ricerca salva in `enrichment_data` un campo `linkedin_search_log`:
```json
{
  "linkedin_search_log": [
    { "step": 1, "method": "li_people_search", "query": "Luca Arcana", "results": 3, "match": "https://...", "confidence": 0.92, "ms": 1200 },
    { "step": 2, "method": "google_via_pc", "query": "...", "results": 0, "ms": 2100 }
  ],
  "linkedin_resolved_at": "...",
  "linkedin_resolved_method": "li_people_search"
}
```

### 6. Google Search resiliente (fallback)
Sostituire l'estrazione DOM Google con `pcBridge.googleSearch()` (che usa il metodo nativo dell'estensione Partner Connect, gia esposto nel bridge). Se anche quello fallisce, usare `firecrawl-search` edge function come ultimo fallback server-side.

## File coinvolti

| File | Azione |
|------|--------|
| `src/hooks/useSmartLinkedInSearch.ts` | **Nuovo** — orchestratore ricerca AI-driven |
| `src/hooks/useCockpitContacts.ts` | Fix risoluzione `linkedinUrl` (righe 250-253) |
| `src/pages/Cockpit.tsx` | Auto-ricerca LinkedIn in `handleDrop` quando URL manca |
| `src/components/cockpit/AISearchMonitor.tsx` | **Nuovo** — popup monitor passo-passo |
| `src/components/cockpit/AIDraftStudio.tsx` | Integrazione pulsante monitor + display searchLog |
| `src/hooks/useDeepSearchLocal.ts` | Fix `googleSearch` per usare metodo nativo PC + fix salvataggio contact_profiles |

## Flusso risultante

```text
1. Utente trascina contatto su LinkedIn
2. Sistema: linkedinUrl vuota? → avvia Smart Search
3. Smart Search:
   a. LinkedIn People Search (via estensione) → "Luca Arcana Transport Management"
   b. Se 0 risultati → AI propone query alternative
   c. AI valida match con ragionamento libero
4. Monitor popup: mostra ogni step con query, risultati, decisione
5. URL trovata → scrape profilo → review → genera messaggio
6. Tutto il log salvato in enrichment_data per audit
```

