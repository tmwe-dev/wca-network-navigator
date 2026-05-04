---
name: AI Routing Audit 2026-05-04
description: Doppio audit AI/routing/scheduling del 4 maggio 2026 (primo + deep 6 livelli) — 3 P0 e 4 P1 confermati, 6 nuovi finding
type: reference
---

Audit registrati in `docs/audit/`:
- `2026-05-04-ai-routing.md` — primo audit
- `2026-05-04-deep-ai-audit.md` — deep audit 6 livelli (architettura → moduli → funzioni → matching → sincronizzazione → agenti/prompt/KB)

## P0 confermati
1. `check-inbox/postProcessing.ts:64` filtra `raw_payload.direction === "inbound"` ma il campo è top-level → 1 sola riga storica in `email_classifications`
2. `funnemail-classify` mai cablato nel cron inbox → `funnemail_decisions` vuota
3. `ai_interaction_log` ed `edge_metrics` vuote malgrado AI Invocation Charter ENFORCED — telemetria spenta (NUOVO)

## P1 confermati
- 16 categorie commerciali senza handler in `postClassificationPipeline` (numero corretto: 16, non 17)
- `generateReplyDraft` bypassa `journalistReview` (4 call sites in `_shared/`)
- `pending-action-executor` senza handler per `reply_to_question`/`handle_complaint` E senza cron schedulato
- 4 motori scheduling (cadence/outreach-scheduler/smart-scheduler/agent-autonomous-cycle) senza dedup cross-engine
- `memory-promoter` 03:00 gira PRIMA di `memory_embed_backfill` 03:15 (ordine invertito vs KB)

## Nuovi finding (deep audit)
- `agent_personas` ha 0 righe malgrado memoria dichiari layer attivo
- `agent_routing_rules` ha 0 righe
- `prompt_test_cases` ha 0 righe (versioning attivo, regression test DB assenti)
- 0 agenti hanno `can_send_email=true` → la gerarchia agente non controlla gli invii
- 3 agenti hanno 0 tool (Funnemail, Gordon, Sara)

Non applicare fix in automatico — l'utente sceglie le priorità.
