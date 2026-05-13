## Obiettivo
Tre giri di audit (dati → prompt → canale/output) con test virtuali su ogni nodo della pipeline email, per chiudere i buchi che oggi fanno produrre email senza identità TMWE, senza KB e in lingua sbagliata.

## Risultati già emersi dall'esplorazione (anteprima)

I nodi critici sono allineati così:

```
UI hook (useEmailGenerator / useOutreachGenerator)
   → generate-content (router)
      → generate-email | generate-outreach | improve-email
         ├── contextAssembler (app_settings, kb_entries, deep_search, history)
         ├── operativePromptsLoader (Prompt Lab)
         ├── calligrafiaInjector (KB "calligrafia")
         ├── promptBuilder → aiChat (LLM)
         └── journalistReviewLayer (revisione obbligatoria)
   → prompt-test-runner (Prompt Lab → test di regressione)
```

DB:
- `app_settings`: 4 user_id distinti, l'identità TMWE (Transport Management Srl, Luigi Tagliaferri, lingua "inglese", KB aziendale ricca) vive SOLO sotto `user_id = c8aadbed-1f47-4c74-90dd-dccf44b87a16`.
- `kb_entries`: 47 entry user A, 109 entry user B, 58 entry "system" (`user_id IS NULL`). L'utente TMWE ha 0 entry proprie e si appoggia al pool system.
- `operative_prompts`: 136 attive ma SEMPRE con `user_id` valorizzato; nessuna riga "system".

## Difetti già confermati (no fix in questo plan, vengono validati e poi sistemati durante l'esecuzione)

1. **Silos per `user_id`**:
   - `prompt-test-runner` (`loadDoctrineSnippets`) filtra `kb_entries` con `eq("user_id", userId)` → ignora le 58 righe system. `generate-email` invece usa `or(user_id.eq.X, user_id.is.null)`. Asimmetria → la lab "non vede" la KB.
   - `loadSenderIdentity` carica `app_settings` solo dell'utente chiamante. Se chi lancia il test non è l'owner TMWE, identità vuota → "non sa chi siamo".
   - `operativePromptsLoader` filtra `eq("user_id", userId)` senza fallback a prompt system → utenti senza Prompt Lab non ricevono nulla.

2. **Lingua**:
   - `generate-email`/`generate-outreach`: `effectiveLanguage = language || detected.language` (da `country_code`). `settings.ai_language` (es. "inglese") NON è fallback. Se la UI non passa `language`, vince il country detector → output in lingua sbagliata.
   - `prompt-test-runner` invece rispetta `payload > identity > italiano`. Comportamento divergente fra produzione e lab.

3. **KB/operative_prompts non condivisi**:
   - Manca un meccanismo "org-wide". Tutto è per-utente. La doctrine TMWE (KB e Prompt Lab) andrebbe replicata o resa condivisa via `user_id IS NULL` + RLS.

4. **Journalist review**:
   - `journalistReviewLayer` è obbligatorio in `generate-email`, ma va verificato che riceva `language` e che blocchi output fuori lingua.

5. **Deep search**:
   - `assembleContextBlocks` carica enrichment/deep search solo se `deep_search` viene passato dalla UI; il test runner non lo invoca affatto. Sherlock e WCA risultano "skipped" nei test.

## Piano in 3 giri

### Giro 1 — Audit dei dati e degli accessi (lettura)

Per ciascun nodo, query mirate (no modifiche) per fotografare lo stato:

- `app_settings` per i 4 user_id: completezza dei 16 campi `ai_*` chiave (company, contact, role, signature, language, KB).
- `kb_entries`: distribuzione per `user_id` × `category` × `is_active`; quante entry "system" davvero arrivano nei loader di prod e di lab.
- `operative_prompts`: per ogni `user_id`, quanti prompt per scope (`email`, `email-quality`, `outreach`, `whatsapp`, `linkedin`, `general`) e quanti `OBBLIGATORIA`.
- `prompt_test_cases`: a quale `prompt_id` puntano e a quale `user_id` corrisponde quel prompt → mappare il "delta TMWE".

Output del giro 1: tabella in `docs/audit/email-pipeline-3pass-2026-05-13.md` con righe rosse/gialle/verdi per ogni nodo.

### Giro 2 — Audit dei prompt (assembly statico)

Per ogni edge function della pipeline (`generate-email`, `generate-outreach`, `improve-email`, `prompt-test-runner`, `journalistReviewLayer`):

- Estrarre il `system prompt` finale che VERREBBE costruito per il `user_id` TMWE e per un user_id "vuoto", senza chiamare l'LLM (dry run via codice condiviso).
- Verificare presenza di:
  - identità mittente (company_name, contact_name, role, signature),
  - blocco KB doctrine,
  - blocco Prompt Lab (operative_prompts),
  - blocco calligrafia,
  - vincolo di lingua,
  - editorial review pre-flight.
