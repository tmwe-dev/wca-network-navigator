---
name: Agenda Sender Attribution
description: 1 email = 1 mittente. Match SOLO esatto. Filtri newsletter/no-reply nel trigger on_inbound_message.
type: feature
---
**Politica (2026-05-05)**: un'email in entrata ha UN solo `from_address`. L'azienda associata deriva esclusivamente dal record con quell'email esatta in `partners`/`partner_contacts`/`imported_contacts`/`prospects`. **Mai** inferire partner per somiglianza di dominio.

**`matchSender`** (`supabase/functions/check-inbox/dbOperations.ts`): ritorna `match_confidence: 'exact' | 'none'`. I risultati `_domain` dell'RPC `match_email_sender` vengono ignorati. Nessuna fallback query per dominio.

**Trigger `on_inbound_message`** (DB) — filtri ancora attivi:
1. Skip activity se mittente in `email_address_rules.category` ∈ (newsletter, transactional, marketing, spam, automation, promotion, notification, social).
2. Skip se subject matcha pattern di notifiche (LinkedIn, newsletter, unsubscribe, pubblicità).
3. Skip se from_address matcha `noreply|no-reply|notifications?@|mailer-daemon|bounce|newsletter@|info@bizzmail`.
4. `partner_id` dell'activity = quello di `channel_messages` (esatto o NULL). Niente più branch "domain → strip partner_id".

**UI agenda** (`AgendaDayDetail.tsx`): mostra `from_address` reale sotto il nome partner. Nessun badge "da verificare" (non più necessario).
