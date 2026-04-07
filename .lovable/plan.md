

# Sistema AI Cognitivo Unificato — Piano Implementazione

## Panoramica

Implementazione in 5 fasi del sistema AI intelligente che combina il meglio di Hydra (memoria L1/L2/L3), SwiftPack (auto-save da operazioni) e Cobra (ChatMemory con rolling summary). Ogni fase è indipendente e funzionante.

---

## Fase 1 — Profilo Utente Universale + Context Injection

**Problema**: Solo `generate-email`, `generate-outreach` e `improve-email` leggono `app_settings` con i dati AI. Gli assistenti principali (`ai-assistant`, `super-assistant`, `contacts-assistant`, `cockpit-assistant`) non iniettano il profilo utente nel contesto.

**Modifiche**:
- Creare una funzione helper `loadUserProfile(supabase)` che legge le `app_settings` con prefisso `ai_` e restituisce un blocco di testo strutturato (nome, azienda, ruolo, KB, stile, settore)
- Iniettare questo blocco nel system prompt di: `ai-assistant`, `super-assistant`, `contacts-assistant`
- Aggiungere campi business al profilo in `AIProfileSettings.tsx`: obiettivi commerciali attuali (`ai_business_goals`), regole comportamentali (`ai_behavior_rules`), attività principali azienda (`ai_company_activities`)

**File**:
| File | Modifica |
|------|----------|
| `src/components/settings/AIProfileSettings.tsx` | +3 campi (goals, rules, activities) |
| `supabase/functions/ai-assistant/index.ts` | Caricare `app_settings` ai_* e iniettare nel system prompt |
| `supabase/functions/super-assistant/index.ts` | Idem |
| `supabase/functions/contacts-assistant/index.ts` | Idem |

---

## Fase 2 — Memoria L1/L2/L3 con Decay e Promotion

**Problema**: La tabella `ai_memory` è flat — nessun livello, nessun decay, nessuna promozione. Le memorie si accumulano senza priorità.

**Migrazione DB** — aggiungere colonne a `ai_memory`:
```sql
ALTER TABLE ai_memory
  ADD COLUMN IF NOT EXISTS level smallint NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS access_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS confidence numeric(3,2) NOT NULL DEFAULT 0.50,
  ADD COLUMN IF NOT EXISTS decay_rate numeric(4,3) NOT NULL DEFAULT 0.020,
  ADD COLUMN IF NOT EXISTS last_accessed_at timestamptz DEFAULT now(),
  ADD COLUMN IF NOT EXISTS promoted_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';
```

**Logica livelli** (da Hydra):
- **L1** (sessione): decay 2%/giorno, promotion a L2 dopo 3 accessi + confidence ≥ 0.40
- **L2** (operativa): decay 0.5%/giorno, promotion a L3 dopo 8 accessi + confidence ≥ 0.70 + approvazione umana
- **L3** (permanente): nessun decay, mai cancellata automaticamente

**Edge Function `memory-promoter`** (nuova):
- Scansiona L1 → promuove a L2 se criteri soddisfatti
- Scansiona L2 → marca come "candidata L3" (flag `pending_promotion`)
- Applica decay: riduce `confidence` in base a `decay_rate` e giorni dall'ultimo accesso
- Elimina L1 con confidence < 0.05

**Modifiche a `loadMemoryContext`** in `ai-assistant`:
- Priorità: L3 prima (max 10), poi L2 (max 10), poi L1 recenti (max 5)
- Incrementare `access_count` e `last_accessed_at` sulle memorie caricate

**Auto-save da operazioni** (da SwiftPack):
- Dopo tool `send_email`: salva L1 "Email inviata a [nome] di [azienda] — oggetto: [subject]"
- Dopo tool `create_download_job`: salva L1 "Download avviato per [paese], [N] partner"
- Dopo tool `deep_search_partner`: salva L1 "Deep search su [azienda]"
- In `executeSaveMemory`: se `importance >= 4`, salva come L2 direttamente

**File**:
| File | Modifica |
|------|----------|
| Migration SQL | Nuove colonne su `ai_memory` |
| `supabase/functions/memory-promoter/index.ts` | **Nuovo** — promotion + decay |
| `supabase/functions/ai-assistant/index.ts` | `loadMemoryContext` con livelli; auto-save post-tool |

---

