

# Fix Strutturale Comunicazioni InReach — Piano Chirurgico in 4 Fasi

## Diagnosi confermata

La tabella `channel_messages` contiene dati correttamente separati per `user_id` e `channel`. Le RLS sono corrette (ogni utente vede solo i suoi; admin vede tutti). Il problema è **interamente nel frontend**: le query keys sono statiche e quindi React Query sovrascrive i dati tra canali e tra utenti.

**Dati reali:**
- Luca (admin): 1754 email, 7 WA
- 3 altri utenti: 1264-4269 email ciascuno, alcuni con WA
- 0 messaggi LinkedIn per tutti

---

## Fase 1 — Query Keys parametriche

**File:** `src/lib/queryKeys.ts`

Trasformare la sezione `channelMessages` da costanti a funzioni:
```
channelMessages: {
  root: ["channel-messages"] as const,
  list: (channel?: string, search?: string, page?: number, operatorId?: string) =>
    ["channel-messages", channel ?? "all", search ?? "", page ?? 0, operatorId ?? "self"] as const,
  unread: (channel?: string, operatorId?: string) =>
    ["channel-messages-unread", channel ?? "all", operatorId ?? "self"] as const,
  unreadCounts: ["unread-counts"] as const,
}
```

---

## Fase 2 — Fix `useChannelMessages` hook

**File:** `src/hooks/useChannelMessages.ts`

- Usare `queryKeys.channelMessages.list(channel, searchQuery, page, operatorUserId)` come queryKey
- Allineare il listener realtime: `setQueryData` deve scrivere sulla stessa key parametrica
- Invalidare con `queryKeys.channelMessages.root` per refetch globale

---

## Fase 3 — Fix `useUnreadCount` e `useMarkAsRead`

**File:** `src/hooks/useEmailActions.ts`

- `useUnreadCount`: usare `queryKeys.channelMessages.unread(channel)` come queryKey (parametrica per canale)
- `useMarkAsRead.onSuccess`: invalidare `queryKeys.channelMessages.root` (prefisso) per invalidare tutte le varianti

---

## Fase 4 — Verificare che i consumatori passino i parametri corretti

**File:** `src/components/outreach/EmailInboxView.tsx` — già passa `"email"` e `operatorUserId` ✓
**File:** `src/components/outreach/WhatsAppInboxView.tsx` — già passa `"whatsapp"` e `operatorUserId` ✓
**File:** `src/components/outreach/LinkedInInboxView.tsx` — già passa `"linkedin"` e `operatorUserId` ✓
**File:** `src/components/outreach/InArrivoTab.tsx` — `useUnreadCount` va aggiornata per passare il canale corretto (già lo fa, ma la key deve distinguerli)

Nessun altro file richiede modifiche. I componenti view già passano i parametri corretti, è solo il layer di caching che li ignora.

---

## Risultato atteso

| Prima | Dopo |
|-------|------|
| Email e WA mescolati nella stessa cache | Ogni tab (Email/WA/LI) ha cache indipendente |
| Cambio operatore non triggera refetch | Nuova queryKey → refetch automatico |
| Unread badge identico per tutti i canali | Badge separato per canale |
| Realtime non aggiorna nulla | Realtime scrive sulla key corretta |

## Rischio

Basso. Le modifiche sono limitate a 3 file, tutte nel layer di query/cache. Nessuna modifica a componenti UI, nessuna migrazione DB, nessuna modifica RLS.

