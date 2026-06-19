---
name: Command AI Query Resilience
description: Come la ricerca AI in Command resiste ai rate-limit (429) e usa fallback deterministici per query partner+paese
type: feature
---
# Command — Ricerca AI resiliente (config approvata 2026-06)

Configurazione confermata funzionante dall'utente. NON regredire.

## Componenti
- `src/v2/ui/pages/command/lib/localIntentParser.ts`: `parseLocalIntent` costruisce un QueryPlan DETERMINISTICO (zero AI) per le query di routine — entità (partner/contatti/attività/outreach/campagne/messaggi, con tolleranza refusi e dettato es. "pannelli"→partners) + intento (conteggio/elenco) + paese opzionale. Copre l'80% delle query → immune al rate-limit 429.
- `src/v2/ui/pages/command/tools/aiQueryTool.ts`: usa `parseLocalIntent` per primo; se ricade sul planner AI e questo è rate-limited, fa 1 retry (backoff 1.2s) e poi fallback al parser locale invece di mostrare "Richiesta non supportata".
- `src/v2/ui/pages/command/aiBridge.ts`: intercetta AI_RATE_LIMITED / 429 e degrada con `fallbackComment` invece di errore.
- `src/v2/ui/pages/command/lib/localResultFormatter.ts`: con un piano deterministico il commento (dato+proposta+voce) è generato localmente, quindi la voce parla anche durante i 429 del commentatore.
- `src/v2/ui/pages/command/tools/composeEmail/batchDrafts.ts`: bozze email serializzate con delay 250ms.

## Comportamento atteso
- "quanti partner abbiamo a Malta" / "quanti pannelli abbiamo Malta" (refuso) → conteggio + canvas + voce, senza passare dall'AI.
- Il rate-limit AI degrada sempre con fallback (planner→parser locale, commento→locale), mai oscura i dati DB né mostra "Richiesta non supportata" per query di routine.

## Principio
NON allargare regex caso-per-caso: il parser deterministico (`localIntentParser`) è il nodo unico da estendere. Niente nuovi cerotti.
