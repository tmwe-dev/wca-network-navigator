

## Fase 4 — Skin & Brain alignment

### Stato verificato
- **Fix 4.1**: ✅ già fatto. `scopeConfigs.ts` ha già case per `deep-search`, `chat`, `mission-builder`. `unified-assistant` li include in `VALID_SCOPES`. Skip totale.
- **Fix 4.2**: composer V2 chiama ancora `ai-assistant` direttamente con `context: "email_composer"` (string). Da migrare a `unified-assistant` con `scope: "extension"`.
- **Fix 4.3**: il prompt originale era basato su uno schema sbagliato (`services_offered`, `notes` NON esistono nella tabella `partners`). Lo snippet attuale usa colonne valide. Arricchimento opportuno con `email`, `phone`, `last_interaction_at`, `interaction_count` (esistono, aggiungono contesto utile per il vocale).
- **Fix 4.4**: `voice-brain-bridge` costruisce un mega-prompt monolitico chiamando `aiChat` direttamente. Da refattorizzare per delegare a `unified-assistant` (scope `extension`, mode `conversational`), preservando il contratto JSON `say/actions/next_state/end_call/transfer_to_human/memory_to_save` via post-processing.

### Modifiche

| # | File | Modifica |
|---|------|----------|
| 4.2 | `src/v2/hooks/useEmailComposerV2.ts` | Sostituisco `invokeEdge("ai-assistant", { body: { messages, context: "email_composer", use_kb }})` → `invokeEdge("unified-assistant", { body: { messages, scope: "extension", context: { source: "email_composer", use_kb }}})`. Mantengo lettura `data?.response \|\| data?.content` |
| 4.3 | `supabase/functions/voice-brain-bridge/index.ts` | `loadPartnerSnippet` arricchito: aggiungo select su `email, phone, last_interaction_at, interaction_count`. Aggiungo righe nello snippet output. Niente `services_offered`/`notes` (colonne inesistenti) |
| 4.4 | `supabase/functions/voice-brain-bridge/index.ts` | Refactor del blocco `aiChat` (linee 311-348): chiamo internamente `unified-assistant` via fetch con `scope: "extension"`, `mode: "conversational"`, `context: { source: "voice", partner_id, partner_snippet, voice_context, voice_contract }`. Estraggo il `content` dalla risposta e applico `safeJsonParse` + `makeSafeReply`. Mantengo il logging `ai_request_log` con `routed_to: "voice-brain-bridge→unified-assistant"`. Preservo timeout di 12s. Fallback a chiamata diretta `aiChat` se `unified-assistant` fallisce con 5xx (resilienza) |

### Ordine
4.2 (autocontenuto frontend) → 4.3 (estensione select) → 4.4 (refactor proxy)

### Deploy
Edge function: `voice-brain-bridge`. Frontend useEmailComposerV2 = solo build.

### Verifica
- Composer V2 → Network tab mostra POST a `/functions/v1/unified-assistant` con `scope: "extension"`
- `voice-brain-bridge` log: `routed_to` mostra il proxy
- `loadPartnerSnippet` per partner reale → snippet contiene email/phone/interaction_count
- Test integrazione esistenti `voice-brain-bridge` (`index_test.ts`, `index.integration.test.ts`) restano verdi

### Fuori scope
- Migrazione altri hook V2 verso unified-assistant (già OK)
- Cambio modello voce (resta `gemini-2.5-flash` lato unified-assistant)
- Aggiunta colonne `services_offered`/`notes` allo schema partners