## Fase 3 — ChatMemory con Rolling Summary (da Cobra)

**Problema**: Il chat invia TUTTA la history al modello. Con conversazioni lunghe, si spreca contesto e si superano i limiti.

**Logica**:
- **Live window**: ultimi 6 messaggi sempre integrali
- **Rolling summary**: ogni 8 messaggi, i messaggi più vecchi vengono compressi in un riassunto di 3-4 righe (usando un modello veloce: `gemini-2.5-flash-lite`)
- Il summary viene prepeso come primo messaggio `system` dopo il prompt principale
- Il summary viene anche salvato in `ai_memory` come L1 con tag `session_summary`

**Implementazione**:
- In `ai-assistant/index.ts`, prima di inviare `messages` al modello:
  1. Se `messages.length > 8`, prendi i primi `N-6`, genera un summary con una chiamata leggera
  2. Sostituisci quei messaggi con un singolo `{role: "system", content: "RIEPILOGO CONVERSAZIONE: ..."}`
  3. Appendi i 6 messaggi recenti
- Opzionalmente, il summary viene calcolato client-side in `useAiAssistantChat` per ridurre latenza

**File**:
| File | Modifica |
|------|----------|
| `supabase/functions/ai-assistant/index.ts` | Logica rolling summary prima della chiamata AI |

---

## Fase 4 — Feedback UI + Approvazione L3

**Componenti frontend**:
- `FeedbackButtons.tsx`: pollice su / pollice giù sotto ogni risposta AI nell'assistente
  - Pollice su: incrementa `confidence` delle memorie usate in quella risposta
  - Pollice giù: decrementa `confidence`
- `MemoryDashboard.tsx`: sezione in Impostazioni AI che mostra le memorie per livello
  - L3 con badge "Permanente"
  - Candidati L3 con tasto "Approva" / "Rifiuta"
  - Possibilità di eliminare/editare memorie L1/L2

**File**:
| File | Modifica |
|------|----------|
| `src/components/ai/FeedbackButtons.tsx` | **Nuovo** — pollice su/giù |
| `src/components/ai/MemoryDashboard.tsx` | **Nuovo** — gestione memorie con approvazione L3 |
| `src/components/settings/GeneralSettings.tsx` | Nuovo tab "Memoria AI" |
| `src/components/intelliflow/AiDrawerContent.tsx` | Aggiungere FeedbackButtons sotto ogni risposta |

---

## Fase 5 — Prompt Centralizzati + KB Injection in tutti gli agenti

**Problema**: Ogni edge function ha il suo prompt hardcoded. Modificare comportamenti richiede deploy.

**Soluzione**:
- Creare `src/data/agentPrompts.ts` con i prompt strutturati per ogni agente (esportati come oggetti con sezioni: ruolo, regole, output format, contesto)
- Le edge functions continuano a usare i prompt hardcoded (per performance), ma la tabella `operative_prompts` esistente viene usata per override runtime
- In `ai-assistant`, aggiungere il caricamento di `operative_prompts` attivi e iniettarli come sezione del system prompt

**KB Injection universale** (già parzialmente in `generate-email`):
- In `ai-assistant` e `super-assistant`: caricare le top-10 `kb_entries` per priorità e iniettarle nel contesto
- Già fatto in `super-assistant` — estendere a `ai-assistant`

**File**:
| File | Modifica |
|------|----------|
| `supabase/functions/ai-assistant/index.ts` | Caricare `kb_entries` top-10 + `operative_prompts` |
| `supabase/functions/super-assistant/index.ts` | Verificare che KB sia già iniettata (già fatto) |

---

## Riepilogo migrazioni DB

1. `ai_memory`: +6 colonne (level, access_count, confidence, decay_rate, last_accessed_at, source)
2. `app_settings`: +3 chiavi (ai_business_goals, ai_behavior_rules, ai_company_activities) — nessuna migrazione, inseriti via UI

## Ordine di implementazione

1. **Fase 1** — Profilo universale (prerequisito per tutto)
2. **Fase 2** — Memoria L1/L2/L3 (il cuore cognitivo)
3. **Fase 3** — ChatMemory rolling summary
4. **Fase 4** — Feedback UI + dashboard memorie
5. **Fase 5** — Prompt centralizzati + KB injection

Totale file nuovi: 4. File modificati: ~8. Migrazioni: 1.

