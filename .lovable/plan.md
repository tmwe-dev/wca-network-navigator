

# Piano: Attivazione del Ciclo Autonomo degli Agenti

## Problema
Tutta l'infrastruttura agenti è costruita ma **mai attivata**. Serve:
1. Schedulare il ciclo autonomo via cron
2. Aggiungere lo screening dei messaggi in arrivo (email + WhatsApp)
3. Rendere visibile il flusso nell'interfaccia

## Cosa fare

### 1. Creare cron job per il ciclo autonomo
- Migrazione SQL: `SELECT cron.schedule('agent-autonomous-cycle', '*/10 * * * *', ...)` — ogni 10 minuti chiama la edge function
- Solo durante ore attive (06:00-00:00 ora locale, rispettando la pausa notturna già implementata)

### 2. Aggiungere screening messaggi in arrivo nel ciclo
- Modificare `agent-autonomous-cycle/index.ts` per:
  - Fase 1: Leggere `channel_messages` non letti (email + WhatsApp) degli ultimi cicli
  - Fase 2: Per ogni messaggio, chiamare `analyze_incoming_email` per rilevare intent/sentiment
  - Fase 3: Creare `agent_tasks` con assegnazione automatica:
    - Messaggi da partner con agente assegnato → assegna a quell'agente
    - Messaggi nuovi → assegna all'agente outreach/sales del territorio corrispondente
    - Messaggi ad alto impatto (ex-clienti, lead caldi) → status "proposed" (richiede approvazione)

### 3. Aggiungere creazione automatica di attività di follow-up
- Quando un agente completa un task (status → "completed"), creare automaticamente la prossima attività nel circuito d'attesa secondo le regole del holding pattern (reminder +5gg, escalation +7gg, etc.)
- Implementare come trigger DB o logica nell'edge function `agent-execute`

### 4. Migliorare visibilità nella Home
- Aggiungere un badge/contatore nella sidebar per "Coda AI" con il numero di task in attesa di approvazione
- Aggiungere notifica toast quando nuovi task vengono creati dal ciclo autonomo (via realtime già collegato)

## File coinvolti

| File | Modifica |
|------|----------|
| Migrazione SQL | Cron job `*/10 * * * *` per `agent-autonomous-cycle` |
| `supabase/functions/agent-autonomous-cycle/index.ts` | Aggiungere Fase screening messaggi + assegnazione intelligente |
| `src/components/layout/AppSidebar.tsx` | Badge contatore task pending su "Coda AI" |
| `src/components/home/AgentStatusPanel.tsx` | Toast notification su nuovi task |

## Risultato
- Ogni 10 minuti il sistema scansiona nuovi messaggi e follow-up scaduti
- Gli agenti si auto-assegnano il lavoro in base a territorio e responsabilità
- L'utente vede in "Coda AI" le azioni da approvare e in "Team Agenti" chi sta lavorando
- Nessuna azione critica parte senza approvazione umana

