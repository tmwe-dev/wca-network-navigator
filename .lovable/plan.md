

# Analisi Comparativa: Mission Builder vs SwiftPack Studio AI Assistant

## Cosa ho confrontato

**Il tuo sistema (WCA Network Navigator):** MissionBuilder conversazionale a 10 step + MissionDrawer laterale + OperativeJobsBoard + agent-autonomous-cycle.

**SwiftPack Studio:** AIAssistantPanel con pattern **Plan → Approve → Execute** strutturato, basato su `ai_jobs` con lifecycle completo (planned → approved → completed/cancelled/failed), idempotency key deterministico, e recovery markers per crash post-DB.

---

## Gap identificati nel tuo sistema

### 1. Mancanza del ciclo Plan → Approve → Execute nella Mission

Il tuo MissionBuilder invia comandi all'AI e riceve widget interattivi, ma **non genera un piano strutturato approvabile** prima dell'esecuzione. Il `launchMission()` inserisce direttamente in `cockpit_queue` senza un passaggio intermedio di revisione del piano.

SwiftPack genera un JSON strutturato con `interpretation`, `dangerLevel`, `actions[]`, `summary` e lo mostra all'utente per approvazione/annullamento prima di qualsiasi azione. Se `dangerLevel !== "safe"`, il piano deve essere approvato esplicitamente.

### 2. Nessun Job tracking persistente per le missioni

Le missioni sono inserite in `outreach_missions`, ma non c'e un equivalente di `ai_jobs` che tracci lo stato granulare di ogni azione (planned, approved, executing, completed, failed). Manca la visibilita sull'avanzamento del piano.

### 3. Idempotency deterministico assente nel Mission flow

SwiftPack genera un `idempotency_key` dal hash di `userRequest + interpretation + actionIds` per prevenire duplicati. Il tuo sistema non ha questa protezione nel flusso missione.

### 4. Recovery markers per fallimenti post-commit

SwiftPack scrive un recovery marker nel DB se la creazione del job fallisce, garantendo tracciabilita anche in caso di crash. Il tuo `launchMission()` ha solo un try/catch con toast.

### 5. Il MissionDrawer e il MissionBuilder non sono connessi al Job lifecycle

Il MissionDrawer gestisce configurazione (goal, proposta, contesto, documenti, destinatari) ma non mostra lo stato dei job in esecuzione. Non c'e feedback real-time sullo stato della missione dopo il lancio.

---

## Piano di implementazione

### Step 1: Aggiungere il pattern Plan → Approve alla Mission

Modificare `MissionBuilder.tsx` per:
- Dopo la fase di configurazione (10 step), generare un **piano strutturato** (JSON con `interpretation`, `dangerLevel`, `actions[]`, `summary`)
- Mostrare un pannello di approvazione (simile a SwiftPack) con Approva/Annulla
- Solo dopo l'approvazione, eseguire `launchMission()`

### Step 2: Creare tracking granulare delle azioni missione

Aggiungere una tabella `mission_actions` (o riutilizzare `ai_work_plans`) per tracciare ogni singola azione del piano con stato individuale (queued, processing, completed, failed).

Campi chiave: `mission_id`, `action_type`, `status`, `idempotency_key`, `started_at`, `completed_at`, `error_message`, `recovery_log`.

### Step 3: Aggiungere idempotency key al flusso missione

Implementare lo stesso pattern di SwiftPack: hash deterministico da `(target_countries + channel + batch_config + timestamp_day)` per prevenire il doppio lancio della stessa missione.

### Step 4: Recovery markers nel launchMission

Wrappare ogni fase del lancio (insert missione, insert queue items) con recovery markers che loggano nel DB lo stato raggiunto prima del fallimento.

### Step 5: Stato missione in tempo reale nel MissionDrawer

Aggiungere una sezione "Missioni Attive" nel MissionDrawer che mostra:
- Stato corrente di ogni missione lanciata
- Progress bar (azioni completate / totale)
- Possibilita di annullare/mettere in pausa

### Step 6: Pannello di conferma interattivo (ConfirmPlanWidget)

Creare un nuovo widget `MissionPlanReview` che mostra il piano generato con:
- Danger level badge (safe/moderate/critical)
- Lista azioni con stima durata
- Bottoni Approva/Annulla
- Indicatore di idempotency ("Questa missione e gia stata lanciata")

---

## File coinvolti

- `src/pages/MissionBuilder.tsx` — aggiungere plan generation + approval flow
- `src/components/missions/MissionChatWidgets.tsx` — nuovo widget `MissionPlanReview`
- `src/contexts/MissionContext.tsx` — aggiungere stato missioni attive
- `src/components/global/MissionDrawer.tsx` — sezione "Missioni Attive"
- `src/hooks/useOperativeJobs.ts` — estendere per supportare mission-type jobs
- Migration SQL — tabella `mission_actions` + idempotency_key su `outreach_missions`

