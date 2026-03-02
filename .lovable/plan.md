

## Problema

Il flusso di download ha un **doppio gate** sulla sessione WCA:

1. **Gate pre-download** (`ensureSession()` in `PartnerListPanel.tsx` / `ActionPanel.tsx`) — richiede che l'estensione Chrome risponda al ping E che la sessione sia verificata via estensione
2. **Gate nel processore** (`verifyWcaSession` in `useDownloadProcessor.ts`) — stessa cosa

Il Gate 1 blocca tutto prima ancora di creare il job. L'estensione potrebbe essere presente ma il polling a 3 secondi con watchdog a 5 secondi fallisce per timing, contesto invalidato, o dominio preview.

I log del backend mostrano che il cookie `.ASPXAUTH` e stato salvato con successo pochi minuti fa (`wca_session_status = 'ok'`). La sessione E attiva sul server ma il controllo client-side non riesce a verificarla.

## Soluzione

Modificare `ensureSession()` per aggiungere un **fallback server-side**: se l'estensione non risponde, controlla `app_settings.wca_session_status` nel database. Se il valore e `ok`, la sessione e considerata attiva e il download parte.

Il processore (`useDownloadProcessor`) ha gia il suo controllo sessione indipendente — se l'estensione e davvero morta, il job fallira gracefully durante l'estrazione, senza bloccare tutto a monte.

### File da modificare

1. **`src/hooks/useWcaSession.ts`** — Aggiungere fallback DB nel Step 1: se l'estensione non risponde dopo i retry, leggere `wca_session_status` da `app_settings`. Se e `ok`, considerare la sessione attiva e ritornare `true` senza richiedere l'estensione per la verifica.

2. **`src/components/operations/PartnerListPanel.tsx`** — Nessuna modifica logica, il fix in `useWcaSession` risolve automaticamente entrambi i punti di chiamata (riga 275 e 521).

### Dettaglio tecnico del fallback

```text
ensureSession() flow:
  1. Try extension ping (existing logic)
  2. If extension NOT found:
     → Query app_settings WHERE key = 'wca_session_status'
     → If value = 'ok' → return true (session valid server-side)
     → If value != 'ok' → return false (genuinely expired)
  3. If extension found → proceed with existing verify logic
```

