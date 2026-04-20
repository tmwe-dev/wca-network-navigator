

# Audit completo del flusso email — diagnosi + correzioni

## 1. Schema del flusso (stato attuale)

```text
┌─────────────────────────────────────────────────────────────────────┐
│  USER INPUT (OraclePanel)                                            │
│  ─ Tipo email (chip) → EmailType { id, prompt, structure, kb_cats } │
│  ─ Tono (chip)       → string                                        │
│  ─ Descrizione       → customGoal (testo libero, dettatura voice)    │
│  ─ KB toggle         → useKB (bool)                                  │
│  ─ Deep Search btn   → trigger manuale (enrich-partner-website)      │
└─────────────────────────────────────────────────────────────────────┘
              │                                   │
        GENERA│                                   │MIGLIORA
              ▼                                   ▼
   ┌──────────────────────┐         ┌─────────────────────────┐
   │  generate-content    │         │  generate-content       │
   │  action: "email"     │         │  action: "improve"      │
   │  → generate-email    │         │  → improve-email        │
   └──────────┬───────────┘         └────────────┬────────────┘
              │                                  │
              ▼                                  ▼
   ┌──────────────────────────────────────────────────────────┐
   │  contextAssembler (700 LOC): 17 blocchi paralleli         │
   │  ├─ Partner / Networks / Services / Social                │
   │  ├─ Settings mittente (alias, KB aziendale, firma, tono)  │
   │  ├─ Sales KB strategica (kb_entries, filtrata per tipo)   │
   │  ├─ Style preferences (ai_memory)                         │
   │  ├─ Edit patterns (ai_edit_patterns, per tipo+paese)      │
   │  ├─ Response insights (response_patterns)                 │
   │  ├─ Conversation Intelligence (contact_conv_context)      │
   │  ├─ Met in person (business_cards)                        │
   │  ├─ Cached enrichment + Live Deep Search inline           │
   │  ├─ Documents (workspace_documents)                       │
   │  ├─ Same-Location Guard + Branch coordination             │
   │  ├─ Commercial state (workflow + warmth + touch_count)    │
   │  └─ Active Playbook (commercial_playbooks)                │
   └──────────────────────────────────────────────────────────┘
              │
              ▼
   ┌──────────────────────────────────────────────────────────┐
   │  promptBuilder → systemPrompt + userPrompt                │
   │  ─ StrategicAdvisor block (dinamico, da context)          │
   │  ─ CommercialBlock (tono modulato per touch_count+warmth) │
   │  ─ Playbook block (priorità su KB)                        │
   │  ─ Tutti i 17 context blocks concatenati                  │
   └──────────────────────────────────────────────────────────┘
              │
              ▼
   aiChat (gemini-3-flash-preview, fallback flash/gpt-5-mini)
              │
              ▼
   parseEmailResponse → { subject, body, _context_summary }
              │
              ▼
   UI: subject + body + OracleContextPanel (trasparenza)
```

## 2. Verifica dinamicità dei prompt

| Elemento | Dinamico? | Fonte | Note |
|---|:---:|---|---|
| Tipo email (prompt + structure) | ✅ | `defaultEmailTypes.ts` (DB-extendable via `email_oracle_types`) | Hardcoded i 6 default; custom OK |
| Tono | ✅ | `oracle_tone` o `settings.ai_tone` | |
| KB strategica | ✅ | `kb_entries` filtrate per categoria/qualità | Filtri categoria parzialmente hardcoded |
| Style preferences | ✅ | `ai_memory` (apprese dagli edit) | |
| Edit patterns | ✅ | `ai_edit_patterns` per tipo+paese | |
| Response insights | ✅ | `response_patterns` | |
| Conversation context | ✅ | `contact_conversation_context` + `email_address_rules` | |
| Met in person | ✅ | `business_cards` matched | |
| Deep search | ✅ | Live trigger + cache | Trigger ora manuale |
| Commercial state / warmth | ✅ | `analyzeRelationshipHistory` | |
| Playbook attivo | ✅ | `commercial_playbooks` per workflow | |
| Strategic Advisor block | ✅ | Calcolato da context | |
| Tono per fase commerciale | ✅ | Calcolato da `touch_count` + `warmth` | |
| Lingua | ✅ | `getLanguageHint(country_code)` | |
| Truncation per qualità | ⚠️ | Hardcoded in `getProfileTruncation()` | Min: tre numeri |

## 3. Scaletta AI per produrre il risultato

1. **Selezione modello** dinamica da `quality` (`fast` → flash-lite, `standard/premium` → gemini-3-flash-preview)
2. **System prompt**: identità ("stratega B2B logistica") + Playbook (se attivo, priorità) + StrategicAdvisor (con `emailCategory`, `followUpCount`, `commercialState`, `touchCount`) + Formato output + Guardrail lingua
3. **User prompt** (in ordine): Mittente → Partner → Contatto → InterlocutorBlock → Relationship → History → Branch → MetInPerson → CachedEnrichment → Documents → Style preferences → Edit patterns → Response insights → ConversationIntel → CommercialBlock → Goal (descrizione utente concatenata al tipo) → BaseProposal
4. **AI call**: 45s timeout, retry 1, fallback su 3 modelli
5. **Parse**: estrae `Subject:` + body, allega firma
6. **Audit + credits + `_context_summary`** restituito al client

