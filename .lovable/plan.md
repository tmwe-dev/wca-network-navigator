
# Estensione Email Universale — Piano di Implementazione

## Obiettivo
Creare un'estensione Chrome standalone per scaricare email via IMAP sul PC dell'utente, con onboarding integrato che offre la scelta di storage (default: locale).

## Architettura

### 1. Onboarding nell'estensione (popup)
- **Step 1 — Credenziali**: Email + Password
- **Step 2 — Auto-discovery**: Il sistema cerca automaticamente il server IMAP (MX lookup + well-known providers map)
- **Step 3 — Storage**: Scelta con **"Scarica sul PC"** come opzione principale/preselezionata, più opzione secondaria "Salva nel cloud"
- **Step 4 — Conferma e primo sync**

### 2. Struttura file estensione
```
public/email-extension/
├── manifest.json
├── popup.html          — UI onboarding + dashboard
├── popup.js            — Logica UI
├── background.js       — Service worker IMAP
├── imap-worker.js      — Connessione IMAP via fetch a edge function
├── auto-discover.js    — Auto-discovery server IMAP
├── storage-manager.js  — Gestione download locale (.eml) o cloud
├── notifier.js         — Notifiche push nuove email
├── popup.css           — Stile
└── icons/
```

### 3. Funzionalità core
| Feature | Dettaglio |
|---|---|
| Auto-discovery IMAP | MX DNS + mappa provider noti (Gmail, Outlook, Yahoo, ecc.) |
| Download locale | Salva .eml nella cartella Download del PC via `chrome.downloads` |
| Sync incrementale | Traccia ultimo UID scaricato, scarica solo i nuovi |
| Notifiche | `chrome.notifications` per nuove email |
| Dashboard | Popup con contatori, ultimo sync, pulsante sync manuale |

### 4. Edge function di supporto
- `email-imap-proxy`: Proxy IMAP server-side (i browser non possono connettersi IMAP direttamente)

### 5. File da creare/modificare
| File | Azione |
|---|---|
| `public/email-extension/*` | Nuovo — tutti i file dell'estensione |
| `supabase/functions/email-imap-proxy/index.ts` | Nuovo — proxy IMAP |
| `src/components/settings/ExtensionsTab.tsx` | Aggiungere card download |
| `public/email-extension.zip` | Nuovo — pacchetto installabile |
