

# Sessione WCA Indistruttibile: Piano Definitivo

## Problema ancora presente

Il file `supabase/functions/process-download-job/index.ts` (righe 82-167) chiama ANCORA `scrape-wca-partners` dal server. Ogni volta che un job parte, il server fa richieste HTTP a WCA con il tuo cookie, da un IP diverso dal tuo browser. WCA invalida la sessione immediatamente.

La pagina Acquisizione ha gia' il loop via estensione (`runExtensionLoop`), ma il job processor server-side continua a girare in parallelo e uccide tutto.

## Modifiche

### 1. Neutralizzare `process-download-job`

**File**: `supabase/functions/process-download-job/index.ts`

Il job processor server-side non deve MAI chiamare `scrape-wca-partners`. Diventa un semplice "tracker" che:
- Tiene traccia dello stato del job (running/paused/completed)
- NON fa nessuna richiesta HTTP a WCA
- NON chiama `scrape-wca-partners`
- NON fa auto-chaining (il frontend guida tutto)

Rimuovere:
- La chiamata auth-check a `scrape-wca-partners` (righe 82-118)
- La chiamata di scraping a `scrape-wca-partners` (righe 159-167)
- La logica di auto-chaining `chainNext` (riga 282)

Il job processor diventa un endpoint che il frontend chiama per aggiornare il progresso e basta.

### 2. Verifica sessione ogni 3 partner nel loop frontend

**File**: `src/pages/AcquisizionePartner.tsx`

Nel `runExtensionLoop`, aggiungere un controllo ogni 3 partner processati:
- Dopo il 3o, 6o, 9o... partner: chiedere all'estensione di fare un "ping" a WCA
- Se il ping fallisce o i contatti sono vuoti: tentare il ripristino automatico
- Se il ripristino non funziona: mettere in pausa e avvisare

```text
Loop per ogni partner:
  1. Estrai contatti via estensione
  2. Se (contatore % 3 == 0):
     a. Verifica sessione tramite estensione (apre pagina test WCA)
     b. Se sessione morta:
        - Tenta re-sync cookie automatico
        - Se fallisce: PAUSA + avviso
  3. Salva dati nel DB
  4. Prossimo partner
```

### 3. Aggiungere azione "verifySession" all'estensione Chrome

**File**: `public/chrome-extension/background.js`

Nuova azione `verifySession` che:
- Apre un profilo WCA noto (es: ID 86580) in tab nascosta
- Controlla se la pagina contiene blocchi contatto reali (non "Members only")
- Restituisce `{ authenticated: true/false }`
- Se autenticato: ri-sincronizza il cookie aggiornato nel DB

### 4. Aggiungere azione "syncCookie" all'estensione Chrome

**File**: `public/chrome-extension/background.js`

Nuova azione `syncCookie` che:
- Legge tutti i cookie di `wcaworld.com` tramite `chrome.cookies.getAll`
- Li concatena in una stringa cookie completa
- Li salva nel DB chiamando `save-wca-cookie`
- Questo mantiene il cookie nel DB sempre aggiornato con l'ultimo token valido

### 5. Esporre le nuove azioni nel bridge

**File**: `src/hooks/useExtensionBridge.ts`

Aggiungere due nuovi metodi:
- `verifySession()`: chiama l'azione `verifySession` dell'estensione
- `syncCookie()`: chiama l'azione `syncCookie` dell'estensione

### 6. Indicatore sessione live nella pagina Acquisizione

**File**: `src/pages/AcquisizionePartner.tsx`

Aggiungere un indicatore visivo permanente in alto nella pagina:
- Pallino verde: "Sessione WCA attiva"
- Pallino rosso: "Sessione scaduta - ripristino in corso..."
- Pallino giallo: "Verifica in corso..."

Questo indicatore si aggiorna automaticamente ogni 3 partner e dopo ogni sync.

## Flusso risultante

```text
1. Utente fa login su WCA nel browser
2. Estensione sincronizza cookie automaticamente
3. Pipeline parte:
   Partner 1 -> estrai via estensione (stesso IP) -> OK
   Partner 2 -> estrai via estensione -> OK
   Partner 3 -> estrai via estensione -> OK
   --- VERIFICA SESSIONE ---
   Estensione apre pagina test -> contatti visibili? -> SI -> continua
   Partner 4 -> OK
   Partner 5 -> OK
   Partner 6 -> OK
   --- VERIFICA SESSIONE ---
   Estensione apre pagina test -> contatti visibili? -> NO
   -> Estensione ri-sincronizza cookie -> riprova -> OK? -> continua
   -> Ancora NO? -> PAUSA + avviso utente
```

## Riepilogo file modificati

| File | Modifica |
|------|----------|
| `supabase/functions/process-download-job/index.ts` | Rimuovere TUTTE le chiamate a `scrape-wca-partners` e auto-chaining |
| `public/chrome-extension/background.js` | Aggiungere azioni `verifySession` e `syncCookie` |
| `src/hooks/useExtensionBridge.ts` | Esporre `verifySession()` e `syncCookie()` |
| `src/pages/AcquisizionePartner.tsx` | Verifica sessione ogni 3 partner + indicatore live + auto-recovery |

## Risultato

- Il server NON tocca MAI WCA -- zero richieste server-side
- L'estensione lavora dal tuo browser, stesso IP, stessa sessione
- Ogni 3 partner il sistema verifica che la sessione sia viva
- Se la sessione muore: tentativo automatico di ripristino
- Se il ripristino fallisce: pausa immediata con avviso chiaro
- La sessione resta aperta finche' TU non la chiudi

