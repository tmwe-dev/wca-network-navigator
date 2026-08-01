---
name: Sprint Codex iter3 2026-05-11
description: Chiusura sprint D (Holding SLA badge) + E.2 (4 KPI Funnemail). Verifica E.3 (Charter AI già pulito) e Sprint C (Health Banner + cron già live).
type: reference
---

## Cambiamenti
- Holding Pattern: badge SLA (verde <72h, giallo 72-168h, rosso >168h) in `HoldingContactList.tsx` da `group.latestDate`. UI-only.
- Funnemail Operations: 4 KPI cards (smistati/h, accuracy ≥70%, claim rate, queue depth) calcolati da brain+jobs già fetched. UI-only.

## Verifiche
- `rg supabase.functions.invoke` su edge AI = 0 hit → Charter AI pulito (no Sprint E.3 changes needed).
- PromptLabHealthBanner già consuma `prompt_lab_cron_status` RPC creata in iter2.
- Cron refiner settimanale schedulato in iter2 (lunedì 03:00 UTC).

## Defense / Rollback
- Holding badge: rimuovere chiamata `holdingSlaBadge(group.latestDate)` in HoldingContactList.tsx.
- Funnemail KPI: rimuovere blocco `<div className="grid grid-cols-2 md:grid-cols-4 gap-2">` in EmailIntelligenceOperationsPage.tsx.
