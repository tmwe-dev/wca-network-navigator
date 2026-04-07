
# Missioni AI-Driven: Onboarding Dinamico + Esecuzione Progressiva

## Concetto

Sostituire l'onboarding statico con un wizard conversazionale AI che interroga il DB in tempo reale, propone filtri e numeri, registra la missione e alimenta il Cockpit per l'esecuzione uno-alla-volta.

---

## Parte 1 — Tabella `outreach_missions`

Nuova tabella per registrare ogni missione con riassunto analizzabile da AI:

```sql
CREATE TABLE outreach_missions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  target_filters JSONB NOT NULL DEFAULT '{}',
  channel TEXT NOT NULL DEFAULT 'email',
  total_contacts INTEGER NOT NULL DEFAULT 0,
  processed_contacts INTEGER NOT NULL DEFAULT 0,
  agent_assignments JSONB DEFAULT '[]',
  schedule_config JSONB DEFAULT '{}',
  ai_summary TEXT,
  work_plan_id UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  completed_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'
);
```

Con RLS `user_id = auth.uid()`.

---

## Parte 2 — Wizard Missione AI (`/mission-builder`)

Pagina con flusso progressivo, ogni step scompare al completamento:

1. **Chi contattare?** — AI interroga DB, mostra stats per paese/tipo/rating
2. **Quanti e come frazionare?** — Batch per paese, l'utente aggiusta
3. **Canale?** — Email/WhatsApp/LinkedIn, AI suggerisce in base a dati disponibili
4. **Agenti?** — Distribuzione per territorio
5. **Scheduling** — Immediato o programmato
6. **Conferma** — Riassunto, creazione missione + inserimento contatti in cockpit_queue

Pannello destro con chat AI per discutere in tempo reale ogni step.

**File nuovi**: `src/pages/MissionBuilder.tsx`, `src/components/missions/MissionStepRenderer.tsx`

---

## Parte 3 — Collegamento Cockpit

Quando missione attivata:
- Contatti inseriti in `cockpit_queue` con `source_type = 'mission'`
- Cockpit mostra badge "Missione attiva" con progresso
- Ogni email inviata aggiorna `processed_contacts`
- A completamento, AI genera `ai_summary`

**File modificati**: `useCockpitContacts.ts`, `Cockpit.tsx`

---

## Parte 4 — AI Context: Missioni Passate

Iniettare ultime 5 missioni completate nel contesto di `ai-assistant` e `agent-execute` per permettere:
- Confronto con missioni precedenti
- Riproposta di missioni simili
- Analisi contatti non rispondenti

---

## Parte 5 — Navigazione

- Voce menu "🎯 Nuova Missione" nel sidebar
- Bottone "Crea Missione" nel Cockpit
- Storico missioni in Outreach

---

## Ordine di implementazione

1. Migrazione DB (`outreach_missions`)
2. Wizard MissionBuilder
3. Link Cockpit
4. AI context injection
5. Navigazione
