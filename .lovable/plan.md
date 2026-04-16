

# Analisi e Riprogettazione della Dashboard Home (DashboardPage)

## Situazione attuale

La prima pagina (`/v2` → `SuperHome3D.tsx`) mostra:

1. **Briefing Operativo** — generato da un'edge function (`daily-briefing`) che chiama un LLM con 18 query parallele al DB. Le 3 tab (Effettuato / Da fare / Sospesi) contengono **testo libero generato dall'AI**, non dati strutturati.

2. **BriefingStatsBar** — 4 numeri:
   - Totale contatti = `partners.count + imported_contacts.count`
   - Nel circuito = `partners(lead_status=contacted) + imported_contacts(lead_status=contacted)`
   - Da contattare = `partners(lead_status=new) + imported_contacts(lead_status=new)`
   - Oggi = `agent_tasks` schedulati oggi

3. **Team Agenti** — Solo nome, emoji, task attivi/completati oggi, ultimo task. Dati dal briefing (edge function).

## Problemi identificati

| Problema | Dettaglio |
|----------|-----------|
| **Dati non strutturati** | I tab "Effettuato/Da fare/Sospesi" sono testo AI — non numeri cliccabili e azionabili |
| **Mancano metriche outreach** | Non si vedono: outreach creati, programmati, autorizzati, da autorizzare |
| **Risposte al primo contatto** | Non tracciate nella dashboard |
| **Agenti troppo generici** | Non si vede quante attività ha preparato ogni agente, quante in corso, quante in coda approvazione |
| **Latenza** | Il briefing dipende da una chiamata LLM (5-25s) — i numeri "duri" non dovrebbero aspettare l'AI |
| **18 query separate** | Tutte nella edge function. Le metriche strutturali dovrebbero essere query dirette dal client (come fa `useDashboardMetrics`) |

## Piano di riprogettazione

### STEP 1 — Nuova sezione "Metriche Operative" (query dirette, no AI)

Creare un nuovo hook `useDashboardOperativeMetrics` che con query parallele `head: true` restituisce:

```text
┌─────────────────────────────────────────────────────┐
│  CONTATTI                                           │
│  Totale │ Da contattare │ Contattati │ Hanno risposto│
├─────────────────────────────────────────────────────┤
│  OUTREACH PIPELINE                                  │
│  Creati │ Programmati │ Autorizzati │ Da autorizzare │
├─────────────────────────────────────────────────────┤
│  MESSAGGI                                           │
│  Inviati oggi │ In attesa risposta │ Risposte ricevute│
└─────────────────────────────────────────────────────┘
```

Fonte dati:
- **Da contattare**: `partners(lead_status=new)` + `imported_contacts(lead_status=new)`
- **Contattati**: `partners(lead_status=contacted)` + `imported_contacts(lead_status=contacted)`
- **Hanno risposto**: `outreach_queue(status=replied).count` oppure `activities(response_received=true)`
- **Creati**: `outreach_schedules(status in pending,approved,running).count`
- **Programmati**: `outreach_schedules(status=pending).count`
- **Autorizzati**: `mission_actions(status=approved).count`
- **Da autorizzare**: `mission_actions(status=proposed).count`
- **Inviati oggi**: `outreach_queue(status=sent, sent_at >= today).count`
- **In attesa risposta**: `outreach_queue(status=sent).count` (senza reply)
- **Risposte**: `outreach_queue(status=replied).count`

### STEP 2 — Team Agenti dinamico

Sostituire il pannello agenti attuale con una versione che mostra per ogni agente:
- Task **preparati** (status = proposed)
- Task **in corso** (status = running)
- Task **in coda approvazione** (status = pending)
- Task **completati oggi**
- Barra progresso visuale

Query diretta dal client su `agent_tasks` raggruppata per `agent_id` e `status`.

### STEP 3 — Briefing AI snellito

Il briefing AI rimane ma diventa **secondario** — un card collassabile sotto le metriche strutturali. I numeri "duri" arrivano istantaneamente (query dirette), il briefing narrativo arriva dopo (quando l'LLM risponde).

### STEP 4 — File da modificare

| File | Azione |
|------|--------|
| `src/v2/io/supabase/queries/dashboard.ts` | Aggiungere `fetchOperativeMetrics()` con tutte le count query |
| `src/v2/hooks/useDashboardOperativeMetrics.ts` | Nuovo hook React Query |
| `src/components/home/OperativeMetricsGrid.tsx` | Nuovo componente griglia metriche |
| `src/components/home/AgentStatusPanel.tsx` | Arricchire con breakdown per status task |
| `src/pages/SuperHome3D.tsx` | Riorganizzare layout: Metriche → Agenti → Briefing AI (collassabile) |
| `src/components/home/BriefingStatsBar.tsx` | Sostituito dalla nuova griglia, da rimuovere o mantenere dentro il briefing |

### Benefici

- **Dati istantanei**: le metriche arrivano in <500ms (count queries), non servono 25s di LLM
- **Azionabili**: ogni numero è cliccabile e naviga alla sezione corrispondente
- **Completi**: outreach pipeline, risposte, approvazioni — tutto visibile
- **Agenti trasparenti**: si vede esattamente cosa fa ogni agente

