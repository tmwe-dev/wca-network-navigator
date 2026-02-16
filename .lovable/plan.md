

# Fix rilevamento sessione WCA: fidarsi della verifica reale, non del cookie

## Problema

Sei loggato su WCA World, ma il sistema dice "Sessione Scaduta" perche':
1. Il cookie `.ASPXAUTH` e' probabilmente HttpOnly -- il browser non lo espone all'estensione Chrome tramite `chrome.cookies.getAll()`
2. La funzione `save-wca-cookie` controlla se `.ASPXAUTH` e' presente nel testo del cookie. Se manca, segna "expired"
3. Ma la sessione FUNZIONA -- il browser ha il cookie, solo che l'estensione non riesce a leggerlo

Il sistema ha gia' un metodo affidabile (`verifySession`) che apre un profilo reale e controlla se i contatti sono visibili. Ma questo metodo viene usato solo quando clicchi "Verifica ora" manualmente.

## Soluzione

### 1. `save-wca-cookie` (Edge Function): NON marcare "expired" se manca `.ASPXAUTH`

Attualmente: se `.ASPXAUTH` manca dal cookie, segna status = "expired".
Nuovo comportamento: se `.ASPXAUTH` manca, segna status = "unknown" (non "expired"). Solo la verifica reale tramite estensione puo' confermare "ok" o "expired".

File: `supabase/functions/save-wca-cookie/index.ts`
- Cambiare la logica: `const status = hasAspxAuth ? 'ok' : 'unknown'`
- Il messaggio diventa: "Cookie salvato. Verifica sessione in corso..." invece di marcare subito come expired

### 2. `useWcaSessionStatus`: verifica automatica dopo sync cookie

File: `src/hooks/useWcaSessionStatus.ts`
- Nel `triggerCheck`, dopo il sync cookie, il `verifySession` gia' avviene e aggiorna il DB -- questo e' corretto
- Aggiungere: se lo status dal DB e' "unknown" o "expired", e l'estensione e' disponibile, eseguire automaticamente una verifica reale (senza aspettare il click manuale)

### 3. `useDownloadProcessor`: verifica sessione prima di partire

File: `src/hooks/useDownloadProcessor.ts`
- Prima di avviare un job, se lo status DB e' diverso da "ok", fare una verifica rapida tramite estensione
- Se la verifica conferma "ok", aggiornare il DB e procedere
- Se la verifica fallisce, mettere il job in pausa e mostrare il dialogo di sessione

### 4. `useWcaSessionStatus`: auto-check all'avvio

File: `src/hooks/useWcaSessionStatus.ts`
- Quando il hook si monta per la prima volta e lo status DB e' "expired" o "unknown", lanciare automaticamente un `triggerCheck` se l'estensione e' disponibile
- Questo elimina la necessita' di cliccare "Verifica ora" ogni volta

## Dettagli tecnici

### `save-wca-cookie/index.ts`
```text
// Prima:
const status = hasAspxAuth ? 'ok' : 'expired'

// Dopo:
const status = hasAspxAuth ? 'ok' : 'unknown'
```

### `useWcaSessionStatus.ts`
- Aggiungere un `useEffect` che, al mount, se `status !== "ok"` e l'estensione e' disponibile, esegue `triggerCheck()` automaticamente (con un flag per evitare loop)

### `useDownloadProcessor.ts`
- Nel `processJob`, prima di tutto, fare un check veloce: se `app_settings.wca_session_status !== 'ok'`, chiamare `verifySession` dall'estensione. Se confermato, aggiornare e procedere. Se no, pausa.

## Risultato

- NON serve piu' cliccare "Verifica ora" manualmente
- Il sistema si auto-verifica all'avvio e prima di ogni job
- Il cookie `.ASPXAUTH` HttpOnly non blocca piu' il rilevamento
- La verifica reale (apertura profilo test) resta il metodo definitivo

## File modificati

1. `supabase/functions/save-wca-cookie/index.ts` -- status "unknown" invece di "expired"
2. `src/hooks/useWcaSessionStatus.ts` -- auto-check al mount
3. `src/hooks/useDownloadProcessor.ts` -- verifica pre-job
