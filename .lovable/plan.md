

# Stabilita' Notturna e Default Arricchimento

## Situazione attuale

Il job ha processato 775 partner US, salvato 837 aziende con nomi corretti, ma il tasso di contatti e' solo 4% (31/775). I nomi delle aziende sono stati salvati correttamente nel database.

Il problema principale: l'estensione Chrome estrae i contatti aprendo una tab nascosta per ogni partner. Se durante la notte il browser va in risparmio energetico o Chrome limita le tab in background, l'estrazione fallisce silenziosamente e il sistema conta "empty" senza capire che il problema e' tecnico, non di sessione.

## Modifiche

### 1. Default Arricchimento e Deep Search a OFF

**File**: `src/pages/AcquisizionePartner.tsx` (righe 33-34)

Cambiare i valori iniziali:
- `includeEnrich`: `true` -> `false`
- `includeDeepSearch`: `true` -> `false`

### 2. Robustezza estrazione: retry automatico per tab fallite

**File**: `public/chrome-extension/background.js` - funzione `extractContactsForId`

Problema: se la tab non carica (timeout, errore rete, Chrome throttling notturno), il risultato e' `{contacts: []}` e viene contato come "partner senza contatti". Il sistema pensa che sia un problema di sessione.

Soluzione: aggiungere un meccanismo di retry interno all'estensione:
- Se la tab non produce contatti E il contenuto della pagina e' sotto 5000 caratteri (pagina non caricata), ritentare fino a 3 volte con attesa crescente (3s, 6s, 12s)
- Aggiungere un campo `pageLoaded: true/false` nella risposta per distinguere "partner senza contatti reali" da "pagina non caricata"
- Aumentare il timeout di caricamento tab da 15s a 30s per le connessioni lente notturne

### 3. Distinguere "pagina non caricata" da "nessun contatto"

**File**: `src/pages/AcquisizionePartner.tsx` - nel loop `runExtensionLoop`

Usare il nuovo campo `pageLoaded` dalla risposta dell'estensione:
- Se `pageLoaded === false`: non contare come "empty", non aggiornare le statistiche network, loggare come errore di caricamento e ritentare dopo un delay piu' lungo
- Se `pageLoaded === true` e contacts vuoti: contare normalmente come partner senza contatti
- Implementare una coda di retry separata: i partner con pagina non caricata vengono rimessi in fondo alla coda automaticamente (max 2 retry)

### 4. Protezione anti-throttling browser

**File**: `src/pages/AcquisizionePartner.tsx` - nel loop `runExtensionLoop`

Aggiungere un meccanismo "keep-alive" che previene il throttling del browser durante l'acquisizione notturna:
- Usare `setInterval` con un piccolo task ogni 30 secondi (aggiornamento timestamp nel DB) per mantenere la pagina attiva
- Aggiungere un controllo che se il tempo trascorso tra due partner supera i 2 minuti (segno di throttling), eseguire un syncCookie e riprendere normalmente

### 5. Contatore e logging piu' granulare

**File**: `src/pages/AcquisizionePartner.tsx`

Aggiungere alle live stats un contatore `failedLoads` separato da `empty`:
- `empty` = partner caricati correttamente ma senza contatti
- `failedLoads` = pagine non caricate / errori tecnici (che verranno ritentati)

Aggiornare il job nel DB con queste informazioni per diagnostica post-notte.

## Riepilogo file modificati

| File | Modifica |
|------|----------|
| `src/pages/AcquisizionePartner.tsx` | Default enrich/deepSearch OFF, retry per pagine non caricate, keep-alive anti-throttling, stats granulari |
| `public/chrome-extension/background.js` | Retry interno per tab fallite, campo `pageLoaded`, timeout aumentato a 30s |

