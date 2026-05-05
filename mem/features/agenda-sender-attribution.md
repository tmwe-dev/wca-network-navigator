---
name: Agenda Sender Attribution
description: Filtri trigger on_inbound_message + match_confidence per evitare attribuzioni errate e newsletter in agenda
type: feature
---
**Trigger `on_inbound_message`** (DB):
1. Skip creazione `activities` se mittente classificato in `email_address_rules.category` ∈ (newsletter, transactional, marketing, spam, automation, promotion, notification, social).
2. Skip se subject matcha pattern noti di notifiche (LinkedIn, newsletter, unsubscribe, pubblicità auto/dieta/€).
3. Skip se from_address matcha `noreply|no-reply|notifications?@|mailer-daemon|bounce|newsletter@|info@bizzmail`.
4. Legge `NEW.raw_payload->>'match_confidence'`. Se 'domain' o 'domain_ambiguous' crea l'activity SENZA partner_id (per non attribuire un'identità non verificata). Description include "Mittente da verificare".

**`matchSender`** (`supabase/functions/check-inbox/dbOperations.ts`): ritorna `match_confidence: 'exact' | 'domain' | 'domain_ambiguous' | 'none'`. Match per dominio è deterministico (`order created_at asc`, `limit 2` per rilevare ambiguità).

**`saveMessageToDb`**: salva `match_confidence` in `channel_messages.raw_payload`.

**UI agenda** (`AgendaDayDetail.tsx`): mostra `from_address` reale sotto il nome partner + badge giallo "da verificare" quando description contiene "Mittente da verificare".
