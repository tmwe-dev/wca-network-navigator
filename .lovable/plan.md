

## Segretario Operativo AI: Sistema di Memoria, Piani di Lavoro e Azioni Progressive

### Concetto

Trasformare l'assistente AI da "interrogatore di dati" a **segretario operativo con memoria persistente**. L'AI potra:
- Ricordare conversazioni, decisioni e operazioni passate
- Creare piani di lavoro multi-step e eseguirli progressivamente
- Catalogare operazioni ripetitive come template riutilizzabili
- Operare sul sistema replicando azioni umane (filtri, selezioni, aggiornamenti, navigazione)

```text
┌─────────────────────────────────────────────┐
│             ai_memory (tabella)              │
├─────────────────────────────────────────────┤
│ Conversazioni  │  Decisioni  │  Preferenze  │
│ (conversation) │  (decision) │  (preference)│
└────────────┬────────────────┬───────────────┘
             │                │
┌────────────▼────────────────▼───────────────┐
│           ai_work_plans (tabella)            │
├─────────────────────────────────────────────┤
│ Piano di lavoro multi-step con stato        │
│ steps[]  │  progress  │  results  │  tags[] │
│ status: draft → running → completed         │
└────────────┬────────────────────────────────┘
             │
┌────────────▼────────────────────────────────┐
│        ai_plan_templates (tabella)          │
├─────────────────────────────────────────────┤
│ Piani riutilizzabili catalogati dall'AI     │
│ name  │  steps_template  │  tags[]  │  uses │
└─────────────────────────────────────────────┘
```

### Modifiche

**1. Database: 3 nuove tabelle**

**`ai_memory`** — memoria persistente dell'AI
- `id`, `user_id`, `memory_type` (conversation | decision | preference | fact), `content` (text), `tags` (text[]), `context_page` (text), `importance` (1-5), `created_at`, `expires_at` (nullable, per memoria temporanea)
- L'AI scrive qui le cose da ricordare: scelte dell'utente, pattern operativi, fatti appresi

**`ai_work_plans`** — piani di lavoro temporanei
- `id`, `user_id`, `title`, `description`, `status` (draft | running | paused | completed | failed), `steps` (jsonb array: [{action, params, status, result, started_at, completed_at}]), `current_step` (int), `tags` (text[]), `source_template_id` (nullable), `created_at`, `completed_at`, `metadata` (jsonb)
- Ogni step ha: `action` (tipo operazione), `params` (parametri), `status` (pending | running | done | failed | skipped), `result` (jsonb)

**`ai_plan_templates`** — template riutilizzabili
- `id`, `user_id`, `name`, `description`, `steps_template` (jsonb), `tags` (text[]), `use_count` (int), `last_used_at`, `created_at`
- Quando l'AI riconosce un pattern ripetitivo, lo salva qui come template

**2. Edge Function `ai-assistant` — nuovi tool**

Aggiungere 8 nuovi tool alla funzione esistente:

- **`save_memory`** — Salva un ricordo (decisione, preferenza, fatto)
- **`search_memory`** — Cerca nella memoria per tags o testo (l'AI la consulta prima di rispondere)
- **`create_work_plan`** — Crea un piano di lavoro con step multipli
- **`execute_plan_step`** — Esegue il prossimo step di un piano attivo
- **`get_active_plans`** — Lista piani in corso
- **`save_as_template`** — Salva un piano completato come template riutilizzabile
- **`search_templates`** — Cerca template per tags o nome
- **`execute_ui_action`** — Esegue azioni UI (applicare filtri, navigare, selezionare) dispatchando eventi al frontend

Aggiornare il system prompt per istruire l'AI a:
- Consultare la memoria all'inizio di ogni conversazione
- Salvare automaticamente decisioni importanti
- Proporre piani multi-step per richieste complesse
- Riconoscere e catalogare pattern ripetitivi
- Usare execute_ui_action per operare sull'interfaccia

**3. Frontend `AiAssistantDialog.tsx`**

- All'apertura, caricare automaticamente gli ultimi ricordi e iniettarli nel contesto
- Gestire il nuovo evento `ai-ui-action` per eseguire azioni dispatched dall'AI
- Mostrare indicatore visivo quando c'e un piano attivo (badge con progresso)
- Aggiungere sezione "Piani attivi" nel dialog quando presenti

**4. Listener globale per azioni UI**

- In `AppLayout.tsx`, aggiungere listener per `CustomEvent("ai-ui-action")` che esegue:
  - `navigate` — navigazione a pagina
  - `apply_filters` — dispatch ai-command per filtri pagina
  - `show_toast` — notifica utente
  - `open_dialog` — apertura dialog specifici

### Azioni UI che l'AI potra eseguire

L'AI potra combinare tool DB esistenti + nuove azioni UI in piani multi-step. Esempio di piano:

```text
Piano: "Aggiorna profili mancanti Germania e invia email ai top partner"
Step 1: get_country_overview(DE) → verifica stato
Step 2: create_download_job(DE, no_profile) → avvia download
Step 3: save_memory("Download DE avviato") → ricorda
Step 4: search_partners(DE, min_rating:4, has_email:true) → trova top
Step 5: execute_ui_action(navigate, /workspace) → apri workspace
Step 6: save_memory("Piano completato") → log
```

### File da creare/modificare

1. **Migrazione SQL** — crea `ai_memory`, `ai_work_plans`, `ai_plan_templates` con RLS
2. **`supabase/functions/ai-assistant/index.ts`** — aggiungi 8 tool + aggiorna system prompt
3. **`src/components/operations/AiAssistantDialog.tsx`** — carica memoria, mostra piani, gestisci azioni
4. **`src/components/layout/AppLayout.tsx`** — listener globale per ai-ui-action

### Dettagli tecnici

**Caricamento memoria nel contesto**: all'apertura del dialog, query ultime 20 memorie ordinate per importanza e recenza. Iniettate nel system prompt come sezione "MEMORIA OPERATIVA".

**Tags automatici**: l'AI genera tags semantici per ogni memoria e piano (es: "download", "germania", "profili", "email-campaign"). Questo permette ricerche veloci e pattern matching.

**Ciclo di vita dei piani**: draft → l'AI propone → utente approva → running → l'AI esegue step per step, riportando risultati → completed. Se uno step fallisce, il piano va in paused e l'AI chiede istruzioni.

**Template recognition**: dopo 2+ esecuzioni di piani simili (match per tags), l'AI propone di salvare come template. I template hanno un contatore uso e data ultimo utilizzo per ranking.

