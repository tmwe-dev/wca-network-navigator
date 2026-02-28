

## Analisi: Download Vietnam senza Directory

Il flusso attuale per scaricare un paese senza dati in directory richiede due passaggi:

1. **Selezionare il paese** nella CountryGrid (Vietnam appare quando si ordina per nome o si usa il filtro "missing")
2. **Avviare la scansione directory** dal PartnerListPanel che appare a destra - il pulsante "Scansiona Directory" lancia `scrapeWcaDirectory` che popola la `directory_cache`
3. **Poi scaricare** i profili con il pulsante Download

### Problema di UX

Quando un paese non ha dati in directory ne nel database, il PartnerListPanel mostra 0 partner e il wizard di download non ha WCA ID da processare. Il pulsante "Scansiona Directory" dovrebbe essere l'azione primaria e ben visibile, ma potrebbe non essere abbastanza evidente.

### Piano

#### 1. Rendere il pulsante "Scansiona Directory" prominente per paesi vuoti (`PartnerListPanel.tsx`)

Quando `!hasCache && dbPartners.length === 0`, mostrare un empty state dedicato con:
- Messaggio chiaro: "Nessun dato per [Paese]. Scansiona la directory WCA per iniziare."
- Pulsante primario grande "Scansiona Directory"
- Opzionalmente un pulsante "Clean + Download" che avvia scansione + download automatico (`dirThenDownload`)

#### 2. Migliorare la visibilità nella CountryGrid (`CountryGrid.tsx`)

Per i paesi senza dati (grigio, label "—"), aggiungere un'icona o tooltip che indichi "Scansiona per iniziare". Il paese è già visibile e selezionabile, serve solo un hint visivo.

### File da modificare
- `src/components/operations/PartnerListPanel.tsx` — empty state prominente con CTA scansione per paesi senza directory
- `src/components/download/CountryGrid.tsx` — hint visivo per paesi non ancora esplorati

