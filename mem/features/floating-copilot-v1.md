---
name: Floating Co-Pilot v1
description: Bolla vocale persistente su tutte le route V2 (esclusa /v2/command). Naviga, applica filtri, apre modali, evidenzia elementi e chiede conferma per azioni distruttive. KB di navigazione editabile via tabella ui_navigation_map.
type: feature
---

## Architettura
- Singleton `FloatingCoPilot` montato in `AuthenticatedLayout` dentro `CoPilotProvider`.
- Bolla draggable (posizione persistita in `localStorage` key `copilot.position`).
- Toggle on/off persistito in `copilot.enabled`.
- Hook voce DEDICATO `useFloatingCoPilotVoice` — NON tocca `useCommandRealtimeVoice`.
- Riusa edge function esistenti `elevenlabs-conversation-token` e `command-ask-brain`.

## Vincoli (NON VIOLARE)
- NON modificare `src/v2/ui/pages/command/**` né `useCommandRealtimeVoice.ts`.
- Auto-nascosto su: `/auth`, `/v2/login`, `/v2/reset-password`, `/v2/onboarding`, `/v2/command`.

## Client tools voce (registrare anche su ElevenLabs Agent)
- `ask_brain({ question })` — riuso edge function command-ask-brain
- `navigate_to({ intent_key? | query? | path? })` — risolve via `ui_navigation_map`
- `apply_filter({ scope, filters })` — emette `ai-ui-action: apply_filters`
- `open_modal({ name, params })` — emette `ai-ui-action: open_modal`, le pagine registrano handler con `useCoPilotRegisterModal`
- `highlight_element({ selector?|text?, hint?, duration_ms? })` — alone pulsante via `HighlightOverlay`
- `request_confirmation({ action_label })` — dialog modale, attende OK/cancel, timeout 60s

## KB di navigazione (`ui_navigation_map`)
- Tabella DB: intent_key, label, description, examples[], path, default_filters, modal, category, requires_confirmation, enabled
- RLS: tutti gli auth leggono, solo admin scrive
- Match: `findIntentByKey` (esatto) + `matchIntentLocally` (fuzzy su label/description/examples)
- Seed iniziale ~30 intent (Network per paese, BCA, CRM, Outreach, Pipeline, Prompt Lab, Email Intelligence, Staff, Sherlock, Agents, Settings)

## Event bus (`ai-ui-action`)
Tipi gestiti dal listener globale in AuthenticatedLayout:
- `navigate` → useNavigate
- `apply_filters` → ai-command bridge
- `open_modal` → bridge `copilot-open-modal` → CoPilotContext modal registry
- `highlight` → FloatingCoPilot mostra HighlightOverlay
- `show_toast`, `start_download_job` (preesistenti)

## Eventi interni Co-Pilot
- `copilot-confirm` ({id, label}) → mostra dialog
- `copilot-confirm-result` ({id, result: "ok"|"cancel"}) → sblocca promise
- `copilot-open-modal` ({name, params}) → cerca handler registrato

## File chiave
- `src/v2/ui/copilot/FloatingCoPilot.tsx` (UI)
- `src/v2/ui/copilot/CoPilotContext.tsx` (provider + registry modali/filtri)
- `src/v2/ui/copilot/HighlightOverlay.tsx`
- `src/v2/ui/copilot/useFloatingCoPilotVoice.ts` (voce + client tools)
- `src/data/uiNavigationMap.ts` (DAL)
- Migration: tabella `ui_navigation_map`
- Doc agent: `docs/PROMPT_11LABS_FLOATING_COPILOT.md`

## TODO non fatti in v1
- Tab "Navigation Map" in Prompt Lab per CRUD UI (per ora editabile via SQL/admin)
- Edge function `resolve-ui-intent` con embedding match (per ora match euristico locale)
- Toggle on/off da Topbar (per ora solo dal pannello espanso, click su bottone Power)