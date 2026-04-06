

# Convertire l'estensione Universal Communication Hub da Popup a Side Panel

## Situazione attuale

L'estensione ha già la struttura per un side panel (`sidePanel` permission nel manifest, `sidepanel.html/js/css`), ma il side panel contiene solo il lettore email. Tutta la UI principale (onboarding, dashboard a 3 tab, compose) vive in `popup.html` che si apre come una finestra popup di 420x600px — troppo piccola e scomoda.

## Obiettivo

Trasformare l'estensione in un **pannello laterale fisso nel browser** (come Claude, ChatGPT), con tutto il contenuto (onboarding + dashboard + email reader + compose + chat AI) dentro il side panel. La popup diventa un semplice pulsante "Apri pannello".

## Piano di intervento

### 1. Manifest — Side Panel come UI primaria
Modificare `manifest.json` per:
- Rimuovere `default_popup` dalla sezione `action` (così il click sull'icona apre il side panel)
- Aggiungere la configurazione `side_panel` con `default_path: "sidepanel.html"`
- Aggiungere il permesso `"sidePanel"` (già presente)

### 2. Side Panel HTML — Unificare tutta la UI
Riscrivere `sidepanel.html` per includere:
- **Onboarding** completo (6 step: welcome, email, server, WhatsApp, LinkedIn, AI, preferenze)
- **Dashboard** con i 3 tab (Email, WhatsApp, LinkedIn) + stats + inbox preview
- **Email reader** (già presente, da integrare)
- **Compose** multicanale
- **Campo testo** fisso in basso (input di composizione rapida sempre visibile)

L'HTML viene di fatto unificato da `popup.html` + `sidepanel.html` attuali in un unico `sidepanel.html`.

### 3. Side Panel CSS — Layout full-height ridimensionabile
Riscrivere `sidepanel.css` unificando `popup.css` + `sidepanel.css`:
- Rimuovere il vincolo `width: 420px; max-height: 600px` del popup
- Layout `height: 100vh; width: 100%` — il side panel si adatta automaticamente
- Campo di input fisso in basso con `position: sticky`
- Tutte le sezioni scrollabili nel corpo centrale

### 4. Side Panel JS — Unificare la logica
Fondere `popup.js` (514 righe: onboarding, dashboard, compose, send) con `sidepanel.js` (334 righe: email reader) in un unico `sidepanel.js` che gestisce tutti i flussi.

### 5. Popup — Ridurre a mini-launcher
`popup.html` diventa un micro-pannello con un solo pulsante "Apri pannello laterale" che chiama `chrome.sidePanel.open()`. Alternativa: rimuovere del tutto la popup e configurare il background per aprire il side panel al click sull'icona tramite `chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })`.

### 6. Background — Auto-open side panel
Aggiungere in `background.js`:
```text
chrome.sidePanel.setPanelBehavior({ openPanelOnActionClick: true })
```
Così il click sull'icona dell'estensione apre direttamente il pannello laterale senza passare dalla popup.

### 7. Rigenerare lo ZIP
Ricostruire `public/email-extension.zip` con i file aggiornati.

## File coinvolti

| File | Azione |
|------|--------|
| `public/email-extension/manifest.json` | Rimuovere popup, configurare side panel come primario |
| `public/email-extension/sidepanel.html` | Riscrivere: tutto il contenuto unificato |
| `public/email-extension/sidepanel.css` | Riscrivere: fusione popup.css + sidepanel.css, layout full-height |
| `public/email-extension/sidepanel.js` | Riscrivere: fusione popup.js + sidepanel.js |
| `public/email-extension/popup.html` | Ridurre a mini-launcher o rimuovere |
| `public/email-extension/popup.js` | Ridurre o rimuovere |
| `public/email-extension/popup.css` | Ridurre o rimuovere |
| `public/email-extension/background.js` | Aggiungere `setPanelBehavior` |
| `public/email-extension.zip` | Rigenerare |

## Risultato atteso

L'utente clicca sull'icona dell'estensione → si apre un pannello laterale a destra del browser (come Claude/ChatGPT) → dentro trova onboarding al primo avvio, poi dashboard completo con 3 tab, lettore email, compose multicanale, e un campo di testo sempre visibile in basso per la composizione rapida. Il pannello è ridimensionabile trascinando il bordo sinistro (funzionalità nativa di Chrome).

