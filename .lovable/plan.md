

# Analisi: Profili "non trovati" durante il download

## Causa radice identificata

Nel file `src/hooks/useDownloadProcessor.ts` (riga 177-179) c'e un **timeout di 4 secondi** che compete con l'estrazione del profilo:

```text
const timeout4s = new Promise(r => setTimeout(() => r({
  success: false, error: "Timeout 4s", pageLoaded: false
}), 4000));

const result = await Promise.race([extractContacts(wcaId), timeout4s]);
```

Ma l'estensione Chrome (background.js) per completare l'estrazione deve:

1. Aprire un nuovo tab (0.5-2s)
2. Caricare la pagina WCA con `waitForTabLoad` (fino a 30s)
3. Verificare che la pagina sia caricata (`checkPageLoaded`)
4. Eseguire lo script di estrazione (`extractFullProfileFromPage`)
5. Salvare i contatti sul server (`sendContactsToServer`)
6. Chiudere il tab e rispondere

Tempo reale tipico: **5-15 secondi**. Massimo: **35 secondi**.

Il timeout di 4 secondi scade PRIMA che l'estensione finisca, quindi:
- Il processore riceve `pageLoaded: false` dal timeout
- Il profilo viene marcato come "skipped" / "non caricato"
- Il contatore `contacts_missing` aumenta
- Il profilo viene saltato definitivamente (politica Zero Retry)

## Effetto collaterale nascosto

L'estensione continua a lavorare in background anche dopo il timeout del processore. Se trova contatti, li salva comunque sul server tramite `sendContactsToServer`. Quindi i dati ESISTONO nel database, ma il processore non li vede e li conta come "mancanti".

## Soluzione proposta

### File: `src/hooks/useDownloadProcessor.ts`

Aumentare il timeout da **4 secondi a 40 secondi**, allineandolo al timeout dell'estensione (30s per il caricamento della pagina + margine per estrazione e salvataggio).

```text
PRIMA:
  const timeout4s = new Promise(r =>
    setTimeout(() => r({ success: false, error: "Timeout 4s", pageLoaded: false }), 4000)
  );

DOPO:
  const timeout40s = new Promise(r =>
    setTimeout(() => r({ success: false, error: "Timeout 40s", pageLoaded: false }), 40000)
  );
```

Questa e l'unica modifica necessaria. Nessun altro file coinvolto.

### Perche 40 secondi

- L'estensione ha un timeout di caricamento tab di 30 secondi
- Dopo il caricamento, servono 1-3 secondi per l'estrazione
- Dopo l'estrazione, servono 1-3 secondi per il salvataggio server-side
- 40 secondi copre tutti questi scenari con margine

### Rischi

Nessuno. Il checkpoint `waitForGreenLight` (15 secondi tra le richieste) resta invariato. Il tempo totale per profilo diventa al massimo ~55 secondi nel caso peggiore (15s attesa + 40s estrazione), ma nella pratica resta ~20-25 secondi (15s attesa + 5-10s estrazione). I profili che oggi vengono erroneamente saltati verranno invece processati correttamente.

