

# Connessione WhatsApp/LinkedIn da Settings (senza pagina esterna)

## Problema

Cliccando le icone WhatsApp/LinkedIn nella header, si apre una pagina esterna di istruzioni per installare estensioni Chrome. L'utente ha gia' tutti i numeri di telefono nei contatti e vuole gestire le connessioni direttamente dai Settings dell'app — non da pagine HTML separate.

## Soluzione

### 1. Sezione "Canali di Comunicazione" in `ConnectionsSettings.tsx`

Aggiungere un nuovo tab o sezione dentro Settings > Connessioni con:

- **WhatsApp**: Campo per numero mittente (gia' disponibile nei dati utente), toggle attivazione, stato connessione con pallino verde/rosso. Il click su "Attiva" lancia il bridge check e mostra istruzioni inline (non pagina esterna) se l'estensione non e' rilevata
- **LinkedIn**: Stesso pattern — mostra stato estensione, credenziali gia' salvate (li_at cookie), verifica sessione inline
- **AI Agent**: Toggle attivazione (sempre attivo, conferma visiva)

### 2. Modifica `ConnectionStatusBar.tsx`

- Rimuovere i `window.open` verso le pagine HTML di download
- Click su icona disconnessa → navigazione a `/settings` tab Connessioni con toast "Configura da Impostazioni > Connessioni"
- Se estensione non rilevata, mostrare istruzioni compatte inline nel toast o dialog, non aprire pagina esterna

### 3. Istruzioni inline invece di pagine separate

Quando l'estensione non e' installata, mostrare un piccolo dialog/sheet dentro l'app con:
- Link per scaricare il ZIP dell'estensione (fetch+blob, gia' implementato)
- 4 step compatti per l'installazione
- Tutto dentro l'app, nessun redirect esterno

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/settings/ConnectionsSettings.tsx` | Nuova sezione canali WhatsApp/LinkedIn/AI |
| `src/components/layout/ConnectionStatusBar.tsx` | Rimuovere redirect a pagine esterne, navigare a Settings |

