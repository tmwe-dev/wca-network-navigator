

# Rifattorizzazione Verifica Sessione WCA

## Il Problema Reale

Sei loggato su WCA, ma il sistema non lo riconosce. Ecco perche':

Il flusso attuale funziona cosi':
1. L'estensione Chrome raccoglie i cookie con `chrome.cookies.getAll`
2. Li invia al server come stringa
3. Il server cerca `.ASPXAUTH=` nella stringa
4. Se non lo trova, segna "expired"

**Il cookie `.ASPXAUTH` e' HttpOnly** -- il browser lo usa per le richieste ma `chrome.cookies.getAll` spesso non riesce a catturarlo (dipende dal dominio esatto, dal flag secure, ecc.). Anche il popup dell'estensione lo sa: c'e' un messaggio "Login OK ma .ASPXAUTH non visibile".

Risultato: sei loggato, l'estensione funziona, i contatti sono accessibili, ma il semaforo e' rosso perche' il cookie salvato nel database non contiene `.ASPXAUTH`.

## Soluzione

Smettere di dipendere dalla stringa `.ASPXAUTH` nel cookie. Usare invece l'estensione Chrome per fare un **test reale**: aprire un profilo WCA di test e verificare se i contatti personali sono visibili. Questo metodo e' infallibile perche' usa il browser dell'utente (gia' loggato).

## Modifiche

### 1. `src/hooks/useWcaSessionStatus.ts` -- Riscrittura

Il hook usera' l'extension bridge come metodo primario:

- `triggerCheck()` chiamera' prima `syncCookie()` (ri-sincronizza i cookie dal browser)
- Poi chiamera' `verifySession()` tramite l'extension bridge (apre un profilo di test e verifica se i dati privati sono accessibili)
- Aggiornera' lo stato nel database in base al risultato reale
- Se l'estensione non e' disponibile, cade sul vecchio metodo (edge function)

### 2. `supabase/functions/check-wca-session/index.ts` -- Aggiunta endpoint di aggiornamento diretto

Aggiungere la possibilita' di ricevere un `status` esplicito dal frontend:
- Se il body contiene `{ status: "ok", source: "extension_verify" }`, aggiornare direttamente lo stato senza controllare il cookie
- Questo permette al frontend di dire "ho verificato con l'estensione, la sessione funziona"

### 3. `src/components/download/WcaSessionIndicator.tsx` -- Aggiornamento UI

- Il pulsante "Verifica ora" usera' il nuovo flusso (extension bridge)
- Mostrare feedback piu' dettagliato: "Sincronizzazione cookie...", "Apertura profilo di test...", "Verifica contatti..."
- Toast con risultato chiaro

### 4. `public/chrome-extension/background.js` -- Migliorare `syncWcaCookiesToServer`

La funzione `syncWcaCookiesToServer` attualmente usa solo `chrome.cookies.getAll({ domain })`. Aggiungere anche il tentativo con `chrome.cookies.get` diretto per `.ASPXAUTH`:
- Tentare `chrome.cookies.get({ url: "https://www.wcaworld.com/", name: ".ASPXAUTH" })` esplicitamente
- Se trovato, aggiungerlo alla stringa cookie
- Questo aumenta le probabilita' di catturare il cookie HttpOnly

---

## Dettaglio Tecnico

### `useWcaSessionStatus.ts` -- Nuovo flusso `triggerCheck`

```text
triggerCheck()
  |
  +-- Estensione disponibile?
  |     |
  |     +-- SI: syncCookie() -> verifySession() -> aggiorna DB
  |     |        (apre profilo test, controlla contatti reali)
  |     |
  |     +-- NO: chiama edge function check-wca-session (fallback)
  |
  +-- Mostra risultato con toast
```

Il hook importera' `useExtensionBridge` e lo usera' per:
1. `syncCookie()` -- forza re-invio cookie al server
2. `verifySession()` -- apre profilo WCA ID 86580 in tab nascosta, controlla se email/nomi reali sono visibili
3. Se `verifySession` ritorna `authenticated: true`, chiama l'edge function con `{ status: "ok", source: "extension_verify" }` per aggiornare il DB

### `check-wca-session/index.ts` -- Modifica

Aggiungere al corpo della richiesta:
- Se `body.status` esiste e `body.source === "extension_verify"`, fare upsert diretto dello stato senza controllare il cookie
- Altrimenti, comportamento invariato (controllo cookie nel DB)

### `background.js` -- Miglioramento cattura cookie

```text
Attuale:
  chrome.cookies.getAll({ domain: ".wcaworld.com" })
  -> manca .ASPXAUTH (HttpOnly)

Nuovo:
  chrome.cookies.getAll({ domain: ".wcaworld.com" })
  + chrome.cookies.get({ url, name: ".ASPXAUTH" })  // tentativo diretto
  + chrome.cookies.getAll({ url: "https://www.wcaworld.com/" })  // per URL
  -> unifica tutto in un unico set, poi invia
```

