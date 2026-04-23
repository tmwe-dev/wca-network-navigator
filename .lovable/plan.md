

# Esecuzione approvata — Agent Atlas + Lab Agent Architect

Procedo con le 5 fasi nell'ordine concordato, integrando i tuoi 3 punti.

## Fase 1 — Registry esteso
Estendo `src/data/agentPrompts.ts` aggiungendo gli agenti mancanti (`optimus`, `journalists`, `generate-email`, `generate-outreach`, `mission-executor`, `voice-elevenlabs`, `agent-execute`, `classify-inbound-message`, `reply-classifier`) e per tutti i campi nuovi: `category`, `runtime { edgeFunction, modelDefault, triggers[] }`, `inputContract`, `outputContract`, `avatarIcon`, `avatarColor`, `promptSources[]` (mappa esplicita ai BlockSource del Prompt Lab).

## Fase 2 — Pagina Atlas read-only
Nuova route `/v2/prompt-lab/atlas`. Layout: sidebar agenti a sinistra, avatar card + colonne Prompt / KB / Tools / Contract a destra. Pulsante "Apri nell'editor" su ogni blocco verso le tab Prompt Lab esistenti. Zero scritture.

## Fase 3 — Contesto per agente unificato
- `useGlobalPromptImprover` raggruppa **da subito** per agente (non più per tab) usando il registry come pivot.
- Nuovo `improveBlockForAgent(agentId, blockId)` in `useLabAgent`.
- Output Lab Agent forzato a schema strutturato: `SEVERITY` · `WHY` · `DESTINATION (keep|move-to-kb|move-to-code|move-to-contract|duplicate)` · `PROPOSAL` · `TEST_SCENARIOS[]`. Parsing tollerante con fallback.
- `promptRubrics.ts` aggiornato.

## Fase 4 — KB Architect isolata
- Migration: nuova categoria `lab_architect_procedure` (NON in `DOCTRINE_CATEGORIES`, quindi assembler produzione non la caricano mai).
- Insert voce KB con la procedura passo-passo del documento Architect.
- Mirror `public/kb-source/lab-agent-architect.md`.
- `useLabAgent` riceve `mode: 'standard' | 'architect'` (default `standard` = invariato). Solo in `architect` la KB viene caricata esplicitamente e prepended al system prompt del Lab Agent.

## Fase 5 — Contratti backend
In Architect mode il Lab Agent riceve `inputContract`/`outputContract` dal registry e può proporre `DESTINATION: move-to-contract` con firma del nuovo contratto (es. `EmailBrief`, `VoiceBrief`).

## Garanzie
- Zero modifiche a edge function di produzione.
- Solo additive sullo schema DB (categoria KB nuova).
- Comportamento default Lab Agent invariato.
- Tab Prompt Lab esistenti restano gli editor canonici.

## Debito noto
Registry manuale in v1. Aggiungo commento in testa + test che fallisce se trova directory in `supabase/functions/` non mappata nel registry.

