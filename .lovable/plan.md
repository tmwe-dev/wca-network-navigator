

# Audit Completo: Sistema di Apprendimento AI

## Diagnosi

Ho analizzato in profondita tutti i 5 canali di apprendimento del sistema. Il design architetturale e **eccellente** — memoria gerarchica a 3 livelli, decay esponenziale, promozione automatica, rolling summary, auto-save dai tool, feedback loop dalle email. Ma ci sono **3 problemi critici bloccanti** che impediscono al sistema di funzionare realmente.

---

## I 5 Canali di Apprendimento (Stato Attuale)

| Canale | Meccanismo | Stato |
|---|---|---|
| **1. Memory esplicita** | `save_memory` tool — l'AI salva quando l'utente corregge/preferisce | OK (funziona) |
| **2. Auto-save dai tool** | Dopo `send_email`, `create_download_job`, ecc. → L1 auto con dedup 24h | OK (funziona) |
| **3. Rolling summary** | Ogni 8+ messaggi → compressione background → L1 `rolling_summary` | OK (funziona) |
| **4. KB learning** | `save_kb_rule` tool — pattern ricorrenti → regola KB persistente | ROTTO — nessun embedding |
| **5. Operative prompts** | `save_operative_prompt` — scenario complesso → prompt strutturato | OK (ma 0 record) |
| **6. Email edit learning** | Dialog post-edit → salva stile in `ai_memory` | OK (funziona) |
| **7. Feedback buttons** | Thumbs up/down → boost/reduce confidence memorie recenti | OK (funziona) |

---

## PROBLEMA CRITICO 1 — RAG Completamente Inoperativo

La colonna `embedding` **NON ESISTE** su `kb_entries`. L'estensione `pgvector` **NON e installata**. La funzione RPC `match_kb_entries` **NON ESISTE**.

La migrazione `20260408054333_enable_pgvector_rag.sql` e nel repository ma non e mai stata applicata al database.

**Impatto**: Il retrieval semantico (`ragSearchKb`) fallisce silenziosamente ad ogni chiamata. Il sistema ricade SEMPRE sul fallback statico (top 10 per priority >= 5), il che significa che:
- Le KB entries voice_rules appena create (priority 5-6) competono con le regole_sistema (priority 10) e spesso non vengono iniettate
- La ricerca KB per argomento e puramente testuale (ilike), non semantica
- Il `kb-embed-backfill` fallisce perche la colonna non esiste

**Fix**: Applicare la migrazione pgvector.

---

## PROBLEMA CRITICO 2 — Memory Quasi Vuota

Il database contiene **1 solo record** in `ai_memory` (un rolling_summary). Nessuna memoria esplicita, nessun auto-save, nessun feedback. Questo suggerisce che:
- L'utente non ha ancora usato l'assistente in produzione in modo significativo, OPPURE
- Le memorie sono state pruned dal `memory-promoter` (soglia confidence < 0.02)

**Impatto**: L'AI parte senza contesto ad ogni sessione.

---

## PROBLEMA CRITICO 3 — Operative Prompts Vuoti (0 record)

La tabella esiste e il tool `save_operative_prompt` funziona, ma il LEARNING_PROTOCOL dice "proponi all'utente" — l'AI non salva autonomamente, aspetta che l'utente confermi. Senza un trigger proattivo, restano vuoti.

---

## Gap nel Ciclo di Apprendimento

### Gap A: Nessun trigger automatico per `save_kb_rule`
Il LEARNING_PROTOCOL dice "quando rilevi pattern su 2+ partner", ma l'AI non ha un meccanismo di conteggio delle occorrenze. Dipende interamente dalla capacita del modello di ricordare i pattern nella stessa sessione.

### Gap B: Le nuove KB entries non vengono embeddate automaticamente
`save_kb_rule` restituisce `needs_embedding: true` ma **nessun processo** reagisce a quel flag. Il `kb-embed-backfill` e manuale (richiede una chiamata HTTP esplicita). Non c'e un trigger o cron.

### Gap C: La confidence del feedback non si propaga alla KB
`FeedbackButtons` modifica la `confidence` delle memorie L1/L2 recenti, ma NON tocca le `kb_entries`. Le regole KB non migliorano/peggiorano in base al feedback utente.

### Gap D: Email edit learning salva come `style_preference` con `confidence: 60`
Il campo confidence in `ai_memory` e normalizzato 0-1 nel resto del sistema, ma `EmailEditLearningDialog` usa `60` (probabilmente inteso come 60%). Questo crea incoerenza.

---

## Piano di Fix (4 Step)

### Step 1: Applicare la migrazione pgvector
Eseguire il SQL che:
- Abilita `pgvector` extension
- Aggiunge colonna `embedding vector(1536)` a `kb_entries`
- Crea la funzione RPC `match_kb_entries`
- Crea l'indice IVFFlat per performance

### Step 2: Triggerare il backfill degli embedding
Dopo la migrazione, invocare `kb-embed-backfill` per generare gli embedding per tutte le 46+ KB entries esistenti (incluse le 6 voice_rules appena create).

### Step 3: Fixare la confidence in EmailEditLearningDialog
Cambiare `confidence: 60` → `confidence: 0.6` in `src/components/email/EmailEditLearningDialog.tsx`.

### Step 4: Creare un auto-embed trigger per nuove KB entries
Aggiungere logica nel `save_kb_rule` handler per chiamare automaticamente l'embedding dopo l'insert, eliminando il gap tra creazione e indicizzazione.

---

## File Coinvolti

- Migrazione SQL — applicare pgvector + colonna embedding + RPC match_kb_entries
- `supabase/functions/_shared/toolHandlersEnterprise.ts` — auto-embed dopo save_kb_rule
- `src/components/email/EmailEditLearningDialog.tsx` — fix confidence 60 → 0.6
- `supabase/functions/kb-embed-backfill/index.ts` — invocare per backfill iniziale

