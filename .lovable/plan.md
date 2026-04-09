

# Piano: Fix Sezione Arricchimento — Dati Completi + BCA + Logo Google + Deep Search Configurabile

## Problemi identificati

1. **Ogni query ha `.limit(1000)`** — mostra max 1000 WCA, 1000 contatti, etc. In realtà ci sono 12.286 partner, 11.461 contatti, 383 BCA
2. **Manca il tab BCA (Biglietti da Visita)** — 383 record non visibili
3. **Manca "Cerca Logo Google" nelle azioni bulk e singole** — presente in Contatti e BCA ma non in Enrichment
4. **Deep Search non apre dialog di configurazione** — i bottoni Deep Search (bulk e singolo) non fanno nulla e non permettono di scegliere quali operazioni eseguire
5. **Manca il DeepSearchOptionsDialog** — il componente non esiste ancora; serve una mascherina che mostri i default della sezione (da `deep_search_config`) e permetta di modificarli al volo prima di lanciare

## Modifiche

### 1. Caricamento dati completo — loop iterativo con `.range()`

Sostituire le 4 query con `.limit(1000)` con funzioni di caricamento batch (2000 per volta, loop fino a esaurimento), come già fatto nel Mission Builder e nel Globo. Ogni sorgente caricherà tutti i record.

### 2. Aggiungere tab BCA

- Nuovo tab "BCA" con icona CreditCard e conteggio
- Query su `business_cards` con join su partner (come `useBusinessCards`)
- Mappa a `EnrichedRow` con: company_name, email, country da location/partner, source = "bca"
- Bordo sinistro viola (`border-l-purple-500`)

### 3. Aggiungere "Cerca Logo Google" 

**Azione singola**: nel menu ⋮ di ogni riga, aggiungere "Cerca Logo Google" che apre Google Immagini (stessa logica di ContactDetailPanel e BusinessCardsHub)

**Azione bulk**: nella barra di selezione, aggiungere bottone "Logo Google" accanto a LinkedIn Batch e Deep Search. Apre Google Immagini per il primo selezionato (o batch futuro)

### 4. Creare `DeepSearchOptionsDialog` 

Nuovo componente dialog che:
- Carica i default dalla configurazione `deep_search_config` per il contesto "enrichment" (o fallback a "contacts")
- Mostra 4 checkbox: Scrape sito web, Scrape LinkedIn, Verifica WhatsApp, Analisi AI
- L'utente può attivare/disattivare ogni opzione prima del lancio
- Pulsanti: "Avvia" / "Annulla"
- Si apre sia dall'azione singola (menu ⋮ → Deep Search) che dall'azione bulk

### 5. Collegare Deep Search reale

Integrare `useDeepSearchRunner` per lanciare effettivamente il Deep Search con le opzioni selezionate dall'utente nel dialog.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/settings/EnrichmentSettings.tsx` | Rimuovere `.limit(1000)`, implementare loop batch `.range()`, aggiungere tab BCA, aggiungere Logo Google singolo/bulk, collegare Deep Search al dialog |
| `src/components/settings/enrichment/DeepSearchOptionsDialog.tsx` | **Nuovo** — dialog con checkbox per opzioni Deep Search, carica default da `deep_search_config` |

## Ordine di esecuzione

1. Creare `DeepSearchOptionsDialog`
2. Riscrivere le query di caricamento con loop iterativo
3. Aggiungere tab BCA e dati
4. Aggiungere Logo Google (singolo + bulk)
5. Collegare Deep Search al dialog + runner

