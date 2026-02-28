

# Partner Hub — Ottimizzazione per Esplorazione e Discovery

## Obiettivo
Trasformare il Partner Hub da dashboard orientata alla completezza dati a un "book" di esplorazione partner. Mantenere i filtri utili per la selezione operativa, rimuovere gli elementi di gestione dati (action buttons, progress bars), e migliorare la scheda partner a destra come un canvas ricco e chiaro.

## Modifiche

### 1. CountryWorkbench.tsx — Snellire, tenere filtri utili

**Rimuovere:**
- I 4 ActionButton (Download profili, Deep Search, Alias azienda, Alias contatti) — appartengono a Operations
- Le 6 ProgressRow (Profili, Deep S., Email, Telefono, Alias Az, Alias Ct)
- I filter chips negativi (No Tel, No Email, No Prof, No Deep) — non servono per discovery

**Mantenere e riposizionare:**
- Filter chips positivi riformulati: "Con Tel", "Con Email", "Deep Search", + aggiungere "Con Rating 3+", "Con Servizi"
- Header compatto (bandiera, nome, conteggio)
- Select All / conteggio filtrati

**Arricchire la lista partner:**
- Rating stelle prominente accanto al nome
- Icone servizi trasporto + specialita sotto il nome
- Badge network piccoli
- Trophy anni WCA

**Rimuovere dalla props interface:** `onDownloadProfiles`, `onDeepSearch`, `onGenerateAliases`, `deepSearching`, `deepSearchProgress`, `aliasGenerating`

### 2. CountryCards.tsx — Semplificare

- Rimuovere la barra progresso profili (% completamento)
- Rimuovere stats Phone/Mail/Users/entrambi
- Rimuovere warning "senza profilo" e bottone "Scarica profili"
- Mostrare solo: bandiera, nome paese, numero partner, rating medio (calcolato da stats)
- Card piu pulita e cliccabile

### 3. PartnerDetailFull.tsx — Aprire sezioni per default

- Contatti Azienda: da Collapsible a sezione sempre aperta
- Contatti Ufficio: da Collapsible a sezione sempre aperta
- Profilo Aziendale: da Collapsible a sezione sempre aperta
- Servizi gia aperti (confermato)
- Spostare la sezione KPI subito sotto l'header, prima dei servizi

### 4. PartnerHub.tsx — Layout full-height

- Rimuovere `-m-4` e usare `h-[calc(100vh-3.25rem)]` per far partire il pannello dall'alto
- Rimuovere le props di download/deepSearch/alias dal passaggio a CountryWorkbench

## File da modificare

| File | Azione |
|------|--------|
| `CountryWorkbench.tsx` | Rimuovere ActionButtons, ProgressRows, filtri negativi; mantenere filtri positivi; arricchire lista con rating/servizi/network |
| `CountryCards.tsx` | Rimuovere progress bar e stats contatti, card minimale |
| `PartnerDetailFull.tsx` | Aprire Collapsible per default (sezioni sempre visibili), KPI band sotto header |
| `PartnerHub.tsx` | Aggiustare layout, rimuovere props non necessarie dal CountryWorkbench |

