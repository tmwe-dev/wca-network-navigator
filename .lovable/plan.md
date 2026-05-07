
# Auto-sync WhatsApp agganciato a ConnectionStatusBar + cicli irregolari

## A. Aggancio al servizio già esistente (no nuovi sistemi)

L'utente attiva i servizi dal pannello connessioni a sinistra (`ConnectionStatusBar` → cursori verdi per LinkedIn / WhatsApp / Partner Connect / AI Agent).

**Regola**: l'auto-sync WhatsApp parte **automaticamente** quando il cursore WhatsApp diventa verde (estensione connessa + sessione autenticata). Si ferma quando torna grigio/rosso. Nessun toggle separato dedicato. Lo stesso pulsante che oggi attiva il servizio diventa anche l'interruttore implicito dell'auto-sync.

Quindi:
- Connessione WA ON → auto-sync ON
- Connessione WA OFF → auto-sync OFF
- Pausa notturna globale → auto-sync in pausa (riusa `useGlobalAutoSync.nightPause`)
- Tab nascosta → auto-sync in pausa (riduce pattern e carico)

## B. Cadenza irregolare a ciclo

Niente intervallo fisso. Sequenza esatta richiesta dall'utente, in minuti:

```
20, 18, 8, 3, 15, 7, 18, 15, 2, 3, 20
```

Tra un sync e il successivo si aspetta il valore corrente della sequenza. Quando si raggiunge la fine del ciclo, **pausa di ciclo** prima di ricominciare. La pausa è anch'essa irregolare e ruota su:

```
2, 5, 3, 2 minuti
```

Quindi: dopo l'undicesimo tick si aspettano 2 min, poi nuovo ciclo; dopo il successivo 5 min; poi 3; poi 2; poi torna a 2 e così via.

### Rappresentazione interna
```ts
const SYNC_INTERVALS_MIN = [20, 18, 8, 3, 15, 7, 18, 15, 2, 3, 20];
const CYCLE_PAUSES_MIN   = [2, 5, 3, 2];

// Stato persistito in sessionStorage:
//   waSync.intervalIndex (0..10)
//   waSync.cyclePauseIndex (0..3)
//   waSync.nextRunAt (ISO)
```

Ogni esecuzione:
1. Calcola il prossimo wait dalla sequenza, avanza `intervalIndex`.
2. Quando `intervalIndex` arriva a fine sequenza → wait = `CYCLE_PAUSES_MIN[cyclePauseIndex]`, avanza `cyclePauseIndex`, resetta `intervalIndex` a 0.
3. `setTimeout` sul wait calcolato, ricalcolato ad ogni tick (no `setInterval`).

Questo garantisce **continuità non assoluta** (irregolarità intrinseca + pause irregolari di ciclo) senza randomizzazione casuale, in linea con la richiesta esplicita.

## C. Pulsante globale di sync immediato

Aggiunto un piccolo bottone WhatsApp nell'header (`LayoutHeader.tsx`, cluster destro). Sempre cliccabile finché il servizio è connesso. Click → forza sync immediato (single-flight con il timer in corso, non lo duplica) e **non resetta** la sequenza: il prossimo tick automatico parte comunque dal valore previsto.

## D. Indicatore visivo "nuovi messaggi" sull'icona

Stati dell'icona WhatsApp in header:
- **grigia statica** = nessun nuovo messaggio dall'ultima visita.
- **verde + pulsazione leggera (`animate-pulse`) + badge numerico** = N nuovi messaggi sincronizzati, non ancora visti.
- **rossa muted** = servizio WhatsApp scollegato (cursore non verde).
- **spinner** = sync in corso.

Reset del badge quando l'utente:
- clicca l'icona,
- naviga su una pagina WA (Inbox / Outreach WhatsApp),
- clicca "Segna come visto" nel popover.

Counter persistito in `sessionStorage` (`wa_unseen_messages`).

## E. Dettagli implementazione

**File nuovi:**
- `src/hooks/useWhatsAppAutoSync.ts` — orchestrator timer con sequenza irregolare, legge stato da `useExtensionConnections` (o equivalente), riusa `syncWhatsAppFromCursor`, emette evento `wa-sync-completed`.
- `src/hooks/useWhatsAppNewMessagesIndicator.ts` — counter + reset.
- `src/v2/ui/templates/header/WhatsAppSyncButton.tsx` — bottone + icona + colori + badge.

**File modificati:**
- `src/v2/ui/templates/BackgroundServices.tsx` — monta `useWhatsAppAutoSync()`.
- `src/v2/ui/templates/LayoutHeader.tsx` — inserisce `<WhatsAppSyncButton />` nel cluster destro.
- `src/hooks/useWhatsAppAdaptiveSync.ts` — emette `wa-sync-completed { newMessages, errors }` al termine del flusso.

**Costanti / chiavi:**
```ts
const WA_SYNC_EVENT = "wa-sync-completed";
const WA_SYNC_TRIGGER_EVENT = "wa-sync-trigger";   // dispatch dal bottone
const WA_SYNC_STATE_KEY = "wa_sync_sequence_state";
const WA_UNSEEN_KEY = "wa_unseen_messages";
```

**Guard di esecuzione (in ordine):**
1. Servizio WA connesso (cursore verde) → altrimenti reset stato e wait passivo.
2. `!nightPause` globale.
3. `document.visibilityState === "visible"` → altrimenti rinvia al prossimo `visibilitychange`.
4. Single-flight: se un sync è già in corso, il tick si limita a riprogrammare.

## F. Cosa NON facciamo
- Nessun cron server-side per WA (richiede browser + estensione attivi).
- Nessun toggle dedicato in settings: il controllo è già il pulsante di connessione del servizio.
- Niente randomizzazione: si rispetta esattamente la sequenza fornita.
- Non tocchiamo l'estensione (`actions.js`, `content.js`).
- Non duplichiamo la toolbar di pagina WhatsApp esistente.

## Risultato atteso
- Operatore attiva WhatsApp dal pannello connessioni → l'auto-sync inizia silenzioso e segue la cadenza irregolare richiesta (20/18/8/3/15/7/18/15/2/3/20 + pause 2/5/3/2 a fine ciclo).
- L'icona WhatsApp in header diventa il "semaforo": grigio quando tutto fermo, verde pulsante quando arrivano nuovi messaggi, rossa quando il servizio cade, spinner durante il sync.
- Click sull'icona = sync immediato + reset notifica.
- Disattivando il servizio WA dal pannello connessioni si ferma tutto, senza ulteriori azioni.
