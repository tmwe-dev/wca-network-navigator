

## Miglioramenti alla Barra Performance Network e Logica di Auto-Esclusione

### Problema attuale
La barra dei network mostra le icone ordinate per tasso di successo, ma:
- I network che falliscono non sono chiaramente separati visivamente (non c'e' una sezione "rossi a destra")
- La soglia di auto-esclusione e' impostata a 5 partner (troppo alta, l'utente vuole 2-3)
- Non c'e' un alert specifico quando network che normalmente funzionano iniziano a fallire (possibile bug/sessione)
- Manca la conferma prima dell'auto-esclusione

### Modifiche previste

**1. NetworkPerformanceBar - Separazione visiva buoni/cattivi**
- Dividere la barra in due gruppi: a sinistra i network con contatti (bordo verde/ambra), a destra quelli senza (bordo rosso)
- Aggiungere un separatore verticale tra i due gruppi
- I network esclusi restano a destra con overlay "Ban"
- Aggiungere contatore testuale: es. "6 attivi | 2 senza dati"

**2. Soglia auto-esclusione ridotta a 3**
- Modificare `AUTO_EXCLUDE_THRESHOLD` da 5 a 3 in `AcquisizionePartner.tsx`
- Prima di escludere, mostrare un toast con pulsante "Annulla" (conferma implicita: se non annulli entro 5s, viene escluso)

**3. Alert per network normalmente funzionanti che smettono di funzionare**
- Tracciare un "baseline" per ogni network: se un network ha avuto almeno 2 successi e poi produce 3 fallimenti consecutivi, mostrare un alert arancione nella live stats bar
- Questo indica un possibile problema di sessione o bug, distinto dal caso di network che non hanno mai dato contatti

**4. Verifica approccio download-then-process**
- Confermato: il codice attuale gia' scarica l'intera scheda tramite estensione Chrome (`extractContactsForId` apre il tab, aspetta il caricamento, poi estrae i dati dalla pagina). L'inserimento in DB avviene dopo l'estrazione. L'approccio e' corretto.

### Dettagli tecnici

**File: `src/components/acquisition/NetworkPerformanceBar.tsx`**
- Separare `entries` in due array: `activeEntries` (rate > 0 o troppo pochi dati) e `failedEntries` (rate === 0 con almeno 3 tentativi)
- Mostrare `activeEntries` a sinistra, separatore, `failedEntries` a destra con sfondo rosso
- Aggiungere label riassuntive

**File: `src/pages/AcquisizionePartner.tsx`**
- Cambiare `AUTO_EXCLUDE_THRESHOLD` da 5 a 3
- Aggiungere logica di "regression detection": nuovo stato `networkBaseline` che traccia i network che hanno avuto successo e poi iniziano a fallire
- Quando rilevata regressione, mostrare banner di avviso nella live stats bar con icona AlertTriangle arancione

