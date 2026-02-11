

# Fix: Eliminare auto-login server-side e aggiungere retry automatico

## Problema

Il file `scrape-wca-partners/index.ts` (righe 912-955) contiene una logica di **auto-login server-side**: quando il cookie non funziona, il sistema tenta di fare un login con username/password direttamente dal server. Questo crea una **NUOVA sessione** sul sito WCA, che molto probabilmente **invalida la sessione attiva nel browser** dell'utente. Risultato: l'estensione Chrome perde l'accesso e non puo' piu' estrarre i contatti privati.

Lo stesso problema esiste in `check-wca-session/index.ts` (riga 60-63): se la sessione risulta scaduta e `autoLogin` e' richiesto, chiama `wca-auto-login` che fa la stessa cosa.

## Soluzione

### 1. Rimuovere auto-login da `scrape-wca-partners` (Edge Function)

Eliminare il blocco "Try 2: Auto-login" (righe 912-955). Se il cookie non funziona, la funzione deve restituire `authStatus: "members_only"` e lasciare che la pipeline gestisca la situazione (pausa + alert all'utente).

Il flusso diventa:
1. Usa il cookie salvato -> funziona? OK
2. Non funziona? Restituisci `members_only` senza tentare login
3. Non c'e' cookie? Usa Firecrawl come fallback (dati pubblici)

### 2. Rimuovere auto-login da `check-wca-session` (Edge Function)

Rimuovere la chiamata a `tryAutoLogin` (righe 60-63) e il parametro `autoLogin`. Il check deve solo verificare lo stato, mai tentare di rinnovare la sessione. Il rinnovo deve avvenire SOLO tramite l'estensione Chrome nel browser dell'utente.

### 3. Aggiungere "Retry incompleti" nella pipeline (Frontend)

Alla fine della pipeline, verificare se ci sono partner con contatti mancanti e proporre un secondo giro automatico:

- Contare i partner completati con `contactSource === "none"` o senza email
- Se ce ne sono, mostrare un dialog: "X partner senza contatti. Vuoi ritentare?"
- Se l'utente accetta, rieseguire la pipeline solo per quei partner

## Dettagli Tecnici

### File: `supabase/functions/scrape-wca-partners/index.ts`

**Rimuovere** il blocco "Try 2: Auto-login" (righe 912-955). La logica dopo il cookie check diventa:

```
Se authStatus !== 'authenticated':
  -> Non fare nulla (niente auto-login)
  -> Il profilo verra' scaricato con dati pubblici (members_only)
  -> La pipeline vedra' authStatus e potra' reagire
```

### File: `supabase/functions/check-wca-session/index.ts`

- Rimuovere il parametro `autoLogin` dal body parsing (righe 20-24)
- Rimuovere il blocco `if (!cookie && autoLogin)` (righe 40-43) 
- Rimuovere il blocco `if (!authenticated && autoLogin)` (righe 60-63)
- Rimuovere la funzione `tryAutoLogin` (righe 156-177)

### File: `src/pages/AcquisizionePartner.tsx`

Dopo il ciclo principale (riga 487), aggiungere logica per il retry:

```typescript
// Check for incomplete partners
const incompleteItems = items.filter(item => {
  const qItem = queue.find(q => q.wca_id === item.wca_id);
  return qItem?.status === "done"; // will check bin for missing contacts
});

// If there are partners without contacts, offer retry
if (liveStats.empty > 0 && !cancelRef.current) {
  // Show retry dialog
  setShowRetryDialog(true);
}
```

Aggiungere un nuovo dialog e stato:
- `showRetryDialog` (boolean)  
- Quando l'utente conferma, rieseguire la pipeline filtrando solo i partner senza contatti dal bin

### File: `src/hooks/useWcaSessionStatus.ts`

Rimuovere la funzione `autoLogin` dal return (non serve piu').

## Riepilogo Modifiche

| File | Modifica |
|------|----------|
| `scrape-wca-partners/index.ts` | Rimuovere blocco auto-login (righe 912-955) |
| `check-wca-session/index.ts` | Rimuovere `autoLogin` param e `tryAutoLogin()` |
| `AcquisizionePartner.tsx` | Aggiungere dialog "Retry incompleti" a fine pipeline |
| `useWcaSessionStatus.ts` | Rimuovere `autoLogin` dal return |

## Risultato

- Il server non fara' MAI login autonomamente -> la sessione del browser resta intatta
- Se il cookie scade, la pipeline si blocca e chiede all'utente di rifare la connessione tramite estensione
- A fine giro, se ci sono partner incompleti, il sistema propone un retry automatico

