

# Refactoring Step 1: Tab per Paese + Wizard Step-by-Step

## Problema principale

1. **Numeri sbagliati**: `PartnerListPanel` usa `usePartners({ countries: countryCodes })` che aggrega TUTTI i paesi selezionati. Le stats mostrano dati misti (es. Thailandia + Antigua insieme), creando confusione.
2. **Nessuna separazione per paese**: non c'e' modo di capire quale paese stai guardando.
3. **Download nascosto nel flusso**: i controlli download sono mescolati con stats e barre di progresso in un flusso verticale lungo. L'utente non capisce cosa fa cosa.

## Soluzione: Tab per Paese + Wizard Guidato

### Layout Step 1

```text
┌─ HEADER: [←] Operations [🇹🇭 Thailand] [🇦🇬 Antigua] ─────────────────────┐
│                                                                              │
│  ┌── LEFT (58%) ──────────────────┐  ┌── RIGHT (42%) ────────────────────┐  │
│  │                                │  │                                    │  │
│  │  TAB BAR: 🇹🇭 Thailand | 🇦🇬 AG │  │  Partner Detail (se selezionato)  │  │
│  │                                │  │  oppure                            │  │
│  │  ┌─ DASHBOARD PAESE ────────┐  │  │  Dashboard Riepilogo Paese        │  │
│  │  │ Directory: 180           │  │  │  (stats + azioni rapide)          │  │
│  │  │ Scaricati: 178 (99%)     │  │  │                                    │  │
│  │  │ Con Profilo: 0 (0%)      │  │  └────────────────────────────────────┘  │
│  │  │ Con Email: 100 (56%)     │  │                                          │
│  │  │ Con Telefono: 76 (43%)   │  │                                          │
│  │  │ Deep Search: 123 (69%)   │  │                                          │
│  │  │ Alias Az: 100 (56%)      │  │                                          │
│  │  │ Alias Ct: 100 (56%)      │  │                                          │
│  │  └──────────────────────────┘  │                                          │
│  │                                │                                          │
│  │  ┌─ WIZARD: Prossima Azione ┐  │                                          │
│  │  │                          │  │                                          │
│  │  │  Step 1: Scarica Profili │  │                                          │
│  │  │  [178 mancanti]          │  │                                          │
│  │  │  ▶ AVVIA DOWNLOAD        │  │                                          │
│  │  │                          │  │                                          │
│  │  │  (completato? → next)    │  │                                          │
│  │  │  Step 2: Deep Search     │  │                                          │
│  │  │  Step 3: Genera Alias    │  │                                          │
│  │  └──────────────────────────┘  │                                          │
│  │                                │                                          │
│  │  ┌─ LISTA PARTNER ──────────┐  │                                          │
│  │  │ [Search] [Sort]          │  │                                          │
│  │  │ partner 1...             │  │                                          │
│  │  │ partner 2...             │  │                                          │
│  │  └──────────────────────────┘  │                                          │
│  └────────────────────────────────┘                                          │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Dettaglio implementativo

#### 1. `Operations.tsx` -- Aggiungere stato `activeCountryTab`

- Nuovo stato: `const [activeTab, setActiveTab] = useState(0)` -- indice del paese attivo tra `selectedCountries`
- Il paese attivo determina il `countryCode` singolo passato a `PartnerListPanel`
- Tab bar sopra il pannello sinistro con bandierina + nome per ogni paese selezionato
- Reset tab a 0 quando si cambia selezione paesi

#### 2. `PartnerListPanel.tsx` -- Refactoring completo in 3 sezioni

Riceve UN SOLO `countryCode` (non piu' array). Questo risolve il bug dei numeri sbagliati.

**Sezione A: Dashboard Paese (compatta, sempre visibile)**
- Griglia 2x4 con i contatori reali per QUEL paese:
  - Directory (da `directory_cache`) | Scaricati (da `partners` count)
  - Con Profilo | Senza Profilo
  - Con Email | Con Telefono
  - Deep Search | Alias
- Ogni cella mostra: valore / totale + barra percentuale colorata
- Click su una cella = filtra la lista sotto

**Sezione B: Wizard "Prossima Azione" (cuore della UX)**
- Calcola automaticamente qual e' la prossima azione utile in base ai gap:
  1. Se mancano profili → mostra "Scarica Profili" con bottone grosso + delay slider
  2. Se profili OK ma manca Deep Search → mostra "Avvia Deep Search" con conteggio
  3. Se Deep OK ma mancano Alias → mostra "Genera Alias" con conteggio
  4. Se tutto completato → mostra badge verde "Paese completato!"
- Ogni step ha:
  - Titolo chiaro (es. "Step 1: Scarica 178 Profili Mancanti")
  - Bottone grosso colorato per avviare
  - Indicatore di progresso se job attivo
  - Steps futuri visibili ma grigi/disabilitati
- Il wizard mostra TUTTI gli step come lista verticale, con lo step attivo evidenziato e gli altri grigi

**Sezione C: Lista Partner (invariata)**
- Search + Sort + ScrollArea con partner cards
- Click su partner → dettaglio nel pannello destro

#### 3. Pannello Destro (`Operations.tsx`)
- Se partner selezionato: `PartnerDetailCompact` (invariato)
- Se nessun partner: Riepilogo compatto del paese attivo con stats + terminal/job monitor se attivi

### Flusso dati corretto

- `usePartners({ countries: [activeCountryCode] })` -- UN paese alla volta
- `useCountryStats()` -- filtrato per `activeCountryCode` da `statsData.byCountry[activeCountryCode]`
- `directory_cache` query filtrata per singolo `countryCode`
- I conteggi download (`noProfileIds`, `cachedMembers`, etc.) tutti scoped al singolo paese

### File modificati

1. **`src/pages/Operations.tsx`**
   - Aggiungere `activeTab` state e tab bar
   - Passare singolo `countryCode` a `PartnerListPanel` invece di array
   - Pannello destro: detail partner o riepilogo paese

2. **`src/components/operations/PartnerListPanel.tsx`**
   - Cambiare props: `countryCode: string` (singolo) invece di `countryCodes: string[]`
   - Rifattorizzare in 3 sezioni: Dashboard + Wizard + Lista
   - Wizard step-by-step con logica automatica di suggerimento prossima azione
   - Rimuovere i 4 ActionButton attuali e le 6 ProgressBar separate
   - Integrare i controlli download (network, mode, delay, start) dentro lo step 1 del wizard

