
# Eliminazione di TUTTI i recovery e chiamate parallele

## Problema
Il processore di download, mentre scarica profili, lancia chiamate aggiuntive a WCA in parallelo:
- Ogni 3 profili apre una tab per verificare la sessione (verifySession)
- Se la verifica fallisce, apre ALTRE tab per il recovery (syncCookie + verifySession)
- Se ci sono N profili vuoti consecutivi, apre ALTRE tab per auto-recovery
- L'estensione ha 3 retry interni per ogni profilo fallito, aprendo tab aggiuntive
- Il tutto genera un traffico multiplo e sovrapposto verso WCA

## Modifiche

### 1. `src/hooks/useDownloadProcessor.ts`

**Rimuovere completamente il session health check (righe 311-328):**
Eliminare l'intero blocco che ogni 3 profili chiama `verifySession()` e `syncCookie()`. Zero chiamate extra a WCA durante il processing.

**Rimuovere completamente l'auto-recovery per profili vuoti consecutivi (righe 336-348):**
Eliminare l'intero blocco che al raggiungimento della soglia `recoveryThreshold` chiama `syncCookie()` e `verifySession()`. Se ci sono profili vuoti, semplicemente continua.

**Rimuovere `verifySession` e `syncCookie` dalle dipendenze dell'hook:**
Non servono piu' nel processore. L'unica cosa che il processore fa e' `extractContacts` -- una richiesta alla volta, con il delay configurato.

**Rimuovere la variabile `consecutiveEmpty` e tutta la logica associata:**
Non serve piu' nessun conteggio di profili vuoti consecutivi per triggerare recovery.

### 2. `public/chrome-extension/background.js`

**Ridurre MAX_RETRIES a 1 (massimo 1 tentativo extra):**
Da `MAX_RETRIES = 3` a `MAX_RETRIES = 1`. Se il profilo non carica al secondo tentativo, restituisce errore.

**Rimuovere syncCookie dalla verifySession (riga 233-234):**
Quando `verifyWcaSession()` trova la sessione autenticata, NON deve chiamare `syncWcaCookiesToServer()`. Zero chiamate extra.

### 3. `src/hooks/useScrapingSettings.ts`

**Rimuovere `recoveryThreshold` dalle impostazioni:**
Non viene piu' usato (l'auto-recovery e' stato eliminato). Rimuovere il campo dalla interface, dai default e dalla mappa delle chiavi DB.

### 4. `src/components/settings/ScrapingSettings.tsx`

**Rimuovere il controllo "Soglia recovery sessione" dalla UI:**
Eliminare lo slider e la descrizione del recoveryThreshold perche' il parametro non esiste piu'.

## Risultato finale

Il processore fara' UNA SOLA cosa per ogni profilo:
1. `extractContacts(wcaId)` -- apre una tab, estrae, chiude la tab
2. Attende il delay configurato (baseDelay +/- variation)
3. Passa al profilo successivo

Nessun'altra chiamata a WCA. Mai. Zero recovery, zero verifiche, zero sync paralleli.

## Dettaglio tecnico

Il flusso del processore diventa:

```text
Per ogni profilo nel job:
  1. Controlla cancellazione/pausa (solo DB, nessuna chiamata WCA)
  2. Verifica estensione disponibile (solo ping locale, nessuna tab WCA)
  3. Crea/trova partner nel DB (solo Supabase, nessuna chiamata WCA)
  4. extractContacts(wcaId) -- UNICA chiamata WCA
  5. Salva risultati nel DB
  6. Attende delay
  7. Ripeti
```

La verifica sessione resta disponibile SOLO tramite il pulsante manuale "Verifica ora" nell'interfaccia, mai automaticamente durante il processing.
