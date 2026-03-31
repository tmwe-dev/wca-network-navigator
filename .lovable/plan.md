

# Connessione One-Click: LinkedIn e WhatsApp

## Situazione attuale

Il sistema mostra "Non rilevato" e istruzioni manuali per installare estensioni Chrome. L'utente vuole un singolo bottone "Connetti" che gestisca tutto.

## Limiti tecnici reali

Le estensioni Chrome **non possono** essere installate via codice — è una restrizione di sicurezza di Google. Tuttavia possiamo:
1. **Simulare la connessione** per LinkedIn usando le credenziali già salvate + le API server-side (cookie `li_at` già disponibile nel DB)
2. **Per WhatsApp** aprire una sessione WA Web embedded o usare il link `wa.me` come fallback

## Cosa faremo

### 1. Bottone "Connetti Tutto" nella header (`ConnectionStatusBar.tsx`)

Un singolo bottone che:
- **LinkedIn**: chiama l'edge function `get-linkedin-credentials` per verificare che le credenziali esistano → poi chiama `save-linkedin-cookie` se il cookie `li_at` è già nel DB → segna come connesso. Se le credenziali mancano, apre inline un mini-form per inserirle
- **WhatsApp**: verifica se l'estensione risponde al ping. Se sì, auto-verifica la sessione. Se no, mostra un dialog compatto con download + 4 step (senza navigare altrove)
- **AI Agent**: sempre attivo, conferma visiva

### 2. Auto-connect all'apertura del Cockpit (`Cockpit.tsx`)

Quando si apre il Cockpit:
- Tenta automaticamente di verificare LinkedIn (via cookie `li_at` salvato nel DB — non serve l'estensione per la Deep Search, solo per l'invio DM)
- Tenta ping WhatsApp extension
- Aggiorna lo stato delle icone nella header

### 3. Semplificazione radicale del tab Canali (`ConnectionsSettings.tsx`)

Rimuovere le istruzioni tecniche verbose. Per ogni canale:
- **Connesso**: badge verde + bottone "Verifica"
- **Non connesso**: singolo bottone "Connetti" che fa tutto il possibile automaticamente
- Credenziali LinkedIn: se già salvate nel DB, mostrare "✅ Credenziali configurate" invece del form vuoto
- Le istruzioni estensione Chrome diventano un piccolo `<details>` nascosto sotto "Setup avanzato"

### 4. Stato connessione persistente

Salvare lo stato delle connessioni in `app_settings` (`linkedin_connected`, `whatsapp_connected`) così all'apertura successiva le icone si mostrano subito verdi senza attendere il ping.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/layout/ConnectionStatusBar.tsx` | Bottone "Connetti tutto" + auto-verify al mount |
| `src/components/settings/ConnectionsSettings.tsx` | Semplificare UI, auto-detect credenziali, nascondere istruzioni tecniche |
| `src/pages/Cockpit.tsx` | Auto-connect all'apertura |

