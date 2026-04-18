

## Diagnosi finale

I file sul server sono corretti:
- `public/chrome-extensions/whatsapp/whatsapp-extension-5.7.0.zip` → manifest interno **5.7.0** ✔
- `public/whatsapp-extension.zip` (alias root) → manifest interno **5.7.0** ✔
- Embedded fallback in `embeddedWhatsAppExtensionZip.ts` → **5.7.0** ✔
- `WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.7.0"` ✔
- Catalog JSON → **5.7.0** ✔
- Fetch già con `?t=${Date.now()}` e `cache: "no-store"` ✔
- Service Worker NON cacha `.zip` (esclusi da globPatterns e nessuna runtime rule) ✔

Quindi quando clicchi "Scarica estensione WhatsApp", **stai davvero scaricando v5.7.0**. Il log "v5.5.1" arriva da `pingExtension`, che legge il manifest **dell'estensione installata in Chrome**, non dello ZIP appena scaricato.

## Causa reale

Chrome continua a vedere v5.5.1 perché in `chrome://extensions` l'estensione è ancora montata sulla **vecchia cartella** v5.5.1. Casi tipici:

1. Hai cliccato l'icona "ricarica" 🔄 sulla riga dell'estensione esistente: Chrome ricarica dalla cartella montata in passato, ignorando lo ZIP nuovo che hai scaricato.
2. Hai estratto il nuovo ZIP **dentro la stessa cartella** della vecchia: alcuni file sono rimasti vecchi (sovrascrittura parziale, o estrattore in modalità "skip").
3. Hai fatto "Carica estensione non pacchettizzata" puntando alla vecchia cartella v5.5.1 invece che a quella nuova v5.7.0.

Lovable non ha modo di forzare Chrome ad aggiornare un'estensione locale unpacked: l'aggiornamento manuale è obbligatorio.

## Cosa fare per risolvere ORA (lato tuo)

1. Vai su `chrome://extensions`.
2. Trova "WCA WhatsApp Bridge v5.5" e clicca **Rimuovi** (non solo disattiva).
3. Scarica di nuovo lo ZIP dal pulsante "Scarica estensione WhatsApp".
4. Estrai lo ZIP **in una cartella nuova e vuota** (non sovrascrivere la vecchia).
5. In `chrome://extensions` → **Carica estensione non pacchettizzata** → seleziona la cartella nuova.
6. Verifica che ora compaia "WCA WhatsApp Bridge v5.7" con versione 5.7.0.
7. Ricarica la pagina dell'app: il ping deve rispondere 5.7.0.

## Fix difensivi che posso applicare nel codice (per evitare la confusione in futuro)

Una volta approvato, aggiungo:

**A. Hash di integrità nel filename**
Il nome file diventerà `whatsapp-extension-5.7.0-<hash>.zip`. Così se per qualunque motivo il browser servisse un vecchio ZIP cachato da rete intermedia o CDN, il filename stesso sarebbe diverso e tu te ne accorgi prima di estrarlo.

**B. Verifica manifest dentro lo ZIP prima del download**
Dopo `await response.blob()`, leggo il manifest dentro lo ZIP scaricato (uso `jszip`, già nel progetto se presente, altrimenti aggiungo). Se la versione nel manifest non è 5.7.0, mostro toast d'errore "ZIP corrotto, riprova" invece di servirlo.

**C. UI: avviso post-download con istruzioni esplicite di rimozione**
Dopo download riuscito, mostro un toast con tempo lungo che dice testualmente: *"Prima di caricare la nuova estensione, RIMUOVI quella vecchia da chrome://extensions. Estrai lo ZIP in una cartella nuova."* Così non rischi più di ricaricare la vecchia.

**D. Ping con avviso "rimuovi vecchia versione"**
Quando `pingExtension` rileva versione obsoleta, il messaggio attuale "Estensione attiva ma obsoleta" diventa: "Estensione v5.5.1 ancora installata in Chrome. Vai su chrome://extensions, RIMUOVI la vecchia versione, poi carica la cartella della nuova v5.7.0."

## File toccati

- `src/lib/whatsappExtensionZip.ts` — verifica manifest interno post-download (B), filename con hash (A)
- `src/components/settings/ExtensionsTab.tsx` — toast con istruzioni di rimozione (C)
- `src/v2/ui/pages/command/ExtensionStatus.tsx` o equivalente sorgente del log — testo del warning più chiaro (D)

## Fuori scope

- Non posso aggiornare automaticamente l'estensione in Chrome (limite browser per estensioni unpacked).
- Non tocco gli ZIP fisici, il manifest o l'embedded: già allineati a 5.7.0.

## Risultato atteso

- Sai con certezza che cosa stai scaricando.
- Se per qualche motivo lo ZIP arriva corrotto/vecchio, il sistema lo rifiuta invece di servirtelo.
- Il messaggio di "obsoleta" ti dice esattamente cosa fare in Chrome, eliminando l'ambiguità "l'ho aggiornata ma non funziona".

