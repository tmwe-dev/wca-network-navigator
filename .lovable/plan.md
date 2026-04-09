

# Piano: Rimuovere toast "nessun messaggio" + Pulse sui tab dopo sync

## Problema
I toast "Nessuna nuova email", "Messaggi LinkedIn già sincronizzati", ecc. appaiono ogni 2 minuti durante l'auto-sync, disturbando l'utente. Servono solo i toast quando ci sono nuovi messaggi.

## Cosa cambia

### 1. Rimuovere toast "vuoti" dai 3 canali

| File | Toast da rimuovere |
|---|---|
| `src/hooks/useEmailSync.ts` (riga 55) | `toast.info("Nessuna nuova email")` → rimuovere |
| `src/hooks/useLinkedInSync.ts` (righe 86-88) | `toast.info("già sincronizzati")` e `toast.info("nessun nuovo messaggio")` → rimuovere |
| `src/hooks/useWhatsAppAdaptiveSync.ts` | Verificare che non ci siano toast "nessun messaggio" (sembra ok, toast solo se newCount > 0) |

Mantenere solo i toast di successo (nuovi messaggi trovati) e di errore.

### 2. Aggiungere pulse visivo sui tab in `InArrivoTab.tsx`

Quando un sync completa (con o senza risultati), il tab del canale corrispondente fa un breve flash luminoso (200ms di `bg-primary/20` che sfuma al colore normale in 600ms).

**Meccanismo**: un evento custom `channel-sync-done` viene emesso dai 3 hook dopo ogni sync. `InArrivoTab` ascolta l'evento e applica una classe CSS temporanea `animate-pulse-once` al tab corrispondente per ~800ms.

Nessuna libreria aggiuntiva, solo CSS transition + stato temporaneo.

### File coinvolti

| File | Modifica |
|---|---|
| `src/hooks/useEmailSync.ts` | Rimuovere toast "Nessuna nuova email", emettere evento `channel-sync-done` |
| `src/hooks/useLinkedInSync.ts` | Rimuovere toast info vuoti, emettere evento |
| `src/hooks/useWhatsAppAdaptiveSync.ts` | Emettere evento dopo sync |
| `src/components/outreach/InArrivoTab.tsx` | Ascoltare evento, applicare flash al tab |

