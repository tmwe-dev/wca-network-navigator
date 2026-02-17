

# Fix: Rilevamento automatico sessione scaduta durante il job

## Problema

Quando la sessione WCA scade **durante** un job in esecuzione, il sistema continua a scaricare profili vuoti senza accorgerseni. Non c'e nessun controllo che verifichi se i dati estratti indicano una sessione non autenticata.

Il segnale e chiaro: se il sistema non trova ne contatti, ne profilo, ne "Members only" per diversi profili consecutivi, la sessione e scaduta.

## Soluzione

### 1. Contatore di fallimenti consecutivi nel loop principale

**File: `src/hooks/useDownloadProcessor.ts`**

Aggiungere un contatore `consecutiveEmpty` nel loop principale. Dopo ogni estrazione, verificare se il risultato e "completamente vuoto" (nessun contatto, nessun profilo, nessun HTML). Se lo e, incrementare il contatore. Se si raggiungono **3 profili consecutivi vuoti**, il job viene messo in pausa con un messaggio chiaro di sessione scaduta e si tenta un auto-login.

Logica:

```text
Per ogni profilo estratto:
  SE result.contacts vuoto E result.profile vuoto E result.profileHtml vuoto:
    consecutiveEmpty++
    SE consecutiveEmpty >= 3:
      --> Log "Sessione scaduta rilevata"
      --> Tentativo auto-login via verifyWcaSession()
      --> SE auto-login OK: reset contatore, continua
      --> SE auto-login FALLITO: pausa job con errore "Sessione WCA scaduta"
  ALTRIMENTI:
    consecutiveEmpty = 0  (reset: dati trovati, sessione OK)
```

La soglia di 3 (e non 1) evita falsi positivi per profili legittimamente vuoti.

### 2. Fix checkpoint doppia chiamata (gia discusso)

**File: `src/lib/download/sessionVerifier.ts`**

Aggiungere `markRequestSent()` dopo ogni interazione WCA nel verificatore di sessione, per evitare che il loop principale parta immediatamente dopo la verifica senza aspettare i 15 secondi.

### Dettaglio tecnico delle modifiche

**`src/hooks/useDownloadProcessor.ts`** -- Aggiungere nel loop principale:
- Variabile `let consecutiveEmpty = 0` prima del loop `for`
- Dopo il salvataggio dei dati (riga ~176), controllare se il risultato e completamente vuoto
- Se `consecutiveEmpty >= 3`: tentare re-verifica sessione, e se fallisce, mettere il job in pausa
- Se l'estrazione ha dati: resettare `consecutiveEmpty = 0`

**`src/lib/download/sessionVerifier.ts`** -- Aggiungere:
- Import di `markRequestSent` da `@/lib/wcaCheckpoint`
- Chiamata `markRequestSent()` dopo ogni `verify()` e dopo `autoLogin`

### Nessuna modifica al database

Il fix e interamente lato frontend/processore. Non servono modifiche allo schema.

