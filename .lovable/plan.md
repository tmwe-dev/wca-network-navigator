## Audit /v2/inbox — WhatsApp, LinkedIn, Email

### Cosa ho verificato

**Console log preview (errore reale in produzione)**
```
[WARN] useLinkedInSync sync error { "message": "[object Object]" }
```
→ in `useLinkedInSync.ts` il `toast.error` riceve un oggetto invece di stringa: l'utente vede toast inutile e la sync non avanza mai oltre il primo errore. Stesso pattern (object → "[object Object]") presente in altri rami `catch`.

**Stato dati DB (`channel_messages`)**
- `email/inbound`: 10.011 msg, ultimo 2026-05-05 (OK)
- `whatsapp/inbound`: 156 msg, ultimo **2026-04-28** (10 giorni fa, sync ferma)
- `whatsapp/outbound`: 4 msg, ultimo 2026-04-10
- `linkedin/*`: **0 righe** (mai funzionato un ciclo completo)

**UI inconsistente sopra i tab Email/WhatsApp/LinkedIn (`InArrivoTab.tsx`)**
- Tutti e tre hanno il chip canale + badge unread.
- A destra però:
  - Email → `EmailToolbar` (Scarica/Sync/Auto/Reset/Nuova email)
  - WhatsApp → `WhatsAppToolbar` (Sincronizza + badge On/Off/Sessione + OptimusBadge + progress bar)
  - LinkedIn → solo `LinkedInOptimusBadge` (manca tutto: niente "Leggi", niente badge LI/FS, niente Backfill — quei bottoni sono **dentro** `LinkedInInboxView` nella sidebar interna)
- Conseguenze: nessuna parità visiva, l'utente non vede a colpo d'occhio se WA/LI sono connessi prima ancora di selezionare il tab; i bottoni sync di LinkedIn sono nascosti dentro un sidebar collassabile.

**Bug funzionali identificati**

1. **LinkedIn — toast `[object Object]`** (`useLinkedInSync.ts:137,146`)
   `err` può essere oggetto non-Error (es. `{ success:false, error:"timeout" }` propagato in throw). Manca normalizzazione `String(err?.error || err?.message || err)`.

2. **LinkedIn — guard 60s troppo aggressiva** (`useLinkedInSync.ts:105`)
   `if (cursor>0 && nowMs-cursor<60_000) continue;` salta TUTTI i thread con cursore aggiornato negli ultimi 60s → al secondo click "Leggi" non scarica nulla anche se ci sono nuovi messaggi.

3. **LinkedIn — cursor mai aggiornato per messaggi nuovi**
   `readNow` salva sempre con `created_at = nowMs.toISOString()`, ignorando il timestamp reale del thread. Effetto: dedup per `extId` (basato su nome+text+ts) funziona solo sull'esecuzione corrente; al refresh del DOM lo stesso messaggio viene re-inserito con extId diverso (ts cambiato). Da agganciare il timestamp parsato dal markdown (`parseInboxMarkdown` non lo estrae).

4. **WhatsApp — sync ferma da 10 giorni**
   `useWhatsAppAdaptiveSync` dipende da `isAvailable && isAuthenticated`. Probabile sessione scaduta non auto-riavviata. Non c'è banner né auto-trigger di `verifySession` quando l'utente clicca "Sincronizza" e la guardia silenzia il tentativo. Aggiungere log strutturato + toast informativo già presente solo nel happy path.

5. **WhatsApp — progress bar nascosta dentro Toolbar** non visibile durante sync se l'utente switcha tab. Spostare in stato globale (event-based) o renderizzare in alto sotto i tab canali.

6. **LinkedIn — `readThread` chiamato con nome contatto invece di URL**
   `useWhatsAppAdaptiveSync` riusa nomi, ma in `LinkedInBackfill`/inbox il `readThread(threadUrl)` è giusto. In `useLinkedInSync.readNow` non si apre mai il thread — si salva SOLO il `lastMessage` dalla sidebar inbox. Quindi non si recupera mai la conversazione completa: la pagina "Nessuna conversazione LinkedIn" è coerente con DB vuoto perché il primo `readInbox` deve aver fallito (errore `[object Object]` di cui sopra).

7. **`liMsgConfigSent` flag globale** (`useLinkedInMessagingBridge.ts:21`)
   Variabile module-scope: dopo logout/login non si re-invia config all'estensione. Reset al re-mount del provider necessario.

