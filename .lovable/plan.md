

# Fix Download Intelligente - Problemi Critici

## Diagnosi: Perche' non succede niente

Ho trovato **4 problemi** nel codice attuale che spiegano perche' la ricerca resta bloccata senza feedback:

### Problema 1: URL di ricerca sbagliato (CRITICO)
L'estensione costruisce un URL GET tipo:
```
https://www.reportaziende.it/ricerca-personalizzata?ateco=49.10&fatturato_min=100000000
```
Ma Report Aziende usa un **form POST** su `searchPersonalizzata.php`. L'URL GET probabilmente restituisce una pagina vuota o un redirect, quindi non trova nulla.

### Problema 2: Nessun feedback durante la ricerca
L'interfaccia mostra "Ricerca in corso..." ma il polling dello stato (che mostra progresso, log, ecc.) si attiva **solo nella fase "scraping"**, non durante la fase "searching". Quindi resti bloccato su uno spinner muto per fino a 10 minuti.

### Problema 3: Selettori DOM generici
La funzione `extractSearchResults` usa selettori generici come `table tbody tr, .result-item` che probabilmente non corrispondono alla struttura HTML reale di Report Aziende (DataTable con paginazione server-side).

### Problema 4: Nessun timeout visibile
Se l'estensione non risponde, il timeout e' 10 minuti. L'utente non ha modo di sapere se sta funzionando o se e' bloccato.

---

## Piano di correzione

### Step 1: Fix URL e metodo di ricerca nell'estensione
Modificare `scrapeSearchResults` in `public/ra-extension/background.js` per:
- Navigare alla pagina `searchPersonalizzata.php`
- Compilare il form via script injection (come fa `autoLogin`)
- Usare i nomi di campo corretti del form POST di RA
- Sottomettere il form e attendere la risposta DataTable

### Step 2: Aggiungere feedback in tempo reale durante la Fase 1
- Attivare il polling dello stato anche quando `phase === "searching"`
- La funzione `runSearchOnly` gia' chiama `addLog()` — basta che il frontend le legga
- Modificare `ProspectImporter.tsx` per mostrare i log durante la ricerca

### Step 3: Aggiornare i selettori DOM per RA
- Analizzare la struttura HTML reale di DataTable usata da RA
- Aggiornare `extractSearchResults` con selettori specifici per la tabella risultati di RA
- Estrarre anche P.IVA e citta' dalla lista (se visibili)

### Step 4: Aggiungere pulsante "Annulla" durante la ricerca
- Permettere di interrompere la Fase 1 come si puo' gia' fare con la Fase 2
- Mostrare un timer/contatore per sapere da quanto tempo sta cercando

---

## Dettagli tecnici

### File da modificare

**`public/ra-extension/background.js`**
- Riscrivere `scrapeSearchResults()`: navigare a `searchPersonalizzata.php`, iniettare script che compila il form con i parametri corretti, sottomettere, estrarre risultati dal DataTable
- Aggiungere nuova funzione `fillSearchForm(params)` da iniettare nella pagina
- Aggiornare `extractSearchResults()` con selettori specifici per DataTable di RA

**`src/components/prospects/ProspectImporter.tsx`**
- Estendere il `useEffect` del polling per attivarsi anche in fase "searching"
- Mostrare log in tempo reale durante la ricerca
- Aggiungere pulsante "Annulla ricerca" nella fase "searching"
- Aggiungere indicatore di tempo trascorso

**`public/download-ra-extension.html`**
- Aggiornare per includere il nuovo `background.js` con le correzioni

### Flusso corretto dopo la fix

1. Utente seleziona ATECO "49.10" e filtro fatturato > 100M
2. Clicca "Cerca Aziende"
3. L'estensione apre un tab nascosto su `searchPersonalizzata.php`
4. Inietta uno script che compila il form con `ateco=49.10` e `fatturato_min=100000000`
5. Sottomette il form
6. Attende il caricamento della DataTable
7. Estrae i risultati (nome, URL, P.IVA se visibile)
8. Se ci sono piu' pagine, naviga alle successive
9. **Durante tutto questo**, il frontend mostra i log in tempo reale
10. Al termine, mostra la lista risultati con deduplicazione

