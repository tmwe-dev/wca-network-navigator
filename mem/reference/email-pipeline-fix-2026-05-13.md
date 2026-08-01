---
name: Email Pipeline Fix 2026-05-13
description: Chiuso 5 buchi audit "AI non sa chi siamo / non rispetta lingua / KB vuota". Identity org-wide, KB system fallback, language priority, journalist language gate.
type: reference
---
Fix applicati 2026-05-13 (codex CRITICAL):

1. **prompt-test-runner / generate-email/dataLoader / generate-outreach/contextAssembler**: rimosso `.eq("user_id", userId)` dal load di `app_settings` chiavi `ai_%`. Vincolo UNIQUE globale su `app_settings.key` → ogni chiave esiste in 1 sola riga; il filtro nascondeva l'identità TMWE agli altri operatori.

2. **prompt-test-runner.loadDoctrineSnippets**: `kb_entries` ora carica `or(user_id.eq.${userId},user_id.is.null)` → include 58 entry system. Allineato a generate-email.

3. **_shared/operativePromptsLoader**: stesso fallback su `operative_prompts`. Prompt Lab ora accessibile anche a utenti senza prompt personali.

4. **generate-email/promptBuilder + generate-outreach/{index,promptBuilder}**: priorità lingua corretta = `payload.language || settings.ai_language || getLanguageHint(country) || "italiano"`. Prima `settings.ai_language` veniva ignorato.

5. **journalistTypes + journalistReviewLayer**: aggiunto `language?: string` opzionale in `JournalistReviewInput` + warning type `language_mismatch`. Se presente, il caporedattore blocca testi in lingua diversa. Backward compatible per tutti i caller esistenti. `generate-email/index.ts` passa la lingua al journalist.

Verifica E2E: `curl prompt-test-runner` con cron-secret → metadata mostra `identity_loaded:true`, `identity_company:"Transport Management Srl"`, `identity_company_alias:"TMWE"`, `language_used:"inglese"`, `kb_snippets_count:3`.

NON modificati: send-email, journalist core logic (intoccabile), check-inbox, RLS.