## 4. Gap residui ("hardcode" da minimizzare)

### Gap A — Tipo email selezionato non passa `kb_categories` né `structure` al backend
- `OraclePanel` invia solo `oracle_type` (id).
- `contextAssembler.fetchKbEntriesStrategic` accetta `kb_categories` ma l'orchestrator NON lo popola.
- Risultato: le `kb_categories` definite nei 6 default (`identita`, `vendita`, `negoziazione`, ecc.) **non vengono mai applicate** in `generate-email`. Solo `improve-email` riceve `email_type_prompt`.
- Soluzione: passare `email_type_kb_categories`, `email_type_prompt`, `email_type_structure` anche a `generate-email`.

### Gap B — `generate-email` ignora `email_type_prompt` strutturato
- Oggi `goal` viene già concatenato con `typePart` lato client (`effectiveGoal`).
- Ma il prompt non include un blocco esplicito "STRUTTURA OBBLIGATORIA" come fa `improve-email` o `generate-outreach`.
- Soluzione: introdurre un blocco `EMAIL TYPE STRUCTURE` separato, parallelo al Playbook.

### Gap C — Fallback hardcoded `oracle_type || "primo_contatto"`
- In `promptBuilder.ts:200` e `contextAssembler.ts:546,549`.
- Se l'utente non sceglie tipo, viene assunto "primo_contatto" → KB caricate sbagliate per casi diversi.
- Soluzione: se `oracle_type` mancante, usare `commercialState`/`touchCount` per inferire (`touchCount===0 → primo_contatto`, altrimenti `follow_up`).

### Gap D — Truncation profilo hardcoded
- `getProfileTruncation` ritorna numeri fissi (200/500/1000 char descrizione, 0/1000/3000 raw).
- Min ma rivedibile come setting.

### Gap E — Categoria KB hardcoded in `fetchKbEntriesStrategic`
- Le categorie base (`regole_sistema`, `filosofia`, `struttura_email`, `hook`, `cold_outreach`, `dati_partner`) sono hardcoded nel codice.
- Ideale: leggerle dalla tabella `system_doctrine` come "always-on" senza codice.

### Gap F — `_context_summary` di `improve-email` non espone `warmth_score`/`commercial_state`/`playbook`
- `improve-email` espone meno campi di `generate-email`.
- Risultato: pannello "Cosa sa Oracolo" mostra meno info dopo Migliora.
- Soluzione: allineare il payload (riusare `analyzeRelationshipHistory` lato improve).

## 5. Piano correttivo (minimal-invasive, 5 micro-fix)

| # | Fix | File | LOC stimate |
|---|---|---|---|
| 1 | Passa `email_type_prompt` + `email_type_structure` + `kb_categories` da Composer a `generate-email` | `useEmailComposerState.ts`, `index.ts`, `promptBuilder.ts`, `contextAssembler.ts` | ~30 |
| 2 | Inserisci blocco "EMAIL TYPE STRUCTURE" nel system prompt (parallelo a Playbook, sotto StrategicAdvisor) | `promptBuilder.ts` | ~15 |
| 3 | Rimuovi fallback `\|\| "primo_contatto"` → derivato da `touchCount`/`commercialState` | `promptBuilder.ts`, `contextAssembler.ts` | ~10 |
| 4 | Allinea `_context_summary` di `improve-email` con quello di `generate-email` (warmth, commercial_state, playbook_active) | `improve-email/index.ts` | ~20 |
| 5 | Carica le 6 categorie "always-on" da `system_doctrine` (no codice hardcoded) — fallback a lista attuale se tabella vuota | `contextAssembler.ts` | ~15 |

**Totale: ~90 LOC. Zero breaking change. Nessuna nuova migrazione DB.**

## 6. Verdetto

- **Flusso fluido**: ✅ ben architettato (contextAssembler + promptBuilder + responseParser).
- **Informazioni complete**: ✅ ma con 2 perdite chiave (Gap A + B): il **tipo email selezionato dall'utente non guida la KB** in `generate-email` quanto dovrebbe — il prompt del tipo finisce nel `goal`, ma le sue `kb_categories` strutturate vengono ignorate.
- **Prompt dinamici**: ✅ in larga misura. Gli unici hardcode strategici sono le 6 categorie KB always-on e il fallback `"primo_contatto"`.
- **Sincronia tipo + descrizione**: ✅ già attiva via `checkOracleCoherence` (warning soft).
- **Trasparenza**: ✅ `OracleContextPanel` espone tutto, ma `improve-email` riempie meno campi.
- **Coverage KB**: ottima per follow-up/premium, parziale per richiesta_info/proposta su `generate-email`.

Dopo l'approvazione applico i 5 micro-fix in ordine. Nessun rischio di regressione: tutti i payload aggiunti sono opzionali e ignorati dalle versioni precedenti dell'edge.

