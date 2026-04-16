

# Rimozione Automazioni WhatsApp e LinkedIn — Solo Click Manuale

## Situazione attuale

- **WhatsApp**: `useWhatsAppAdaptiveSync` ha polling automatico con sequenza irregolare (5,8,4,12,17,3,4,34 min), MutationObserver push, auto-backfill su riconnessione, toggle ON/OFF, livelli di attenzione
- **LinkedIn**: `useLinkedInSync` ha auto-sync ogni 30 min con jitter, toggle ON/OFF
- **GlobalAutoSync**: orchestratore che gestisce pausa notturna e auto-resume per WA

## Obiettivo

Download WA e LI avviene **solo su click** del pulsante "Leggi". Nessun timer, nessun polling, nessun auto-resume.

---

## Fase 1 — Semplificare `useWhatsAppAdaptiveSync`

**Rimuovere:**
- Costante `POLLING_INTERVALS_MIN` e tutta la logica polling (righe 266-298)
- MutationObserver push (righe 300-309)
- Auto-backfill su riconnessione (righe 319-328)
- Check ore lavorative nel tick (non serve più, il click è sempre possibile)
- `pollIndexRef`, `timerRef` per polling
- Stati `enabled`/`toggle`/`setEnabled` (non c'è più nulla da attivare/disattivare)
- `AttentionLevel` e livelli 0/3/6

**Mantenere:**
- `sidebarScan()` — la logica core di lettura e salvataggio
- `threadScan()` — per scansione chat focalizzata
- `readNow()` — il punto di ingresso per il click manuale
- `saveMessages()` — persistenza su DB
- `isReading`, `isAvailable`, `isAuthenticated` — feedback UI
- `focusedChat`/`focusOn` — gestione chat attiva

L'hook esporrà essenzialmente: `{ readNow, isReading, isAvailable, isAuthenticated, focusedChat, focusOn }`

## Fase 2 — Semplificare `useLinkedInSync`

**Rimuovere:**
- `SYNC_INTERVAL`, `jitter`, `timerRef`, `enabledRef`
- `doAutoSync`, `scheduleNext`
- `enabled`, `toggle`

**Mantenere:**
- `performSync()` — logica core
- `readNow()` — click manuale
- `isReading`, `isAvailable`, `lastSyncAt`

## Fase 3 — Pulire `useGlobalAutoSync`

- Rimuovere import e istanza di `useWhatsAppAdaptiveSync`
- Rimuovere logica pausa/resume WA notturna (`waWasEnabledRef`, effect correlato)
- Rimuovere `waSync` dal return

## Fase 4 — Aggiornare UI

- **`WhatsAppToolbar`**: rimuovere pulsante ON/OFF e badge livello (L0/L3/L6). Tenere solo "Leggi" e "Backfill"
- **`InArrivoTab`**: rimuovere `waSync.toggle`, `waSync.enabled`, `waSync.level`, auto-backfill su riconnessione. Passare solo `readNow`/`isReading`/`isAvailable`/`isAuthenticated`
- **`LinkedInInboxView`**: rimuovere toggle ON/OFF dalla toolbar LinkedIn
- **`WhatsAppInboxView`**: rimuovere `ownSync` fallback a `useWhatsAppAdaptiveSync` (non serve più auto-sync interno)

## Fase 5 — Aggiornare memoria

Aggiornare `mem://tech/communication/whatsapp-stealth-sync` e `mem://tech/communication/linkedin-stealth-sync` per riflettere il cambio a solo-click-manuale.

---

## Riepilogo impatto

| File | Azione |
|------|--------|
| `useWhatsAppAdaptiveSync.ts` | Rimuovere polling, livelli, toggle |
| `useLinkedInSync.ts` | Rimuovere timer auto-sync, toggle |
| `useGlobalAutoSync.ts` | Rimuovere gestione WA |
| `WhatsAppToolbar.tsx` | Rimuovere ON/OFF e badge livello |
| `InArrivoTab.tsx` | Semplificare props WA |
| `LinkedInInboxView.tsx` | Rimuovere toggle |
| `WhatsAppInboxView.tsx` | Rimuovere fallback sync |

Rischio basso: nessuna modifica DB, nessuna modifica RLS, solo semplificazione codice frontend.

