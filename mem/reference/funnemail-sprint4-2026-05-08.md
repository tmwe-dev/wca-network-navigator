---
name: Funnemail Sprint 4 — Scout Cache + Routing Rules
description: Sprint 4 audit Funnemail. Cache scout per-utente e routing rules composite.
type: reference
---

# Sprint 4 — 2026-05-08

## Migrazioni
- `funnemail_scout_cache` (per-utente, RLS owner). Unique index su `(user_id, COALESCE(email_address, email_domain))`. TTL 30gg default.
- `funnemail_routing_rules` (per-utente, RLS owner). `conditions` jsonb (array AND di {field, op, value}), priority asc, confidence_threshold, match_count.

## Edge functions
- `funnemail-scout-sender`: cache lookup utente PRIMA del lookup globale; write su entrambe le cache (legacy + per-utente). Comportamento globale invariato in caso di assenza di cache utente.
- `funnemail-auto-route`: nuovo step 2b "composite rules". Carica `funnemail_routing_rules` per priorità ASC, valuta condizioni AND, applica gruppo target, incrementa `match_count`. Solo se nessuna regola matcha → fallback AI.

## DAL + UI
- `src/data/funnemailRoutingRules.ts`, `src/data/funnemailScoutCache.ts`
- Tab "Routing Rules" e "Scout Cache" in `/v2/email-intelligence`

## Note
- Reversibile: cache globale `funnemail_sender_intel` mantenuta come fallback. Auto-route AI fallback intatto.
- Operatori condition: equals, contains, starts_with, ends_with, regex, in.
- Hard guards e editorial review intoccati: composite rules emettono solo `tag_only` di fatto (assegnazione gruppo), nessun invio.