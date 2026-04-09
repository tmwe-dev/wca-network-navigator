

# Piano: Auto-Attivazione Globale + Pausa Notturna

## Cosa cambia

### 1. Hook centralizzato `useGlobalAutoSync` (nuovo)
Un unico hook in `AppLayout` che all'avvio:
- Chiama `useAutoConnect()` (verifica LinkedIn + WhatsApp)
- Attiva automaticamente l'email auto-sync (oggi parte disattivato, default `false` in localStorage)
- Attiva automaticamente il WhatsApp adaptive sync (oggi parte con `enabled = false`)
- Rispetta la **pausa notturna** basata sul fuso orario locale del browser

### 2. Pausa Notturna automatica
- Rileva il fuso orario con `Intl.DateTimeFormat().resolvedOptions().timeZone`
- Se l'ora locale è tra **00:00 e 06:00** → tutti i sync sono sospesi
- Un timer controlla ogni 5 minuti se siamo usciti dalla fascia notturna e riattiva
- Nessuna chiamata WhatsApp, LinkedIn o email durante la pausa
- Badge discreto nell'header: "🌙 Pausa notturna" quando attivo

### 3. Modifiche ai sync esistenti

**Email (`useEmailAutoSync`)**: default cambia da `false` a `true`. Intervallo resta 2 minuti. Aggiunge check pausa notturna.

**WhatsApp (`useWhatsAppAdaptiveSync`)**: `enabled` inizializzato a `true` invece di `false`. Il timer tick controlla se è notte prima di eseguire.

**Auto-connect (`useAutoConnect`)**: spostato da `useCockpitLogic` ad `AppLayout` così parte su qualsiasi pagina, non solo dal Cockpit.

### 4. Integrazione in AppLayout
`AppLayout.tsx` chiama `useGlobalAutoSync()` che orchestra tutto. Nessun cambio necessario nelle singole pagine.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/hooks/useGlobalAutoSync.ts` | **Nuovo** — orchestra auto-connect, email sync, WA sync, pausa notturna |
| `src/hooks/useEmailAutoSync.ts` | Default `true`, accetta `paused` prop esterno |
| `src/hooks/useWhatsAppAdaptiveSync.ts` | Default `true`, accetta `paused` prop esterno |
| `src/hooks/useAutoConnect.ts` | Nessuna modifica (già funzionante) |
| `src/hooks/useCockpitLogic.ts` | Rimuovere `useAutoConnect()` (spostato in AppLayout) |
| `src/components/layout/AppLayout.tsx` | Aggiungere `useGlobalAutoSync()` |
| `src/components/layout/ConnectionStatusBar.tsx` | Badge "🌙" durante pausa notturna |

## Risultato
- All'apertura dell'app: WhatsApp, LinkedIn ed email si attivano automaticamente
- Email scaricate ogni 2 minuti, WhatsApp scansionato ogni 75 secondi (idle)
- Tra mezzanotte e le 6 del mattino (ora locale del computer): tutto in pausa
- L'utente non deve premere nessun pulsante

