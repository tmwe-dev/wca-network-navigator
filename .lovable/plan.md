

# Invio Diretto WhatsApp e LinkedIn dal Cockpit

## Problema
WhatsApp apre `wa.me` che viene bloccato dal browser. LinkedIn apre un dialog che chiede di riscrivere il messaggio. L'utente vuole che entrambi i canali inviino il messaggio automaticamente senza passaggi manuali.

## Soluzione: Estensione Chrome per WhatsApp (stesso pattern LinkedIn)

L'architettura gia' in uso per LinkedIn funziona perfettamente: un'estensione Chrome che opera come bridge tra la webapp e il sito destinazione. Applichiamo lo stesso modello a WhatsApp Web.

### 1. Nuova estensione Chrome — `public/whatsapp-extension/`

**`manifest.json`**: Manifest V3, permessi per `web.whatsapp.com` cookies, scripting, tabs. Content script iniettato nella webapp.

**`background.js`**: Service worker che:
- Apre `web.whatsapp.com` in tab nascosta
- Verifica se WhatsApp Web e' connesso (QR gia' scansionato)
- Cerca il contatto per numero di telefono nella barra di ricerca
- Inserisce il messaggio nella chat e clicca invio
- Chiude la tab e restituisce `{ success: true }`

**`content.js`**: Bridge identico a quello LinkedIn — ascolta `from-webapp-wa`, inoltra al background, risponde con `from-extension-wa`.

### 2. Nuovo hook — `src/hooks/useWhatsAppExtensionBridge.ts`

Stesso pattern di `useLinkedInExtensionBridge`:
- Polling ping ogni 3s con direction `from-webapp-wa`
- `isAvailable` state
- `sendMessage(phone, text)` → invia via estensione
- `verifySession()` → controlla se WhatsApp Web e' connesso

### 3. Modifica `AIDraftStudio.tsx`

- Importare `useWhatsAppExtensionBridge`
- Il bottone WhatsApp diventa **"Invia WhatsApp"** (non piu' "Apri WhatsApp")
- Se estensione disponibile: chiama `sendWhatsApp(phone, plainText)` → toast successo/errore
- Se estensione NON disponibile: fallback attuale (copia + link `wa.me` nel toast)
- Mostra indicatore se estensione WA e' connessa (pallino verde/rosso)

### 4. LinkedIn — fix invio diretto

Il `LinkedInDMDialog` gia' riceve `initialMessage` pre-compilato. Il problema e' che l'utente deve comunque premere "Invia" nel dialog. 

Opzione: **invio diretto senza dialog** quando l'estensione LinkedIn e' disponibile:
- Se `isAvailable` LinkedIn → chiama direttamente `sendDirectMessage(profileUrl, plainText)` senza aprire il dialog
- Mostra toast con risultato
- Se estensione non disponibile → apre il dialog come fallback

### 5. Pagina download estensione — `public/download-wa-extension.html`

Pagina istruzioni per installare l'estensione WhatsApp (stesso stile delle altre).

## File coinvolti

| File | Azione |
|------|--------|
| `public/whatsapp-extension/manifest.json` | Nuovo |
| `public/whatsapp-extension/background.js` | Nuovo |
| `public/whatsapp-extension/content.js` | Nuovo |
| `public/whatsapp-extension/popup.html` | Nuovo |
| `public/whatsapp-extension/popup.js` | Nuovo |
| `public/download-wa-extension.html` | Nuovo |
| `src/hooks/useWhatsAppExtensionBridge.ts` | Nuovo |
| `src/components/cockpit/AIDraftStudio.tsx` | Invio diretto WA + LI senza dialog |

## Flusso risultante

```text
WhatsApp:  Drag card → AI genera → "Invia WhatsApp" → estensione apre WA Web in background → cerca contatto → incolla messaggio → invia → toast ✅
LinkedIn:  Drag card → AI genera → "Invia LinkedIn" → estensione apre profilo in background → clicca Messaggio → incolla → invia → toast ✅
Fallback:  Se estensione non installata → comportamento attuale (copia + link)
```

