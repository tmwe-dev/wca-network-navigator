

# Fix: Stato Esplorazione Reale e "Salva Solo ID" Funzionante

## Problemi Identificati

### 1. "Esplorato" mostrato in modo ingannevole
Il sistema segna un paese come "esplorato" (sfondo verde) se ha **qualsiasi** partner nel DB (`pCount > 0 || cCount > 0`). Gli Stati Uniti hanno 1 solo partner importato manualmente, ma non sono mai stati scansionati. Il sistema li mostra come "esplorati" ingannando l'utente.

**Fix**: Un paese e "esplorato" SOLO se ha una entry nella `directory_cache` (cioe la lista directory e stata effettivamente scaricata). Avere partner nel DB senza directory cache significa "dati parziali, lista non scaricata".

### 2. Informazioni nelle card paese insufficienti
Attualmente si vede "1 partner" per US ma non si sa quanti ce ne sono realmente nella directory WCA. Il badge "DB" e poco chiaro.

**Fix**: Tre stati distinti nelle card:
- **Nessun dato**: solo codice paese (come ora)
- **Partner nel DB ma lista non scaricata**: mostra "1 partner (lista ?)" con colore diverso (arancione/warning) per indicare dati incompleti
- **Lista scaricata**: mostra "X/Y" (partner scaricati / totale nella directory) con il badge verificato se `download_verified = true`

### 3. "Salva solo lista ID" non fa nulla di utile
Il bottone appare solo se ci sono gia dati in cache, e cliccandolo mostra un toast e torna indietro senza fare nulla di nuovo. La cache e gia stata salvata durante la scansione.

**Fix**: Il bottone "Salva solo lista ID" deve:
- Se la cache esiste gia: confermare e tornare alla selezione (comportamento attuale, corretto)
- Se la cache NON esiste: la scansione deve essere avviata PRIMA. Il bottone appare solo dopo la scansione o se ci sono dati dalla cache.
- Rendere piu chiaro il flusso: dopo la scansione, il bottone "Salva solo lista ID" conferma che i dati sono salvati e torna indietro. Il toast dice esplicitamente che la lista e stata salvata nella cache.

### 4. Filtro "Gia esplorati" include paesi non scansionati
Il filtro conta come "esplorati" paesi che hanno solo partner nel DB ma nessuna scansione.

**Fix**: "Gia esplorati" = ha entry in `directory_cache`. Aggiungere un nuovo filtro "Dati parziali" per paesi con partner ma senza directory cache.

---

## Dettagli Tecnici

### File: `src/pages/DownloadManagement.tsx`

**PickCountry** (linee ~496-548):

Cambiare la definizione di `isExplored`:
```text
// PRIMA (sbagliato):
const isExplored = pCount > 0 || cCount > 0;

// DOPO (corretto):
const hasDirectoryScan = cCount > 0;  // Ha la lista dalla directory
const hasDbOnly = pCount > 0 && cCount === 0;  // Solo partner nel DB, mai scansionato
```

Aggiornare le card:
- Sfondo verde gradient: solo se `hasDirectoryScan`
- Per `hasDbOnly`: mostrare "X partner (lista ?)" con sfondo arancione/warning per indicare che non si sa il totale
- Per `hasDirectoryScan`: mostrare "X/Y" come ora
- Badge "Completo" con checkmark: solo se `download_verified === true`

Aggiornare i filtri (linee ~406, 424-425):
- `exploredSet` basato solo su `directory_cache` (non `partners`)
- Aggiungere filtro "Dati parziali" per paesi con partner ma senza scansione

**DirectoryScanner** (linee ~950-957):
- Il bottone "Salva solo lista ID" rimane visibile quando `totalCount > 0` (post-scansione o da cache)
- Nessun cambiamento necessario al bottone in se — il comportamento attuale (toast + torna indietro) e corretto perche la cache viene gia salvata automaticamente durante la scansione
- Migliorare il testo del toast per essere piu esplicito

### Nessuna modifica al database
Le colonne `download_verified` e `verified_at` esistono gia nella `directory_cache`.

