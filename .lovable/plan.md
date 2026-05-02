## Premessa: correzione alla mia conferma iniziale

Ho detto "nessun revisore finale" — è **parzialmente sbagliato**. Esiste già un **Giornalista AI (Caporedattore Finale)** in `generate-email/index.ts` (`journalistReview` + `loadOptimusSettings`, mode/strictness configurabili) che legge la bozza generata, dà un verdetto (`block` / pass) e può sostituire il body. Quindi:

- Pipeline **`generate-email`** (usata dall'Outreach/Compose classico): **HA** revisore finale ✅
- Pipeline **`composeEmail` tool del Command** (Super Mario → batch Venezuela): **NON** passa dal Giornalista, va dritta al modello senza QA ❌

Questo è già un primo gap dell'audit.

---

## Obiettivo dell'audit (read-only, nessuna modifica)

Produrre **un singolo report Markdown** con 4 sezioni, esportato in `/mnt/documents/`:

### Sezione 1 — Anatomia di Super Mario
Mappare cosa Mario riceve nel system prompt, in che ordine, con quale peso:
- **Identity** (`super_mario_identities` DB, scope `command-director`, fallback hardcoded in `identityLoader.ts:21-28`)
- **Runtime contract + Hard guards** (`runtimeContract.ts`)
- **KB STATIC** (`kbAssembler.ts:33-52` — 19 righe hardcoded: glossario, regole ferree)
- **KB DYNAMIC** (filtrata da `INTENT_KEYWORDS` → `DOMAIN_TO_PROMPT_CONTEXTS` → query `operative_prompts`, max 6 cards × 800 char)
- **KB SITUATIONAL** (count partner totali + attività agenda oggi)
- **Memory** (narrative summary + 10 turn recenti + last_tool_result + operator_memory)
- **Tool catalog**

Verificare: i richiami alla KB sono sufficienti? Mario "sa di sapere"? Cosa manca (es. nessun riferimento esplicito a `kb_entries` categoria `doctrine`/`procedures`, nessuna iniezione di `system_doctrine`, nessuna persona DB).

### Sezione 2 — Pipeline email completa, stadio per stadio
Per ogni stadio elencare: file, input, output, istruzioni iniettate, conflitti.

```text
Oracolo (oracle_type, oracle_tone)
  → contextAssembler.ts (partner+contact+history+enrichment+BCA+...)
    → emailContract + emailTypeDetector (LOVABLE-81/82)
      → decisionEngine (azione raccomandata + journalist_role)
        → operativePromptsLoader (Prompt Lab DB, context=email)
          → kbAndPlaybookAssembler (kb_entries + sherlock_playbooks)
            → strategicAdvisor (heuristic in code)
              → promptParts.ts (address-priority/holding/commercial — SSOT)
                → calligrafiaInjector (regole formattazione SSOT KB)
                  → buildEmailPrompts (assembly finale)
                    → MODELLO AI (gemini/gpt)
                      → parseEmailResponse
                        → journalistReview ✅ REVISORE (mode/strictness DB)
                          → output finale
```

Verificare per ogni stadio:
- Quali istruzioni inietta (testuali, prese dal codice)
- Se contraddice/duplica lo stadio successivo (es. tono Oracolo vs tono Prompt Lab vs tono Giornalista)
- Se è progressivo (raffinamento) o ridondante (ripetizione)

### Sezione 3 — Audit KB + Operative Prompts globali
Estrarre dal DB tramite `supabase--read_query`:
- Tutti gli `operative_prompts` attivi (count per `context`, per `priority`, deprecated)
- Tutte le `kb_entries` attive (count per `category`/`chapter`, per priorità, source_path)
- `agent_personas`, `agent_capabilities`, `system_doctrine`, `super_mario_identities`

Per ognuno cercare:
- **Conflitti**: due prompt stessa context con regole opposte (es. lunghezza email)
- **Duplicazioni**: stesso contenuto in più entry
- **Gap**: domini operativi senza prompt (es. dominio `partner-search` di Mario mappa a `general` — c'è copertura?)
- **Orfani**: prompt mai caricati da nessuna pipeline (incrociare `context` con i loader)

### Sezione 4 — Export KB/Prompt: cosa esiste già

Trovati **3 export funzionanti** già in app:

1. **`AIExportPanel`** (`src/components/settings/AIExportPanel.tsx`) — **questo è il completo**. Genera `.zip` con: agenti, kb_entries, operative_prompts, ai_memory (L2/L3), app_settings, agent_personas, scope configs, agent prompts catalog, agent templates, procedures, full-backup.json. Markdown leggibile + JSON tecnico.
2. **`BackupExportTab`** (`src/components/settings/BackupExportTab.tsx`) — backup generico settings.
3. **`prompt-lab/ExportButton`** (`src/v2/ui/pages/prompt-lab/ExportButton.tsx`) — snapshot JSON dei tab Prompt Lab.

**Nessuna nuova funzione necessaria**. Verifica solo dove è esposto in UI: lo cerco e ti dico in che pagina/tab del Settings è raggiungibile.

---

## Cosa NON include questo piano (per tua decisione esplicita)
- ❌ Nessuna proposta di nuovo "Revisore finale" (hai detto "solo audit dell'esistente")
- ❌ Nessuna modifica codice
- ❌ Nessun nuovo export

## Deliverable
Un unico file: `/mnt/documents/audit-super-mario-pipeline-email-2026-05-02.md` (~15-25KB) con le 4 sezioni, tabelle di conflitti, conteggi reali da DB, citazioni dei file con line-number per ogni claim.

## Tempo stimato
~5-8 minuti di esplorazione + query DB + scrittura report.
