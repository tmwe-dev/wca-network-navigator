

## Piano: Pagina di Test "Brand New" per Download Profili ZA

### Cosa creo

Una pagina `/test-download` completamente indipendente dal processore esistente. Nessun codice condiviso con `useDownloadProcessor`. Comunicazione diretta con l'estensione via `postMessage`.

### Struttura

**1 nuovo file:** `src/pages/TestDownload.tsx`

- Un bottone "Avvia Test"
- Lista hardcoded di WCA ID del Sudafrica: `[62345, 91027, 90991, 118343, 115505]`
- Per ogni ID, apre la comunicazione diretta con l'estensione (senza passare per `useExtensionBridge` o `enqueueExtraction` -- codice inline puro)
- Canvas/terminale sotto il bottone che mostra ogni step in tempo reale:
  - `[HH:MM:SS] START #62345`
  - `[HH:MM:SS] Extension responded: htmlLength=XXXXX, companyName="...", contacts=N`
  - `[HH:MM:SS] H1 text: "..."`
  - `[HH:MM:SS] DONE #62345 in 14.2s`
- Delay configurabile tra richieste (slider 5s-60s, default 25s)
- Tenta anche URL alternativo: prima `wcaworld.com`, poi se "not found" riprova con `wcadangerousgoods.com` (per verificare se il dominio fa differenza)

**1 modifica:** `src/App.tsx` -- aggiunge route `/test-download`

### Approccio tecnico

Il codice di comunicazione con l'estensione e scritto da zero inline nella pagina, senza importare `useExtensionBridge`. Un semplice `window.postMessage` + listener per la risposta. Cosi isoliamo completamente il test dal codice esistente.

Per ogni profilo logga:
- Tempo di risposta
- `htmlLength` esatto
- Testo del tag H1
- Numero contatti trovati
- Se il profilo contiene "Members only" (indica sessione non autenticata)
- Confronto tra dominio `wcaworld.com` vs `wcadangerousgoods.com`

### File coinvolti

1. **`src/pages/TestDownload.tsx`** -- pagina nuova da zero
2. **`src/App.tsx`** -- aggiunta route

