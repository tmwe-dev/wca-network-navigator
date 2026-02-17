

# Refactor completo: Verifica sessione WCA automatica e invisibile

## Problema attuale

Il sistema di verifica sessione WCA e un casino:
- `useWcaSessionStatus` hook con 7 stati diversi, diagnostica, step multipli
- Edge function `check-wca-session` con logica complessa su ASPXAUTH, job history, cookie timestamp
- UI con dialoghi manuali "Sessione Scaduta", bottoni "Verifica ora", popover con diagnostica
- Auto-check al mount con flag globali su window
- L'utente deve interagire manualmente quando la sessione risulta scaduta (anche se e attiva)
- Falsi positivi: dice "scaduta" quando in realta funziona

## Soluzione: verifica automatica, semplice, invisibile

Un unico concetto: **prima di ogni operazione WCA, apri una pagina WCA nota via estensione e verifica se si carica con dati reali. Se si, procedi. Se no, tenta login automatico. L'utente non vede nulla.**

## Architettura nuova

```text
Download richiesto
  |
  v
[useDownloadProcessor] chiama verifyAndEnsureSession()
  |
  v
[Extension] apre pagina WCA test (ID fisso)
  |
  +-- Pagina carica con contatti reali? --> OK, procedi
  |
  +-- Pagina mostra "Members only" o login? --> Tenta auto-login
       |
       +-- Login riuscito? --> OK, procedi
       +-- Login fallito? --> Pausa job con messaggio chiaro
```

## Modifiche tecniche

### 1. Nuovo hook semplificato: `src/hooks/useWcaSession.ts`

Sostituisce completamente `useWcaSessionStatus.ts`. Espone:
- `isSessionActive: boolean` -- stato corrente (letto da memoria, non da DB)
- `ensureSession(): Promise<boolean>` -- verifica e se serve fa login automatico. Ritorna true/false.

Nessun polling al DB, nessun stato complesso. La funzione `ensureSession()`:
1. Chiede all'estensione di aprire una pagina WCA di test (es. profilo #86580)
2. Se la pagina mostra contatti reali --> sessione OK, ritorna `true`
3. Se la pagina mostra "Members only" o redirect al login --> chiede all'estensione di fare auto-login con le credenziali salvate
4. Dopo il login, ritenta la verifica
5. Se fallisce anche dopo login --> ritorna `false`

### 2. Aggiornamento `src/hooks/useDownloadProcessor.ts`

- Rimuovere `verifySessionBeforeJob` (il vecchio check basato su DB)
- Prima di processare un job, chiamare `ensureSession()`
- Se `false`: mettere job in pausa con messaggio "Sessione WCA non disponibile"
- Nessun dialogo, nessuna interazione utente

### 3. Aggiornamento `src/components/download/ActionPanel.tsx`

- Rimuovere `showSessionDialog`, `handleSessionRetry`, `WcaSessionDialog`
- `handleStartDownload`: chiamare `ensureSession()` silenziosamente prima di creare i job
- Se sessione non attiva: mostrare solo un toast "Sessione WCA non attiva, effettua il login su wcaworld.com"

### 4. Semplificazione `src/components/layout/AppSidebar.tsx`

- Usare il nuovo `useWcaSession` al posto di `useWcaSessionStatus`
- Il pallino verde/rosso rimane, ma basato su `isSessionActive`
- Nessun popover complicato, nessun dialogo

### 5. Semplificazione `src/components/download/WcaSessionIndicator.tsx`

- Rimuovere tutto il contenuto complesso (popover diagnostica, step, bottone verifica)
- Lasciare solo un pallino colorato con tooltip semplice ("Connesso" / "Non connesso")
- Nessuna interazione manuale

### 6. Eliminazione `src/components/download/WcaSessionDialog` (dentro WcaSessionIndicator.tsx)

- Il componente `WcaSessionDialog` viene eliminato completamente
- Non serve piu: tutto e automatico

### 7. Semplificazione `src/components/settings/WcaSessionCard.tsx`

- Rimuovere bottone "Ricontrolla Sessione"
- Mostrare solo stato attuale (pallino verde/rosso + ultima verifica)

### 8. Eliminazione Edge Function `check-wca-session`

- Non serve piu: la verifica avviene interamente via estensione
- Rimuovere `supabase/functions/check-wca-session/index.ts`
- Non si scrive/legge piu `wca_session_status` dal DB

### 9. Aggiornamento `src/pages/AcquisizionePartner.tsx`

- Sostituire `verifySession` con `ensureSession()` dal nuovo hook
- Rimuovere la gestione manuale dello stato sessione

### 10. Aggiornamento `src/pages/Settings.tsx`

- Usare il nuovo hook semplificato
- Rimuovere riferimenti a `triggerCheck`, `diagnostics`, ecc.

## Risultato

- **Zero interazione utente**: la verifica avviene dietro le quinte prima di ogni operazione
- **Un solo metodo di verifica**: apri pagina WCA, vedi se funziona
- **Auto-login**: se la sessione e scaduta, tenta automaticamente il login con le credenziali salvate
- **Nessun falso positivo**: non si basa piu su ASPXAUTH, cookie timestamp o job history
- **Codice ridotto**: si elimina l'edge function, il hook complesso, i dialoghi manuali

