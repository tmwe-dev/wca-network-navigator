---
name: Command AI Query Resilience
description: Come la ricerca AI in Command resiste ai rate-limit (429) e usa fallback deterministici per query partner+paese
type: feature
---
# Command — Ricerca AI resiliente (config approvata 2026-06)

Configurazione confermata funzionante dall'utente. NON regredire.

## Componenti
- `src/v2/ui/pages/command/tools/aiQueryTool.ts`: `deterministicPartnerCountryPlan` bypassa il planner AI per query "partner + paese".
- `src/v2/ui/pages/command/aiBridge.ts`: intercetta AI_RATE_LIMITED / 429 e degrada con `fallbackComment` invece di errore.
- `src/v2/ui/pages/command/tools/composeEmail/batchDrafts.ts`: bozze email serializzate con delay 250ms.
- `src/v2/ui/pages/command/lib/localResultFormatter.ts`: COUNTRY_LABELS include MT: "Malta".

## Comportamento atteso
- "quanti partners abbiamo in malta" → risultati DB corretti senza "Troppe richieste AI".
- Il rate-limit AI degrada sempre con commento di fallback, mai oscura i dati DB.
