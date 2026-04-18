

Verifico lo stato attuale dei file menzionati nei 5 fix prima di confermare il piano.
<lov-tool-use id="toolu_vrtx_016oDyDQDpSyhhQoRuLn4GZb" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/agent-execute/toolHandlers.ts\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JP3CnTSmSCH7cic9wARJpp" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/agent-execute\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_013qhpHLDgWMqpei8XmhH3i3" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useTrackActivity.ts\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01JMUAx3N1vvj6nNeiQUiGri" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"src/constants\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01LzV4yqnkpqpXcUCUkzt2Jn" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/daily-briefing\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WXiNWr2rJgFXDvydeNWjTH" name="code--search_files" integration-id="code" data="{\"query\": \"\\\"contacted\\\".*\\\"in_progress\\\"\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Azzw5WdgsurVR3M7y9JkVB" name="code--search_files" integration-id="code" data="{\"query\": \"agent_require_approval|SIDE_EFFECT_TOOLS\", \"search_dir\": \"supabase/functions/agent-execute\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_019TAFAq1Kb3sXsdsHzW9KTJ" name="code--search_files" integration-id="code" data="{\"query\": \"get_holding_pattern|holdingStatuses\", \"search_dir\": \"supabase/functions/agent-execute\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01RgmvtANFVDkdXSaWpfNEUZ" name="code--search_files" integration-id="code" data="{\"query\": \"lead_status.*contacted|in_progress|negotiation\", \"search_dir\": \"supabase/functions/daily-briefing\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Jbarc2TZSLmqB29iKqQpCq" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/agent-execute/toolHandlers.ts\", \"lines\": \"320-410\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01BWeXMz9jqzyRm48xtG2hvQ" name="code--search_files" integration-id="code" data="{\"query\": \"\\\"holding_pattern\\\"\", \"search_dir\": \"src\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01D81Vkn8EgqqTzMnS3wpAE2" name="code--view" integration-id="code" data="{\"file_path\": \"src/hooks/useHoldingPattern.ts\"}">
</lov-tool-use>
Note importante: `useEmailContactPicker` filtra su `lead_status !== "holding_pattern"` ma "holding_pattern" NON è uno stato valido nello schema. Quel filtro è morto/sbagliato — va corretto a usare `isInHoldingPattern()`. Ho abbastanza contesto.

<lov-plan>

## Fase 2 — Governance & Holding Pattern

### Stato verificato
- **Fix 2.1**: `send_email` ha già hard guard (linee 337-376 in `agent-execute/toolHandlers.ts`). Manca per `send_whatsapp`, `send_linkedin`, `queue_channel_message`, `update_partner`, `create_task`, `schedule_followup`. Da centralizzare prima dello switch.
- **Fix 2.2**: `useHoldingPattern.ts` ha già `["contacted","in_progress","negotiation"]`. Ma `_shared/platformTools.ts:455` usa solo `["contacted","in_progress"]`. E `useEmailContactPicker.ts:148,158,180` filtra su `lead_status !== "holding_pattern"` (stato inesistente — bug morto da correggere).
- **Fix 2.3**: `agent-execute/toolHandlers.ts:820` usa `["contacted","in_progress"]` — manca `negotiation`.
- **Fix 2.4**: `useTrackActivity.ts:49,60,70` aggiorna sempre a `contacted` senza guard (commento mente: dice "only if new" ma il codice non controlla).
- **Fix 2.5**: `daily-briefing/index.ts:53-54` filtra solo su `contacted`.

### Modifiche

| # | File | Modifica |
|---|------|----------|
| 2.0 | `src/constants/holdingPattern.ts` (nuovo) | Esporta `HOLDING_STATUSES`, `ALL_LEAD_STATUSES`, `isInHoldingPattern()`, `ACTIVE_ENGAGEMENT_STATUSES` |
| 2.1 | `supabase/functions/agent-execute/toolHandlers.ts` | Aggiungo `SIDE_EFFECT_TOOLS` set + guard centralizzato prima dello switch. Rimuovo guard duplicato in `send_email`. Coda `ai_pending_actions` con `action_type=toolName` |
| 2.2a | `src/hooks/useHoldingPattern.ts` | Importa `HOLDING_STATUSES` (rimuove costante locale) |
| 2.2b | `src/hooks/useEmailContactPicker.ts` | Sostituisce `c.lead_status !== "holding_pattern"` con `!isInHoldingPattern(c.lead_status)` (3 occorrenze) |
| 2.2c | `supabase/functions/_shared/platformTools.ts:455` | `["contacted","in_progress"]` → include `negotiation` |
| 2.3 | `supabase/functions/agent-execute/toolHandlers.ts:820` | `activeStatuses` include `negotiation` |
| 2.4 | `src/hooks/useTrackActivity.ts` | Pre-fetch `lead_status` corrente; aggiorna a `contacted` solo se `new`/null; altrimenti aggiorna solo `last_interaction_at`. Stesso per `imported_contact` e `business_card` |
| 2.5 | `supabase/functions/daily-briefing/index.ts:53-54` | `.eq("lead_status","contacted")` → `.in("lead_status", HOLDING_STATUSES)` (inline, edge function non può importare da `src/`) |

### Ordine
2.0 → 2.2 (consumer client) → 2.4 → 2.1 → 2.3 → 2.2c → 2.5

### Deploy
Edge functions: `agent-execute`, `daily-briefing`. (`platformTools.ts` è importato da `ai-assistant` → redeploy anche quello)

### Verifica
- `grep -r '"contacted", "in_progress"]' src/` → 0 match (eccetto holdingPattern.ts e file enum tassonomia tipo `kb-supervisor`, `toolDefinitions`)
- `grep "holding_pattern"` → 0 match in hooks
- TS build verde
- Test manuale: partner in `negotiation` + track activity → resta `negotiation`, solo `last_interaction_at` aggiornato

### Fuori scope
- Refactor di `kb-supervisor` e `toolDefinitions.ts` (lì le liste sono tassonomia enum completa, non filtri holding — corretto come sono)
- Migrazione DB su tassonomia stati
- Test E2E automatizzati