### Piano di intervento (solo presentazione + correzioni mirate, niente refactor)

#### A. Uniformità UI sopra i tab canali (`InArrivoTab.tsx`)
Per ogni canale mostrare a destra dei chip, in modo coerente:
- **Pulsante primario "Sincronizza/Leggi/Scarica nuove"** con loader
- **Badge stato connessione** (On/Off/Sessione) — pattern già usato da WhatsAppToolbar
- **OptimusBadge**
- **Progress inline** se sync attiva

Implementazione:
- Creare un `LinkedInToolbar.tsx` analogo a `WhatsAppToolbar.tsx`: bottone "Leggi", badge LI On/Off, badge FS On/Off, OptimusBadge, bottone Backfill (start/stop). Usa hook `useLinkedInSync`, `useLinkedInMessagingBridge`, `useLinkedInBackfill` (già esistenti).
- Estendere `EmailToolbar.tsx` con un mini badge IMAP On/Off (deriva da `useEmailAutoSync` o fallback "—") e `OptimusBadge` channel="email" pageType="inbox" se rilevante.
- Sostituire in `InArrivoTab.tsx` il blocco LinkedIn: `<LinkedInToolbar … />` invece del solo OptimusBadge.
- Aggiungere sotto la barra dei tab una **status row condivisa** (testo piccolo) che mostra l'ultimo sync per canale leggendo `channel-sync-done`/`wa-sync-completed`/`li-sync-completed` events già emessi.
- Pulire i bottoni duplicati `Leggi/Backfill` dalla sidebar interna di `LinkedInInboxView` (restano gli altri, ma i due principali salgono nella toolbar superiore per parità con WA/Email).

#### B. Fix bug LinkedIn
1. In `useLinkedInSync.ts` normalizzare ogni `toast.error`/`log.warn` su err: helper `errMsg(e)` che restituisce stringa leggibile.
2. Sostituire la guardia 60s con dedup per `extId` (già garantita da `upsertChannelMessageDedup`); rimuovere il `continue` cieco.
3. Far sì che `readNow` apra anche i thread con `unread === true` via `readThread(threadUrl)` per salvare il contenuto completo (non solo la preview).
4. Estrarre timestamp se presente nel markdown (best-effort): se non disponibile, mantenere `nowMs` ma usare `extId` con hash del solo contenuto (no timestamp) per evitare duplicati cross-run.
5. Resettare `liMsgConfigSent` all'unmount del provider `useLinkedInMessagingBridge` (variabile diventa `useRef`).

#### C. Fix bug WhatsApp
1. In `useWhatsAppAdaptiveSync.readNow`: prima del check `isAuthenticated`, forzare un `verifySession()` immediato e poi rivalutare; se ancora false, toast esplicito con CTA "Apri WhatsApp Web" (già presente, ma agganciato a evento click).
2. Spostare il rendering del progress (current/total/newMessages) in barra sotto i tab (sezione A) leggendo l'evento `wa-sync-completed` + uno nuovo `wa-sync-progress` da emettere dentro il loop esistente.
3. Loggare con `log.info` ogni passaggio di sidebar/cursor per facilitare il prossimo audit.

#### D. Verifica post-fix
- Click "Leggi" su LinkedIn → DB `channel_messages` con `channel='linkedin'` deve crescere.
- Click "Sincronizza" su WhatsApp → toast con conteggio e `last_at` aggiornata in DB.
- Switch fra tab Email/WA/LI → toolbar sempre visibile con badge stato + Optimus.

### File toccati
- `src/components/outreach/InArrivoTab.tsx` (toolbar slot LinkedIn + status row)
- `src/components/outreach/LinkedInToolbar.tsx` (nuovo)
- `src/components/outreach/EmailToolbar.tsx` (badge stato opzionale)
- `src/components/outreach/LinkedInInboxView.tsx` (rimuovere doppione bottoni Leggi/Backfill dalla sidebar)
- `src/hooks/useLinkedInSync.ts` (errMsg helper, rimozione guardia 60s, apertura thread, extId stabile)
- `src/hooks/useLinkedInMessagingBridge.ts` (`liMsgConfigSent` → ref/state)
- `src/hooks/useWhatsAppAdaptiveSync.ts` (verifySession proattivo + emit progress event)

Nessuna modifica a edge functions, RLS, schema DB, hooks email core.
