

# Piano: Rilevamento Continuo Sessione WhatsApp Web

## Problema

Il sistema distingue solo se l'**estensione Chrome** è installata (`isAvailable`), ma NON verifica se **WhatsApp Web è autenticato** (sessione attiva, QR non mostrato). Il controllo `verifySession` viene fatto solo una volta all'avvio. Se WhatsApp Web si disconnette, il badge resta verde e i bottoni Leggi/Backfill falliscono silenziosamente.

## Soluzione

Aggiungere un **heartbeat di sessione** nel bridge WhatsApp che chiama `verifySession` periodicamente (ogni 30s) e espone un nuovo stato `isAuthenticated` separato da `isAvailable`.

## Modifiche

### 1. `src/hooks/useWhatsAppExtensionBridge.ts`
- Aggiungere stato `isAuthenticated` (boolean) — indica se WhatsApp Web ha sessione attiva
- Nel polling esistente (ogni 3s per `ping`), aggiungere un check `verifySession` ogni 30s
- Se `verifySession` ritorna `authenticated: false` → `isAuthenticated = false`
- Esporre `isAuthenticated` nel return del hook

### 2. `src/components/outreach/WhatsAppToolbar.tsx`
- Ricevere `isAuthenticated` nelle props
- Il badge connessione mostra 3 stati:
  - 🟢 **Connesso** — estensione OK + sessione attiva
  - 🟡 **Sessione chiusa** — estensione OK ma WhatsApp Web non autenticato
  - 🔴 **Estensione Off** — estensione non disponibile
- Disabilitare Leggi/Backfill quando `isAuthenticated === false`

### 3. `src/components/outreach/InArrivoTab.tsx`
- Passare `isAuthenticated` dal bridge alla toolbar

### 4. `src/hooks/useWhatsAppAdaptiveSync.ts`
- Prima di ogni scan, controllare `isAuthenticated`
- Se false, saltare il tick e mostrare toast "WhatsApp Web disconnesso"

## File coinvolti

| File | Azione |
|------|--------|
| `src/hooks/useWhatsAppExtensionBridge.ts` | +stato `isAuthenticated`, heartbeat 30s con `verifySession` |
| `src/components/outreach/WhatsAppToolbar.tsx` | Badge a 3 stati, disabilita azioni se non autenticato |
| `src/components/outreach/InArrivoTab.tsx` | Passa `isAuthenticated` |
| `src/hooks/useWhatsAppAdaptiveSync.ts` | Check autenticazione prima di ogni scan |

