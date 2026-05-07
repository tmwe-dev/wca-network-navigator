---
name: Brand Voice System
description: Sistema di voce unica TMWE su 4 layer (KB doctrine/brand-voice + agent_personas + operative_prompts Stile TMWE + brand_voice_score nel journalistReviewLayer). Score deterministico 0-100, telemetria in brand_voice_audits, no nuovo gate bloccante.
type: feature
---
# Brand Voice TMWE — Architettura

## 4 layer cooperanti
1. **KB doctrine/brand-voice/*** — fonte unica della voce (8 schede: identity, tone, lexicon-do, lexicon-dont, punctuation-emoji, signatures, length-rules, channel-deltas). Inserite come `kb_entry_proposals` pending → 1-click approval in KB Supervisor.
2. **agent_personas / journalist cards** — 4 ruoli editoriali (rompighiaccio, risvegliatore, chiusore, accompagnatore) con tono/donts/must_know in `app_settings` (chiavi `journalist_<role>_*`).
3. **operative_prompts "Stile TMWE"** — 1 master (context=general, priority 100) + 4 varianti (email/whatsapp/linkedin/voce). Caricati via `loadOperativePrompts`.
4. **brandVoiceScorer.ts** — calcolo deterministico (no LLM) integrato in `journalistReviewLayer`. Score 0-100, deviations[], signals{}. Persiste in `brand_voice_audits` (fire-and-forget).

## Penalità deterministiche
- Lessico vietato: -12 per hit (max -36)
- Lunghezza fuori range: -8/-10/-20 secondo gravità
- Emoji oltre soglia canale: -5 per emoji extra (max -15)
- "!" >1: -3 per extra
- "..." su email/whatsapp/linkedin: -5
- Signature mancante: -8

## Soglie warnings (NON bloccanti)
- score < 60 → warning info
- score < 40 → warning warning
- nessun nuovo verdict block (gate journalist invariato)

## Tabella telemetria
`brand_voice_audits` — RLS: read/insert per ogni autenticato (visibilità globale agenti).
Colonne: channel, journalist_role, brand_voice_score, deviations, signals, message_excerpt.

## Files
- `supabase/functions/_shared/brandVoiceScorer.ts` (nuovo)
- `supabase/functions/_shared/journalistReviewLayer.ts` (esteso step 5)
- `supabase/functions/_shared/journalistTypes.ts` (campi opzionali brand_voice_*)
- migration: `brand_voice_audits` + RLS

## Rinforzi Fase 2 (2026-05-07)
- KB aggiunte: `brand-voice/context` (frequenza per fase del funnel × canale) e `brand-voice/journalists/goals` (obiettivo + KPI per ogni ruolo editoriale).
- `app_settings`: `journalist_<role>_goal` per ognuno dei 4 ruoli; `brand_voice_secondary_language` e `brand_voice_regional_preferences` come default operatore.
- `operative_prompts.superseded_by` (FK self) → versioning esplicito per rollback/audit.
- `brand_voice_audits.outreach_message_id` → correlazione con outcome commerciali.
- `v_brand_voice_outcomes` (security_invoker) → KPI dashboard 30gg per canale × ruolo.

## Fasi 5-6 (2026-05-07)
**Fase 5 — Template enrichment**
- `email_templates.voice_example_for text[]` (nullable, default '{}') + indice GIN.
- `funnemail_autoresponder_templates.voice_example_for text[]` + indice GIN.
- Permette di marcare un template come esempio canonico di una regola brand-voice (es. `brand-voice/channel-deltas/email`). Reversibile via DROP COLUMN.

**Fase 6 — KPI dashboard `/v2/settings/brand-voice` (admin-only)**
- `src/data/brandVoice.ts` (DAL): `fetchBrandVoiceOutcomes`, `fetchRecentBrandVoiceAudits`, `topDeviations`.
- `src/v2/ui/pages/BrandVoicePage.tsx`: KPI summary (audit totali, score medio, deviazioni distinte) + tabella canale × ruolo + top 10 deviazioni ricorrenti. Sola lettura.
- Query keys centralizzati in `aiAndAnalyticsKeys.brandVoice.*`.
- Route lazy in `src/v2/routes.tsx`. Nessuna modifica a journalistReview, scorer, edge AI.
