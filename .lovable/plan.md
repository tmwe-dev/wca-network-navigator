

# LOVABLE-80 v2 — Giornalisti AI: Caporedattore Finale

## Cosa costruiamo

Uno **strato editoriale finale** che rivede ogni testo prodotto dall'AI (email, WhatsApp, LinkedIn, voce) prima che esca. Funziona come un caporedattore: legge tutto il contesto (brief, stato, history, KB), corregge stile/tono/ritmo, segnala incoerenze, blocca contenuti pericolosi — **ma non tocca mai la strategia commerciale**.

I 4 giornalisti si auto-selezionano in base allo stato del lead:
- **Rompighiaccio** → `new`, `first_touch_sent`
- **Risvegliatore** → `holding`, `archived`
- **Chiusore** → `qualified`, `negotiation`
- **Accompagnatore** → `converted`
- **engaged** → contestuale (risposta recente → Accompagnatore, silenzio → Risvegliatore)
- **blacklisted** → blocco totale

## Architettura

```text
Oracolo (decide brief/stato/canale)
   ↓
Genera (prima bozza)
   ↓
Migliora (polish AI esistente)
   ↓
GIORNALISTA (review + correzione editoriale + safety)
   ↓
Output finale (UI / invio / TTS)
```

Verdetti possibili: `pass` | `pass_with_edits` | `warn` | `block`

## Fasi di implementazione

### Fase 1 — Backend shared (tipi + selettore + review layer)
Tre nuovi file in `supabase/functions/_shared/`:
- `journalistTypes.ts` — interfacce `JournalistReviewInput/Output`, `JournalistConfig`, `JournalistWarning`, `JournalistEdit`, ruoli, verdetti
- `journalistSelector.ts` — `selectJournalist()` (mapping stato→ruolo + logica contestuale per `engaged`), `validateOverride()`, `loadJournalistConfig()` (carica da `app_settings` con fallback ai default), `getDefaultConfig()` con i 4 prompt/tono/regole/donts/KB sources
- `journalistReviewLayer.ts` — `journalistReview()` orchestrator: select → load config → build prompt (system+user) → invoke LLM → parse JSON → return output. Fallback safe: se LLM fallisce, draft originale passa con `quality_score: -1`

### Fase 2 — Integrazione nei 3 entry-point AI
Aggancio post-generazione (prima del `return`):
- `supabase/functions/generate-email/index.ts` → channel `"email"`
- `supabase/functions/improve-email/index.ts` → channel `"email"`
- `supabase/functions/agent-execute/toolHandlers.ts` → handler `send_email` (channel `"email"`) e `send_whatsapp` (channel `"whatsapp"`); su `verdict === "block"` NON inviare e ritornare errore strutturato all'agente; su `warn` inviare ma loggare

Tutti leggono `app_settings.journalist_optimus_enabled/_mode/_strictness` per attivazione e parametri.

### Fase 3 — UI risultato (badge + dettagli + banner)
In `src/v2/ui/pages/email-forge/ResultPanel.tsx` (e dove serve):
- **Badge compatto**: verdetto colorato (OK/CORRETTO/ATTENZIONE/BLOCCATO) + nome giornalista + quality score + reasoning breve + counter warnings
- **Popover dettagli espandibile**: lista warnings (con `upstream_fix` evidenziato) e edits (diff originale→corretto + reason)
- **Banner sopra il testo**: giallo per `warn`, rosso per `block`, con istruzione di correggere a monte
- Tipi TS aggiornati in `src/v2/hooks/useEmailForge.ts` (`ForgeResult.journalist_review`)

### Fase 4 — Configurazione nel Prompt Lab
Nuovo tab dedicato `JournalistsTab.tsx` in `src/v2/ui/pages/prompt-lab/tabs/`:
- Header con toggle Optimus on/off, dropdown modalità (`review_and_correct` / `review_only` / `silent_audit`), slider rigore 1-10
- Box informativo "FA / NON FA" per chiarire i confini
- 4 card giornalisti (Rompighiaccio/Risvegliatore/Chiusore/Accompagnatore) con: icona, descrizione, badge stati associati, dettagli espandibili con 5 campi editabili (`prompt`, `tone`, `rules`, `donts`, `kb_sources`) salvati in `app_settings` con chiavi `journalist_<role>_<field>`
- Callout viola per la logica contestuale di `engaged`
- Registrazione del tab in `PromptLabPage.tsx`

### Fase 5 — Memoria progetto
Salvataggio memoria `mem://agents/journalist-review-layer` con: filosofia one-way, mapping stati→giornalisti, regole inviolabili (mai cambiare strategia/stato/canale/playbook), verdetti, modalità Optimus.

## Dettagli tecnici chiave

- **One-way strict**: il giornalista può modificare SOLO la forma del testo. Mai cambia stato, canale, playbook, brief. Su contraddizioni strutturali emette `warn` con `upstream_fix`, non risolve silenziosamente.
- **Safety editoriale**: blocca urgenza finta, adulazione, promesse non verificabili nella KB, salti di fase relazionale.
- **Voice channel** (`voice_script`): regole specifiche → frasi brevi, ritmo parlato, una domanda alla volta, zero tecnicismi, pensato per TTS ElevenLabs.
- **Fallback resiliente**: errore LLM o parse JSON → draft originale passa intatto con `quality_score: -1`. Mai blocca per problema tecnico.
- **Override manuale** permesso ma se molto incoerente (es. Rompighiaccio su `converted`) genera warning visibile.
- **Settings persistite** in `app_settings` per utente, con fallback ai default codificati. Nessuna nuova tabella richiesta.
- **LLM invoke** via edge function `ai-assistant` esistente (mode conversational, scope chat) — nessuna nuova chiave API.
- **Audit**: i warning bloccanti vengono loggati (in agent-execute) per supervisione.

## File toccati

**Nuovi (4):**
- `supabase/functions/_shared/journalistTypes.ts`
- `supabase/functions/_shared/journalistSelector.ts`
- `supabase/functions/_shared/journalistReviewLayer.ts`
- `src/v2/ui/pages/prompt-lab/tabs/JournalistsTab.tsx`

**Modificati (~6):**
- `supabase/functions/generate-email/index.ts`
- `supabase/functions/improve-email/index.ts`
- `supabase/functions/agent-execute/toolHandlers.ts`
- `src/v2/hooks/useEmailForge.ts` (tipi)
- `src/v2/ui/pages/email-forge/ResultPanel.tsx` (badge + banner)
- `src/v2/ui/pages/PromptLabPage.tsx` (registrazione tab)

**Memoria:** `mem://agents/journalist-review-layer` + aggiornamento `mem://index.md`

