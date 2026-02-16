

# Redesign Completo Operations Center

## Problema Attuale
L'interfaccia attuale mescola filtri e ordinamenti nella stessa area con chip identici, rendendo impossibile distinguerli. Lo stato dei paesi (scaricato, senza profilo, parziale) non e' immediatamente comprensibile. L'utente deve "interpretare" i dati invece di agire.

## Nuova Architettura UI

### Layout Generale (invariato: 35/65)

```text
+---------------------------------------------------------------+
|  TOP BAR: titolo, job attivi, SpeedGauge, sessione, tema       |
+---------------------------------------------------------------+
|  DASHBOARD: 6 card statistiche grandi con icone e progressi    |
+---------------------------------------------------------------+
|                    |                                            |
|  PANNELLO PAESI    |  PANNELLO CONTESTUALE                     |
|  35%               |  65%                                      |
|                    |                                            |
|  [Barra ricerca]   |  (Tab: Partner / Scarica / Acquisisci)    |
|                    |                                            |
|  ┌──────────────┐  |                                            |
|  │ SEZIONE      │  |                                            |
|  │ FILTRI       │  |                                            |
|  │ (etichetta)  │  |                                            |
|  └──────────────┘  |                                            |
|  ┌──────────────┐  |                                            |
|  │ SEZIONE      │  |                                            |
|  │ ORDINAMENTO  │  |                                            |
|  │ (etichetta)  │  |                                            |
|  └──────────────┘  |                                            |
|  ┌──────────────┐  |                                            |
|  │ SELEZIONE    │  |                                            |
|  │ (bandiere)   │  |                                            |
|  └──────────────┘  |                                            |
|                    |                                            |
|  [Lista paesi      |                                            |
|   scrollabile]     |                                            |
|                    |                                            |
+---------------------------------------------------------------+
```

### 1. Dashboard Globale Potenziata
Sostituire la barra piatta con **6 mini-card** in griglia (3x2) piu' leggibili:
- Paesi scansionati / Totale paesi
- Partner nel DB
- Con profilo / Senza profilo (con barra progresso)
- Email trovate (con %)
- Telefoni trovati (con %)
- Totale in directory WCA

Ogni card ha icona grande, valore in grassetto e una piccola barra di progresso dove applicabile.

### 2. Country Grid -- Filtri e Ordinamenti Separati

**Sezione FILTRA** (con etichetta "FILTRA PER STATO" ben visibile):
- Titolo sezione esplicito con icona Filter
- Chip colorati per stato, ognuno con colore semantico fisso:
  - Verde: "Completati" (tutto scaricato + profili ok)
  - Arancione: "Senza Profilo" (scaricati ma manca raw_profile_html)
  - Blu: "Download Parziale" (non tutti i partner dalla directory)
  - Grigio: "Mai Esplorati" (nessun dato)
  - Bianco: "Tutti"

**Sezione ORDINA** (con etichetta "ORDINA PER" ben visibile):
- Titolo sezione esplicito con icona ArrowUpDown
- Bottoni segmentati (non chip) con freccia su/giu':
  - Nome A-Z
  - N. Partner
  - Directory
  - % Completamento

Le due sezioni sono visualmente separate con bordi, sfondi diversi e titoli in maiuscolo.

### 3. Card Paese Ridisegnate
Ogni card paese mostra in modo ultra-chiaro:
- **Lato sinistro**: Bandiera grande + nome paese
- **Centro**: 3 indicatori mini con icone:
  - Partner scaricati vs directory (es. "45/120")
  - Profili presenti (es. "30/45")  
  - Email trovate (es. "25/45")
- **Lato destro**: Grande badge colorato di stato:
  - Cerchio verde con checkmark = Completo
  - Cerchio arancione con "!" = Senza profilo
  - Cerchio blu con freccia giu' = Parziale
  - Cerchio grigio con "?" = Mai esplorato
- **Barra progresso** in basso che mostra visivamente la completezza totale

### 4. Selezione e Azioni
- Bandiere selezionate spostate sopra la lista in un'area dedicata con bordo tratteggiato
- Pulsante "Seleziona tutti i visibili" posizionato chiaramente
- Toggle "Solo Directory" e "Mostra tutti" raggruppati in una riga separata

## Dettagli Tecnici

### File modificati:

**`src/components/download/CountryGrid.tsx`** -- Riscrittura completa:
- Separare filtri e ordinamenti in due sezioni con titoli espliciti e stili diversi
- Aggiungere icone semantiche per ogni stato (CheckCircle verde, AlertTriangle arancione, ArrowDown blu, HelpCircle grigio)
- Ridisegnare le card paese con layout a 3 colonne (flag+nome | stats | status badge)
- Aggiungere barra di progresso composita (download + profili + email)

**`src/pages/Operations.tsx`** -- Aggiornamento dashboard:
- Sostituire la barra statistiche con una griglia di 6 mini-card
- Aggiungere stat "Con profilo" e "Senza profilo" dalla `useCountryStats`
- Usare `useCountryStats` al posto di `useGlobalStats` per eliminare query ridondanti
- Aggiungere barre di progresso nelle card statistiche

### Dati:
- Nessuna modifica al database o alle RPC -- si usa `get_country_stats()` gia' esistente
- Eliminare la query `useGlobalStats` duplicata a favore di `useCountryStats` che ha gia' tutti i dati necessari

