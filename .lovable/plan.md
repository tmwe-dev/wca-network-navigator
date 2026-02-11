

# Refactoring completo: Pipeline di acquisizione partner

## Problemi trovati

Ho analizzato tutto il codice e il database. Ecco la situazione attuale:

1. **Il cookie nel DB e' valido** — `.ASPXAUTH` presente, `wca_session_status = ok`
2. **L'ultimo job e' stato cancellato** con errore "Estensione Chrome non disponibile"
3. **Il bridge dell'estensione non viene rilevato** — `extensionAvailable` resta `false` perche' il sistema di ping via `window.postMessage` non funziona nell'iframe di Lovable

Il problema e' che il sistema ha DUE blocchi di sicurezza che si attivano in sequenza e bloccano tutto:
- Blocco 1: `startPipeline` chiama `triggerCheck()` — se non ritorna "ok", mostra l'alert "Sessione WCA Non Attiva" e NON parte
- Blocco 2: nel loop, se l'estensione non risponde al ping, mostra "Estensione Chrome necessaria" e mette in pausa

Questi due blocchi si sovrappongono e creano confusione: anche con sessione OK, se l'estensione non risponde al ping il sistema si ferma.

## Soluzione: refactoring in 3 parti

### Parte 1: Separare la verifica sessione dalla verifica estensione

**File**: `src/pages/AcquisizionePartner.tsx`

Attualmente `startPipeline` chiama `triggerCheck()` che va alla Edge Function. Problema: la Edge Function controlla solo il cookie nel DB, non se l'estensione funziona davvero.

Cambio:
- `startPipeline` verifica PRIMA se l'estensione risponde (con timeout generoso di 5s e 5 tentativi)
- Se l'estensione risponde: chiede all'estensione di fare `verifySession` (test reale su WCA)
- Se l'estensione NON risponde: mostra un messaggio CHIARO e specifico ("Installa/ricarica l'estensione Chrome") invece del generico "Sessione non attiva"
- ELIMINARE la chiamata a `triggerCheck()` nel `startPipeline` — la verifica avviene SOLO tramite l'estensione

```text
Flusso PRIMA (confuso):
  startPipeline -> triggerCheck() -> Edge Function -> DB check -> ???
  loop -> extensionAvailable? -> no -> "Estensione necessaria" + pausa

Flusso DOPO (chiaro):
  startPipeline -> checkExtension(5 tentativi) 
    -> SI: verifySession() -> sessione OK? -> PARTI
    -> SI: verifySession() -> sessione NO? -> "Rilogga su WCA"
    -> NO: "Installa/ricarica l'estensione" (messaggio specifico)
```

### Parte 2: Rendere il bridge piu' resiliente

**File**: `src/hooks/useExtensionBridge.ts`

Problemi attuali:
- Il polling pinga ogni 5 secondi, ma si ferma dopo la prima risposta
- `checkAvailable` fa solo 3 tentativi con 2s di timeout (troppo corto)
- Se l'estensione si carica DOPO il hook, non viene mai rilevata

Cambio:
- Polling CONTINUO ogni 3 secondi (non si ferma mai) per rilevare l'estensione anche se viene installata/ricaricata dopo il caricamento della pagina
- `checkAvailable` con 5 tentativi e 3s di timeout ciascuno
- Aggiungere un metodo `waitForExtension(maxWaitMs)` che aspetta fino a N secondi per il primo ping riuscito

### Parte 3: Semplificare il loop di estrazione

**File**: `src/pages/AcquisizionePartner.tsx`

Il loop `runExtensionLoop` ha troppa logica duplicata:
- Controlla `extensionAvailable` ad ogni partner (riga 179)
- Ha la verifica sessione ogni 3 partner (riga 251)
- Ha il rilevamento di profili vuoti consecutivi (riga 310)
- Ha un controllo speciale per il primo partner (riga 294)

Tutto questo puo' essere consolidato:

1. **Rimuovere il check `extensionAvailable` dal loop** — se la pipeline e' partita, l'estensione e' stata gia' verificata
2. **Unificare la verifica sessione**: solo la verifica ogni 3 partner tramite estensione. Rimuovere `triggerCheck()` dal loop (riga 295) e il check speciale al primo partner
3. **Se l'estensione smette di rispondere durante il loop**: tentare 3 volte, poi pausa con messaggio chiaro

### Parte 4: Pulire la toolbar

**File**: `src/components/acquisition/AcquisitionToolbar.tsx`

- Rimuovere il badge "WCA Connesso/Sessione Scaduta" basato su `useWcaSessionStatus` — questa info viene dalla Edge Function che guarda solo il DB e crea confusione
- L'unica info affidabile sulla sessione arriva dall'estensione (che fa il test reale su WCA)
- Il badge dell'estensione (Plug verde/grigio) e l'indicatore Session Health nel loop sono sufficienti

### Parte 5: Neutralizzare definitivamente la Edge Function `process-download-job`

**File**: `supabase/functions/process-download-job/index.ts`

Verificare che non ci siano residui di chiamate a `scrape-wca-partners`. Il file e' gia' stato modificato ma va ricontrollato per sicurezza.

## File modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Separare verifica estensione da sessione, semplificare loop, rimuovere triggerCheck dal flusso di avvio |
| `src/hooks/useExtensionBridge.ts` | Polling continuo, checkAvailable piu' robusto, waitForExtension() |
| `src/components/acquisition/AcquisitionToolbar.tsx` | Rimuovere badge sessione basato su Edge Function |

## Risultato

- Messaggio CHIARO: se l'estensione non c'e' dice "Installa l'estensione", non "Sessione scaduta"
- Messaggio CHIARO: se la sessione e' scaduta dice "Rilogga su WCA", non "Sessione non attiva"
- Bridge piu' resistente: rileva l'estensione anche se caricata dopo la pagina
- Loop semplificato: una sola verifica (ogni 3 partner via estensione), niente Edge Functions nel mezzo
- Zero confusione tra "estensione assente" e "sessione scaduta"
