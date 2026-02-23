
# LinkedIn: Credenziali Email/Password + Estensione Chrome

## 1. Aggiungere Email e Password LinkedIn nelle Impostazioni

Attualmente la sezione LinkedIn nelle Impostazioni contiene solo il campo cookie `li_at`. Aggiungeremo i campi **email** e **password** (come per WCA e ReportAziende).

**File: `src/pages/Settings.tsx`**
- Aggiungere stati `liEmail` e `liPass` (+ `showLiPass`)
- Caricare da `app_settings` le chiavi `linkedin_email` e `linkedin_password`
- Aggiungere i campi input Email e Password SOPRA il campo cookie li_at
- Il cookie li_at resta come opzione manuale avanzata (collassabile)
- Pulsante "Salva Credenziali LinkedIn" salva email + password
- L'estensione usera queste credenziali per l'auto-login

## 2. Creare l'Estensione Chrome per LinkedIn

Creare una nuova estensione in `public/linkedin-extension/` con la stessa architettura dell'estensione WCA:

**File da creare:**

| File | Descrizione |
|------|-------------|
| `public/linkedin-extension/manifest.json` | Manifest v3 con permessi per linkedin.com |
| `public/linkedin-extension/background.js` | Service worker: auto-login, sync cookie, scraping profili |
| `public/linkedin-extension/content.js` | Bridge webapp-estensione (stessa logica di WCA) |
| `public/linkedin-extension/popup.html` | Popup con stato connessione |
| `public/linkedin-extension/popup.js` | Logica popup |

**Funzionalita dell'estensione:**
- **ping**: verifica disponibilita
- **verifySession**: controlla se LinkedIn e autenticato (verifica presenza di elementi di sessione)
- **autoLogin**: apre linkedin.com/login, compila email/password, effettua il login
- **syncCookie**: legge il cookie `li_at` dal browser e lo salva nel database tramite edge function
- **extractProfile**: apre un profilo LinkedIn per URL, estrae dati visibili (nome, titolo, azienda, bio, foto)

## 3. Edge Function per salvare il cookie LinkedIn

**File: `supabase/functions/save-linkedin-cookie/index.ts`**
- Riceve il cookie `li_at` dall'estensione
- Lo salva in `app_settings` con chiave `linkedin_li_at`
- Aggiorna `linkedin_session_status` e `linkedin_session_checked_at`

## 4. Edge Function per le credenziali LinkedIn

**File: `supabase/functions/get-linkedin-credentials/index.ts`**
- Restituisce `linkedin_email` e `linkedin_password` da `app_settings`
- Usata dall'estensione per l'auto-login

## 5. Hook useLinkedInExtensionBridge

**File: `src/hooks/useLinkedInExtensionBridge.ts`**
- Stessa architettura di `useExtensionBridge.ts` ma con `direction: "from-webapp-li"` / `"from-extension-li"`
- Metodi: `isAvailable`, `verifySession`, `syncCookie`, `extractProfile`, `autoLogin`

## 6. Pagina download estensione

**File: `public/download-linkedin-extension.html`**
- Pagina con istruzioni per scaricare e installare l'estensione LinkedIn

## 7. Aggiornamento config.toml

Aggiungere le nuove edge functions con `verify_jwt = false`.

## Dettagli tecnici

### Manifest LinkedIn Extension
```json
{
  "manifest_version": 3,
  "name": "LinkedIn Cookie Sync",
  "permissions": ["cookies", "tabs", "activeTab", "scripting"],
  "host_permissions": ["https://*.linkedin.com/*"],
  "content_scripts": [{
    "matches": ["https://*.lovable.app/*", "https://*.lovableproject.com/*"],
    "js": ["content.js"]
  }]
}
```

### Auto-login flow
1. Estensione apre tab `https://www.linkedin.com/login`
2. Attende caricamento pagina
3. Compila `#username` (email) e `#password` (password)
4. Clicca il pulsante di login
5. Attende redirect alla home
6. Legge cookie `li_at` e lo sincronizza al server

### Sicurezza
- Le credenziali sono salvate in `app_settings` (protetto da RLS)
- Il cookie li_at e condiviso tra l'inserimento manuale e la sincronizzazione automatica dell'estensione
- L'estensione non invia mai credenziali a terzi
