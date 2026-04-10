

# Analisi Audit Esterno + Stato Attuale Post-Fix — Sintesi e Piano

## Documenti Memorizzati

**Documento 1**: Audit tecnico DOCX (Claude Opus 4.6, 10 Aprile 2026)
- Punteggio: **37.600 / 100.000** (37.6%)
- 10 assi di valutazione, 34 problemi catalogati + 1.597 lint
- 4 vulnerabilità sicurezza critiche (SEC-01..04)
- 4 problemi architetturali critici (ARC-01..04)
- 11 problemi alti, 15 medi

**Documento 2**: Analisi conversazionale (tua sintesi) 
- Punteggio: **54.000 / 100.000** (54%)
- Diagnosi filosofica: "più ricco che coerente"
- 3 filosofie simultanee: enterprise, Lovable/prompt-driven, browser-assisted
- Knowledge sprawl identificata come criticità principale

## Confronto tra i Due Audit

| Asse | Audit DOCX (Opus) | Tua Analisi | Differenza |
|---|---|---|---|
| **Punteggio globale** | 37.600 | 54.000 | +16.400 |
| **Type Safety** | 1.800 (strict OFF) | Ora strict ON | DOCX è stale qui |
| **Test** | 800 (5 file) | ~720 test | DOCX è stale qui |
| **AI/Prompt** | 7.500 | 38.000 (incoerenza) | Diversa metrica |
| **Sicurezza** | 3.200 | Non valutata | DOCX copre estensioni Chrome |
| **Build** | 7.800 | CI rotta (npm ci) | Entrambi trovano problemi |

## Cosa è Stato Fixato nelle 4 Cacce al Tesoro (Oggi)

1. **Multi-tenancy**: `.eq("user_id")` aggiunto a tutte le 12+ edge function per `app_settings` e `kb_entries`
2. **sameLocationGuard**: `return true` bug eliminato
3. **Modelli AI**: allowlist aggiornata (gpt-5 family), fallback obsoleti rimossi
4. **Race condition**: `increment_partner_interaction` e `increment_agent_stat` ora atomici via RPC
5. **Syntax crash**: righe duplicate in `generate-email` e `agent-autonomous-cycle` rimosse
6. **AI resilience**: AbortController 45s + fallback model cascade in `generate-email`
7. **KB centralizzata**: `_shared/kbSlice.ts` elimina duplicazione in 3 file
8. **N+1 query**: Director View in `agent-execute` ora usa `.in("id", agentIds)`
9. **Work hours per-utente**: `loadWorkHourSettings(supabase, userId)` in tutti i cron

## Cosa Rimane Aperto (Convergenza dei Due Audit)

### Blocco 0 — CI/Build (IMMEDIATO)
- `npm ci` fallisce per lockfile fuori sync
- `vitest/globals` non risolve nel typecheck
- **Senza CI verde, niente è verificabile**

### Blocco 1 — Sicurezza Estensioni Chrome (dal DOCX)
- SEC-02: `new Function()` in `pipeline.js` e `task-runner.js` (RCE)
- SEC-03: `innerHTML` non sanitizzato in estensioni (XSS) — nel React app è OK, problema solo nelle estensioni
- SEC-04: Password LinkedIn in chiaro
- EXT-01: `host_permissions: <all_urls>`
- **Queste sono FUORI dal perimetro Lovable** (file JS estensioni non in `src/`)

### Blocco 2 — Architettura (convergenza entrambi)
- God components (FiltersDrawer 1.114 LOC, BusinessCardsHub 1.084 LOC)
- useCockpitLogic con 11 useState
- Dead code V8 (~2.000 LOC)
- 23 route legacy redirect
- 13 Edge Functions AI sovrapposte
- app_settings come "registro universale"

### Blocco 3 — Qualità Codice
- ~1.500 `any` espliciti (parzialmente ridotti)
- 59 catch vuoti
- 55 violazioni exhaustive-deps
- Nessun optimistic update
- JSON fields DB senza validazione runtime

### Blocco 4 — Knowledge Architecture
- KB monolitica in `app_settings` coesiste con `kb_entries` atomica
- `operative_prompts` vs `agentPrompts.ts` vs prompt hardcoded
- Nessuna versioning dei prompt
- Source of truth multipla

## Piano Proposto — Prioritizzazione Post-Audit

### Fase 1: CI Verde (1 giorno)
- Riallineare `package-lock.json`
- Fix `vitest/globals` nel typecheck
- Pipeline: `npm ci → typecheck → test → build`

### Fase 2: Pulizia Immediata (2-3 giorni)
- Eliminare dead code V8
- Rimuovere le 23 route legacy
- Eliminare le 9 edge functions WCA legacy
- Ridurre `any` nei file più critici

### Fase 3: Architettura AI (1 settimana)
- Consolidare 13 AI edge functions in 4-5 con routing interno
- Unificare KB: migrare `ai_sales_knowledge_base` monolitica → `kb_entries`
- Stabilire gerarchia prompt: `operative_prompts` > `kb_entries` > defaults
- Eliminare prompt hardcoded residui

### Fase 4: God Components (1 settimana)
- Spezzare FiltersDrawer, BusinessCardsHub, useCockpitLogic
- Estrarre query DB da componenti → hook dominio
- Introdurre optimistic updates su mutazioni critiche

### Fase 5: Validazione e Resilienza (ongoing)
- Zod per JSON fields DB
- Catch vuoti → logging strutturato
- Fix exhaustive-deps

### Punteggio Atteso Post-Piano
- Dopo Fase 1-2: **~50.000** (debito ridotto, CI affidabile)
- Dopo Fase 3-4: **~65.000** (architettura coerente)
- Dopo Fase 5: **~72.000** (qualità industriale)

## Nota sulla Divergenza di Punteggio

L'audit DOCX dà 37.600 perché:
1. Valuta le estensioni Chrome (17.593 LOC con vulnerabilità gravi) — noi non le tocchiamo qui
2. Era pre-fix multi-tenancy (il bug più grave è stato risolto oggi)
3. Conta strict OFF — ora è strict ON
4. Conta 5 test — ora ce ne sono 720+

La tua stima di 54.000 è più accurata per lo stato attuale del codice `src/` + edge functions, ma non include le estensioni Chrome.

**Punteggio realistico attuale (solo perimetro Lovable)**: ~52.000-55.000

