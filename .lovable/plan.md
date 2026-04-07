
# Missioni AI-Driven: Onboarding Dinamico + Esecuzione Progressiva

## Concetto

Sostituire l'onboarding statico con un **wizard conversazionale AI** che:
1. Interroga il DB in tempo reale (quanti partner per paese, qualità, status)
2. Propone filtri e numeri concreti
3. Registra la missione come `ai_work_plan` con step eseguibili
4. Alimenta il Cockpit con i contatti da processare uno alla volta

---

## Parte 1 — Wizard Missione AI (pagina `/mission-builder`)

**Nuova pagina** con flusso progressivo guidato da AI:

### Step del wizard (generati da AI, non hardcoded):
1. **Chi contattare?** — AI interroga `partners` e `imported_contacts`, mostra statistiche per paese/tipo/rating. L'utente sceglie con chip e filtri.
2. **Quanti e come frazionare?** — AI propone batch (es. "50 in Germania, 30 in Francia"). L'utente aggiusta.
3. **Con quale canale?** — Email / WhatsApp / LinkedIn / mix. AI suggerisce in base ai dati disponibili (ha email? ha LinkedIn?).
4. **Assegnare agenti?** — AI propone distribuzione per territorio. L'utente conferma.
5. **Scheduling** — Subito / programmato / distribuito nel tempo.
6. **Conferma e crea** — Riassunto + creazione del work plan.

**Ogni step**: pannello sinistro con scelte, pannello destro con chat AI per discutere. Lo step completato scompare.

**File**: `src/pages/MissionBuilder.tsx` (~300 righe), `src/components/missions/MissionStepRenderer.tsx`

---

## Parte 2 — Tabella `outreach_missions` (nuovo)

Registra ogni missione con riassunto per future analisi AI:

```sql
CREATE TABLE outreach_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft', -- draft/active/paused/completed
  target_filters JSONB NOT NULL DEFAULT '{}', -- {countries, types, ratings, etc.}
  channel TEXT NOT NULL DEFAULT 'email',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  processed_contacts INTEGER NOT NULL DEFAULT 0,
  agent_assignments JSONB DEFAULT '[]', -- [{agent_id, country_codes, count}]
  schedule_config JSONB DEFAULT '{}',
  ai_summary TEXT, -- riassunto generato da AI a fine missione
  work_plan_id UUID, -- link a ai_work_plans
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
-- + RLS user_id = auth.uid()
```

Questo permette ad AI di:
- Verificare missioni passate prima di proporne di nuove
- Riproporre missioni simili con varianti
- Analizzare performance (processed/total, tempi)

---

## Parte 3 — Collegamento Cockpit

Quando una missione viene attivata:
1. I contatti filtrati vengono inseriti nel `cockpit_queue` con `source_type = 'mission'` e ref alla missione
2. Il Cockpit li mostra come tab/filtro "Missione attiva"
3. L'utente processa uno alla volta: genera email → invia → next
4. Ogni completamento aggiorna `outreach_missions.processed_contacts`
5. A missione completata, AI genera un `ai_summary` automatico

**File modificati**: 
- `src/hooks/useCockpitContacts.ts` — aggiungere source "mission"
- `src/pages/Cockpit.tsx` — badge missione attiva

---

## Parte 4 — AI Context: Missioni Passate

Aggiornare `agent-execute` e `ai-assistant` per iniettare le ultime 5 `outreach_missions` completate nel contesto, permettendo:
- "L'ultima volta che hai contattato la Germania hai raggiunto 45/50 partner"
- "Vuoi rifare la stessa missione ma con canale WhatsApp?"
- "Questi 12 contatti non hanno risposto dalla missione di Marzo"

**File**: `supabase/functions/ai-assistant/index.ts`, `supabase/functions/agent-execute/index.ts`

---

## Parte 5 — Navigazione e Accesso

- Voce menu: "🎯 Nuova Missione" (link a `/mission-builder`)
- Accessibile anche dal Cockpit (bottone "Crea Missione")
- Storico missioni visibile in Outreach → tab esistente o sotto-sezione

---

## Riepilogo tecnico

| Parte | File | Tipo |
|-------|------|------|
| 1 | `src/pages/MissionBuilder.tsx` | **Nuovo** |
| 1 | `src/components/missions/MissionStepRenderer.tsx` | **Nuovo** |
| 2 | Migrazione `outreach_missions` | DB |
| 3 | `useCockpitContacts.ts`, `Cockpit.tsx` | Modificati |
| 4 | `ai-assistant/index.ts`, `agent-execute/index.ts` | Modificati |
| 5 | `AppLayout.tsx` o router | Modificato |

**Ordine**: 2 (DB) → 1 (Wizard) → 3 (Cockpit link) → 4 (AI context) → 5 (Nav)
