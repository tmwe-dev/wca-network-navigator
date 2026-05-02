---
name: Command Persistent Memory Wiring
description: useConversation ora collegato a useCommandSubmit; ogni turno user/assistant viene persistito in DB e buildHistory unisce DB+RAM (ultimi 20 turni) per dare al planner memoria reale multi-turn
type: feature
---
**Cosa**: `/v2/command` ora ha memoria conversazionale reale.

**Wiring**:
- `CommandPage.tsx` passa `conv.messages` + `conv.addMessage` a `useCommandSubmit`.
- `useCommandSubmit` wrappa `addMessage` in `addMessagePersisted` che chiama `conv.addMessage` (fire-and-forget) per ogni turno user/assistant non-thinking.
- `useCommandHistory(messages, persistedMessages)` ora unisce DB + RAM, dedup su (role, content), cap a 20 turni.
- Il planner riceve quindi storia completa anche dopo refresh / nuove sessioni se l'utente riapre la conversazione dalla sidebar.

**Non toccato**: i 4 sistemi di contesto esistenti (`useConversation`, `buildHistory`, `queryContext`, `lastQueryResultContext`) restano separati come da architettura — questo fix li collega senza rifattorizzare.
