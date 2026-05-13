# Fix Prompt Lab Tests: identità azienda, KB, lingua + UI leggibile

## Problema rilevato in lab
1. L'AI nei test non sa chi è: manca `Transport Management Srl` / `TMWE` / `Luigi Tagliaferri`.
2. L'AI non rispetta la lingua richiesta (frasi generiche in IT anche con prompt EN/DE).
3. Manca iniezione `kb_entries` (168 entry di doctrine).
4. Output dei test illeggibile (mono `<pre>` dentro `<details>` con `max-h-48`).

Causa root: `prompt-test-runner/index.ts` costruisce il system prompt **senza caricare** `app_settings` né `kb_entries`, a differenza di `generate-email`/`generate-outreach`.

## Cosa cambia

### 1. Backend — `supabase/functions/prompt-test-runner/index.ts`
- `loadSenderIdentity(supabase)` → SELECT `app_settings` (singleton) campi: `ai_company_name`, `ai_company_alias`, `ai_contact_name`, `ai_contact_role`, `ai_contact_phone`, `ai_signature`, `ai_language`, `ai_style_instructions`, `ai_sector_focus`, `ai_business_goals`, `ai_network_context`, `ai_knowledge_base`.
- `loadDoctrineSnippets(supabase, { maxChars: 6000 })` → SELECT `kb_entries` priority desc, cap caratteri.
- Estensione `buildPromptText()` con sezioni in ordine fisso:
  - `## Identità mittente` (azienda/alias/contatto/ruolo/firma/telefono/settore/network/business goals)
  - `## Lingua di output` (priorità: `payload.language` > `identity.ai_language` > `italiano`) con istruzione esplicita "Rispondi SEMPRE in {lingua}"
  - `## Stile e tono` (`ai_style_instructions`)
  - `## Conoscenza di dominio` (KB azienda + estratto `kb_entries`)
  - poi prompt operativo + input test
- Telemetria nel record `prompt_test_runs`: `identity_loaded: boolean`, `kb_snippets_count: number`, `language_used: string` (extra in `metadata` JSONB se non c'è colonna dedicata — nessuna migrazione).
- Nessuna modifica a `generate-email`/`generate-outreach`.

### 2. UI — `src/v2/ui/pages/prompt-lab/tabs/PromptTestsTab.tsx`
- Output sempre visibile (no `<details>` collassato di default per il messaggio AI).
- Tipografia: `text-sm leading-relaxed whitespace-pre-wrap` per testo, mono solo per JSON.
- Header riga risultato con badge: stato (passed/failed), severità, modello, durata ms, token, lingua usata.
- Blocco "Identità iniettata" read-only (azienda, alias, contatto, lingua).
- Sezione collassabile "Prompt costruito" (full system prompt).
- Sezione "Check eseguiti" con ✅/❌ per assertion.
- Nessuna nuova logica di business: solo formattazione e ricomposizione layout.

### 3. Verifica
- Run manuale di un test esistente: l'output deve contenere `TMWE` o `Transport Management` e firma `Luigi Tagliaferri`.
- Test con `language: "english"` nel payload: output in inglese.
- Nuovo test case di regressione (assertion: contains `Transport Management` + lingua corretta).

## File toccati
- `supabase/functions/prompt-test-runner/index.ts` (backend)
- `src/v2/ui/pages/prompt-lab/tabs/PromptTestsTab.tsx` (UI)

## Fuori scope
- Migrazioni DB
- Modifiche a `generate-email`, `generate-outreach`, `agent-execute`
- Cambio schema `prompt_test_runs` (uso `metadata` JSONB esistente)
- Refactor del Prompt Lab oltre il tab Tests
