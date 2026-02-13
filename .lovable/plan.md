

# Riscrittura Completa: Meccanismo di Ricerca RA Extension

## Problema Fondamentale

L'estensione attuale tenta di compilare campi form (`input[name="ateco"]`) che **non esistono** sulla pagina. La "Ricerca Avanzata" di ReportAziende.it usa un sistema a **modali Bootstrap**:

- Ogni filtro (ATECO, Geografia, Fatturato, ecc.) apre una modale separata (`#MODALsettoreAteco`, `#MODALgeografica`, ecc.)
- I valori vengono salvati come hidden inputs nel form `cercaAvanzataForm`
- Il pulsante "Cerca" attiva un'ulteriore CTA gate (per utenti non abbonati), ma per gli abbonati esegue il submit
- La pagina di destinazione per la ricerca e' `/search.php?tab=2`

## Strategia: Approccio a Due Livelli

### Livello 1: Submit POST diretto (approccio primario)

Anziche' interagire con modali (fragile), costruire direttamente la richiesta POST con i parametri corretti. L'estensione:

1. Apre la pagina `/search.php?tab=2` in un tab (per avere le cookies)
2. Inietta uno script che:
   - Crea hidden inputs nel form `cercaAvanzataForm` con i nomi parametro corretti
   - Esegue `form.submit()` direttamente (bypassa la CTA gate)
3. Attende il caricamento dei risultati
4. Estrae i dati dalla DataTable

### Livello 2: Interazione con Modali (fallback)

Se il POST diretto non funziona, lo script:
1. Apre la modale appropriata (`#MODALsettoreAteco`)
2. Compila i campi dentro la modale
3. Clicca "Applica" nella modale
4. Ripete per ogni filtro
5. Clicca "Cerca" del form principale

## Modifiche Tecniche

### File: `public/ra-extension/background.js`

**1. Riscrivere `fillAndSubmitSearchForm` (righe 312-382)**

Sostituire completamente la funzione con una che:
- Riceve i parametri (atecoCodes, regions, provinces, fatturato_min/max, dipendenti_min/max, filtro contatti)
- Crea programmaticamente i hidden inputs nel form `cercaAvanzataForm`
- I nomi dei campi saranno determinati analizzando le modali del sito
- Esegue `document.querySelector('#cercaAvanzataForm').submit()`

```text
function fillAndSubmitSearchForm(params) {
  // 1. Trova il form cercaAvanzataForm
  // 2. Crea hidden inputs per ogni filtro:
  //    - ATECO: apre #MODALsettoreAteco, compila, applica
  //    - Geografia: apre #MODALgeografica, seleziona regione/provincia
  //    - Fatturato: apre #MODALfatturato, imposta min/max
  //    - Dipendenti: apre #MODALnumeroDipendenti, imposta min/max
  //    - Contatti: apre #MODALcontatti, seleziona opzione
  // 3. Submit del form
}
```

**2. Aggiungere funzione di discovery dei campi modale**

Una funzione iniettata nel tab che:
- Apre ogni modale una alla volta
- Legge i nomi degli input fields dentro le modali
- Ritorna una mappa dei field names corretti
- Questa funzione verra' usata una volta per scoprire i parametri, poi li memorizzeremo

**3. Riscrivere `scrapeSearchResults` (righe 425-494)**

- Cambiare URL da `searchPersonalizzata.php` a `search.php?tab=2`
- Usare la nuova `fillAndSubmitSearchForm`
- Aggiungere logica di retry con auto-login se sessione scaduta
- Migliorare il rilevamento della CTA gate come indicatore di sessione non valida

**4. Aggiungere funzione `discoverFormFields`**

Nuova funzione che viene eseguita una volta per scoprire i nomi esatti dei campi nelle modali:

```text
async function discoverFormFields() {
  // Apre /search.php?tab=2
  // Per ogni modale (#MODALsettoreAteco, #MODALgeografica, ecc.):
  //   - Apre la modale via JS
  //   - Legge tutti gli input/select dentro la modale
  //   - Salva nome e tipo del campo
  // Ritorna la mappa dei campi
}
```

**5. Migliorare `extractSearchResults` (righe 239-309)**

- Adattare l'estrazione alla struttura della pagina risultati di Ricerca Avanzata
- Aggiungere fallback per strutture DataTable diverse
- Estrarre anche il conteggio totale risultati piu' accuratamente

### File: `src/hooks/useRAExtensionBridge.ts`

Nessuna modifica necessaria -- il bridge gia' supporta tutti i metodi richiesti (`searchOnly`, `scrapeSelected`, parametri filtri).

### File: `src/components/prospects/` (UI)

Nessuna modifica necessaria -- l'interfaccia utente e' gia' pronta.

## Flusso Operativo Finale

```text
Utente seleziona filtri nella webapp
         |
         v
searchOnly() --> estensione
         |
         v
Apre tab: /search.php?tab=2
         |
         v
Controlla sessione (no CTA gate = loggato)
         |
    [Se non loggato] --> autoLogin() --> retry
         |
         v
Inietta script: interagisce con modali
  - Apre #MODALsettoreAteco --> imposta ATECO
  - Apre #MODALgeografica --> imposta regione/provincia
  - Apre #MODALfatturato --> imposta min/max
  - Submit form
         |
         v
Attende caricamento risultati (DataTable)
         |
         v
Inietta extractSearchResults() --> lista aziende
         |
         v
Ritorna risultati alla webapp
```

## Rischio e Mitigazione

- **Rischio**: I nomi dei campi nelle modali potrebbero cambiare. **Mitigazione**: La funzione `discoverFormFields` li scopre dinamicamente.
- **Rischio**: La CTA gate blocca il submit per non-abbonati. **Mitigazione**: Usiamo `form.submit()` diretto che bypassa il bottone JS.
- **Rischio**: Le modali caricano contenuto via AJAX. **Mitigazione**: Attendiamo il rendering dopo l'apertura della modale.

## Primo Step Pratico

Prima di scrivere il codice finale, servira' un'esecuzione di discovery: far aprire le modali all'estensione e raccogliere i nomi esatti dei campi. Questo ci permettera' di costruire il POST diretto senza dover interagire con le modali ogni volta.

## File da Modificare

- `public/ra-extension/background.js` -- riscrittura `fillAndSubmitSearchForm`, `scrapeSearchResults`, aggiunta `discoverFormFields`

