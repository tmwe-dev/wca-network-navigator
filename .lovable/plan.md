

# Piano: Deep Backfill WhatsApp con Delay 15-20s

## Cosa cambia

### 1. Riscrittura `useWhatsAppBackfill.ts` — Backfill a 2 fasi

**Fase 1 — Discovery (sidebar scan)**
- Chiama `readUnread()` per ottenere la lista contatti con messaggi
- Per ogni contatto, cerca nel DB l'ultimo messaggio salvato (query `channel_messages` filtrata per contact + channel=whatsapp, ordinata per `created_at DESC`)
- Identifica i contatti con potenziali gap (hanno messaggi nuovi nella sidebar rispetto all'ultimo salvato)

**Fase 2 — Deep Recovery (chat per chat)**
- Per ogni contatto con gap (max 10 chat per sessione), chiama `readThread(contact, 50)` per leggere i messaggi visibili nella chat
- Se il gap è grande, usa `backfillChat(contact, lastKnownText, 30)` per scrollare verso l'alto fino a trovare l'ultimo messaggio già salvato
- **Pausa di 15-20 secondi** (jitter randomico) tra una chat e l'altra
- Salva ogni messaggio con ID deterministico (dedup automatica)
- Mostra progresso: "Recupero chat 3/8 — 47 messaggi recuperati"

### 2. Trigger automatico in `useWhatsAppAdaptiveSync.ts`

- Traccia lo stato precedente di `isAuthenticated` con un ref
- Quando passa da `false` → `true` (riconnessione), lancia automaticamente il deep backfill
- Il backfill gira in background senza bloccare la sync normale

### 3. Progress UI aggiornata

Il tipo `BackfillProgress` si arricchisce con:
- `phase: "discovery" | "deep" | "idle"`
- `currentChat: string | null` — nome del contatto in corso
- `chatsProcessed / chatsTotal` — contatore chat

## File coinvolti

| File | Modifica |
|------|----------|
| `src/hooks/useWhatsAppBackfill.ts` | Riscrittura completa: Fase 1 discovery + Fase 2 deep con readThread/backfillChat, pause 15-20s, max 10 chat |
| `src/hooks/useWhatsAppAdaptiveSync.ts` | Aggiungere ref `prevAuthRef`, trigger backfill su riconnessione (false→true) |
| `src/components/outreach/InArrivoTab.tsx` | Passare il trigger di backfill dal sync, mostrare progress aggiornato |

## Costanti chiave
- `MAX_CHATS_PER_SESSION = 10`
- `PAUSE_BETWEEN_CHATS_MS = 17500` (15-20s con jitter ±15%)
- `MAX_SCROLLS_PER_CHAT = 30`
- `MAX_MESSAGES_PER_THREAD = 50`

## Risultato
- Alla riconnessione WhatsApp: backfill automatico chat per chat
- Delay 15-20s tra ogni chat per sicurezza
- Max 10 chat per sessione, max 30 scroll per chat
- Deduplicazione garantita, interrompibile in qualsiasi momento

