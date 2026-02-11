

# Fix: Verifica sessione WCA affidabile

## Problema identificato

Nel file `supabase/functions/check-wca-session/index.ts`, riga 57:

```typescript
const authenticated = hasAspxAuth || testResult.authenticated
```

Questa logica dice "se il cookie contiene la stringa `.ASPXAUTH=`, la sessione e' valida" -- anche quando il test reale (`testCookieDeep`) ha verificato che i contatti NON sono visibili. Il risultato: il semaforo resta verde, la pipeline parte, e scarica dati vuoti.

I log lo confermano:
- 09:30 -> `emails=3, auth=true` (sessione ok)
- 09:34 -> `contacts=0, emails=0, auth=false` (sessione scaduta)
- Ma `wca_session_status` rimane `ok` perche' `.ASPXAUTH` e' ancora nel testo del cookie

## Soluzione

### 1. Edge Function `check-wca-session/index.ts` -- rimuovere override

Cambiare la logica di autenticazione: il risultato del test reale (`testCookieDeep`) deve avere la priorita'. La presenza della stringa `.ASPXAUTH` nel cookie serve solo come diagnostica, non come prova di autenticazione.

```typescript
// PRIMA (bug):
const authenticated = hasAspxAuth || testResult.authenticated

// DOPO (fix):
const authenticated = testResult.authenticated
```

Inoltre, se `testCookieDeep` fallisce per errore di rete/WAF (non per sessione scaduta), aggiungere un fallback che controlla se il test ha effettivamente raggiunto WCA:

```typescript
// Se il test non ha potuto raggiungere WCA (errore di rete/WAF),
// e il cookie ha .ASPXAUTH, considerare "unknown" invece di "expired"
const authenticated = testResult.diagnostics?.error 
  ? hasAspxAuth  // Network error: trust ASPXAUTH as fallback
  : testResult.authenticated  // Test succeeded: trust the result
```

### 2. Pipeline: ri-verifica dopo il primo partner

Nel file `src/pages/AcquisizionePartner.tsx`, aggiungere un controllo della sessione dopo il primo partner processato. Se il primo partner restituisce 0 contatti, fare un check immediato della sessione prima di continuare con i successivi.

Dopo il blocco di quality tracking (~riga 430), aggiungere:

```typescript
// After first partner, if no contacts found, re-check session immediately
if (i === 0 && !hasAnyContact && canvas.contacts.length === 0) {
  const recheck = await triggerCheck();
  if (!recheck || recheck.status !== "ok") {
    pauseRef.current = true;
    setPipelineStatus("paused");
    setShowSessionAlert(true);
    // Wait for user to fix session and resume
    while (pauseRef.current) {
      await new Promise((r) => setTimeout(r, 500));
      if (cancelRef.current) break;
    }
    if (cancelRef.current) break;
  }
}
```

### 3. Ridurre il threshold di pausa automatica

Cambiare `MAX_CONSECUTIVE_EMPTY` da 3 a 2, cosi' il sistema si ferma piu' velocemente se la sessione scade durante il processo.

## Riepilogo modifiche

| File | Modifica |
|------|----------|
| `supabase/functions/check-wca-session/index.ts` | Rimuovere override `.ASPXAUTH`, fidarsi solo del test reale |
| `src/pages/AcquisizionePartner.tsx` | Re-check sessione dopo primo partner vuoto + ridurre threshold a 2 |

## Risultato atteso

- Il semaforo diventa rosso IMMEDIATAMENTE quando la sessione scade
- La pipeline si blocca al primo partner vuoto se la sessione non e' valida
- Niente piu' download di dati vuoti perche' il sistema credeva di essere autenticato