- Confrontare prompt-test-runner vs generate-email: i due devono produrre lo stesso "starter" (identità + lingua + KB + Prompt Lab) altrimenti il lab mente.

Output del giro 2: diff strutturato dei system prompt + lista delle sezioni mancanti per nodo.

### Giro 3 — Test end-to-end live (con AI)

Esecuzione reale via `supabase--curl_edge_functions` come utente loggato (TMWE) e come utente "vuoto" per dimostrare il delta:

| # | Funzione | Scenario | Cosa verifico |
|---|---|---|---|
| T1 | `prompt-test-runner` | prompt "Scrittore commerciale da bestseller" TMWE | Identità "Transport Management Srl"/"Luigi" presente nell'output, lingua = `inglese` |
| T2 | `prompt-test-runner` | stesso prompt, payload `language: "italiano"` | Override rispettato |
| T3 | `generate-content` action `outreach` | `country_code=DE`, no `language` | Lingua attesa: tedesco. Verifico che NON sovrascriva `ai_language` se l'identità lo richiede esplicitamente (potenziale bug da decidere) |
| T4 | `generate-content` action `email` | partner reale TMWE, `quality=premium` | KB sezioni > 0, `operativePromptsApplied` ≥ 1, signature presente, journalist `pass`/`pass_with_edits` |
| T5 | `generate-content` action `email` | partner senza contatto | atteso 422 `no_contact` |
| T6 | `generate-content` action `outreach` | canale `whatsapp` lead cold | atteso blocco da WhatsApp Message Gate (gate hard) |
| T7 | `generate-content` action `outreach` | canale `linkedin` | output ≤ 5 frasi, niente "book a meeting" |
| T8 | `improve-email` | bozza con superlativi vuoti | Quality Gate la corregge / blocca |
| T9 | `generate-content` action `email` | utente "vuoto" (no app_settings, no KB) | DEVE fallire o segnalare warning espliciti, NON inventare identità |

I prompt costruiti, le sezioni KB usate, i nomi dei Prompt Lab applicati, la lingua finale e l'esito journalist vengono salvati come artifact in `/mnt/documents/email-audit-2026-05-13/` (un file per test).

## Fix che propongo a valle dell'audit (verranno proposti separatamente, non eseguiti qui)

1. Allineare `prompt-test-runner.loadDoctrineSnippets` al pattern `or(user_id.eq.X, user_id.is.null)` di `kbAssembler` per leggere anche la doctrine system.
2. In `operativePromptsLoader`, aggiungere fallback `user_id IS NULL` e/o copia org-wide (preservando la priorità per-user).
3. In `generate-email`/`generate-outreach`, ordine lingua: `payload.language` > `settings.ai_language` > `getLanguageHint(country_code)` > `italiano`. Coerente con la lab.
4. In `journalistReviewLayer`, hard-check sulla lingua dell'output rispetto alla lingua dichiarata; se diverge → `block` con motivo.
5. Pubblicare la doctrine TMWE come `kb_entries` con `user_id = NULL` (system) o creare una tabella `org_settings` cross-utente, così ogni operatore TMWE eredita l'identità unica.
6. Nel `_debug` di outreach/email aggiungere `identity_loaded`, `kb_user_scope`, `operative_prompts_user_scope`, `language_source` per rendere visibile il bug in console invece di scoprirlo a valle.
7. Esporre nel Prompt Lab UI il "delta tra utenti": quante entry KB / prompt operativi ho rispetto all'owner TMWE.

## File coinvolti (solo lettura nel piano, modifica eventualmente in fase fix)

- `supabase/functions/_shared/operativePromptsLoader.ts`
- `supabase/functions/_shared/journalistReviewLayer.ts`
- `supabase/functions/generate-email/{index,contextAssembler,kbAndPlaybookAssembler,kbAssembler,promptBuilder}.ts`
- `supabase/functions/generate-outreach/index.ts`
- `supabase/functions/improve-email/index.ts`
- `supabase/functions/prompt-test-runner/index.ts`
- `src/hooks/useEmailGenerator.ts`, `src/hooks/useOutreachGenerator.ts`

## Deliverable

- `docs/audit/email-pipeline-3pass-2026-05-13.md`: tabella dei 3 giri con verde/giallo/rosso per nodo.
- `/mnt/documents/email-audit-2026-05-13/T*.json` e `.md`: prompt costruiti + risposte AI + esito journalist per i 9 test.
- Lista ordinata di fix con rischio/impatto, pronta per essere approvata e implementata in un secondo round.

## Fuori scope

- Modifiche a `check-inbox`, `email-imap-proxy`, `mark-imap-seen` (vincolo memoria).
- Riscrittura del journalist o cambi di schema DB: solo proposta, non esecuzione.
- Tutto ciò che non è nel flusso "produzione email" (campagne, IMAP sync, agenti vocali).
