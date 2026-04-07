

# Piano Aggiornato: Team AI Autonomo — 7 Sezioni con Ottimizzazioni

Integro i 4 feedback ricevuti nel piano esistente.

---

## Sezione A — 8 Nuovi Tool per gli Agenti

**File**: `supabase/functions/agent-execute/index.ts`

| Tool | Descrizione |
|------|-------------|
| `get_inbox` | Legge `channel_messages` filtrabili per canale, read/unread, partner_id, date range |
| `get_conversation_history` | Timeline unificata per partner/contatto: email + activities + interactions |
| `get_holding_pattern` | Contatti con `lead_status = 'contacted'/'in_progress'`, giorni in attesa, canale usato |
| `update_message_status` | Marca messaggi come letti/processati |
| `get_email_thread` | Thread email raggruppato per `thread_id`, fallback su `in_reply_to` chain, poi subject pulito (strip "Re:/Fwd:") + `from_address`/`to_address` matching |
| `analyze_incoming_email` | Chiede all'AI sentiment/intent/next-step su un messaggio |
| `assign_contacts_to_agent` | Director assegna batch contatti a un agente (via `client_assignments`) |
| `create_campaign` | Crea campagna strutturata con A/B test opzionale |

### Threading robusto (A5)
Il tool `get_email_thread` usa questa cascata:
1. Se `thread_id` presente → raggruppa per `thread_id`
2. Altrimenti, segui la catena `in_reply_to` → `message_id_external`
3. Fallback: subject normalizzato (strip `Re:`, `Fwd:`, `R:`, `I:`) + match su `from_address`/`to_address` invertiti

---

## Sezione B — Context Injection in agent-execute

**File**: `supabase/functions/agent-execute/index.ts`

Portare in `agent-execute` la stessa logica di `ai-assistant`:
- Caricare `app_settings` con prefisso `ai_` (nome, azienda, ruolo, obiettivi, regole, focus corrente)
- Caricare top-5 memorie L2+L3 da `ai_memory`
- Caricare top-5 `kb_entries` globali per priorità
- Iniettare tutto nel system prompt PRIMA della KB dell'agente

Questo unifica la Fase 1 del piano cognitivo con la Sezione B, come suggerito.

---

## Sezione C — Workflow Circuito di Attesa

**File**: `src/data/agentTemplates.ts` — nuova KB entry per ogni ruolo

### Regole differenziate

| Tipo | Follow-up 1 | Follow-up 2 | Escalation |
|------|-------------|-------------|------------|
| **Partner WCA** | +5gg email reminder | +7gg WhatsApp/LinkedIn | +14gg call Robin |
| **Contatto CRM** | +5gg stesso canale | +10gg canale alternativo | +14gg call Robin |
| **Ex-cliente** | +3gg call prioritaria | +7gg proposta speciale | +14gg Director review |

Queste regole vengono codificate come KB entry "Workflow Circuito di Attesa" iniettata nella KB di ogni agente outreach/sales.

---

## Sezione D — Ciclo Autonomo con Auto-Approvazione

**File nuovo**: `supabase/functions/agent-autonomous-cycle/index.ts`

### Auto-Approvazione per Low-Stakes
L'agente autonomo classifica ogni azione proposta in 2 categorie:

| Categoria | Esempio | Approvazione |
|-----------|---------|-------------|
| **Low-stakes** | Follow-up routine su contatto "freddo" (lead_status: new/contacted), reminder scaduto standard | **Auto-approvata** → eseguita direttamente |
| **High-stakes** | Contatto "caldo" (warm/hot), ex-cliente, primo contatto su partner WCA ad alto rating, email con proposta commerciale | **Richiede ok Director** → task con status "proposed" |

### Scheduling a cascata (anti rate-limit)
Invece di svegliare tutti gli agenti simultaneamente:
1. Il ciclo carica gli agenti attivi
2. Li processa **in sequenza** (non in parallelo)
3. Ogni agente ha un **budget per ciclo**: max 10 azioni
4. Se il budget è esaurito, le azioni rimanenti vengono messe in coda per il ciclo successivo
5. Delay di 2-3 secondi tra le chiamate AI per rispettare i rate limit

### Cron job
```sql
SELECT cron.schedule('agent-autonomous-cycle', '0 */1 * * *', ...);
```

---

## Sezione E — KB Completa con Mappa Tool + Campi DB

**File**: `src/data/agentTemplates.ts`

### E1. KB Entry universale "Mappa Strumenti Sistema"
Elenco completo dei 48+ tool con nome esatto, descrizione 1-riga, parametri principali, quando usarlo. Aggiunta automaticamente a TUTTI gli agenti.

### E2. KB Entry universale "Campi Database"
Schema semplificato di: `partners`, `imported_contacts`, `channel_messages`, `activities`, `reminders`, `interactions`, `business_cards`, `campaign_jobs`. Solo i campi operativi (no UUID interni).

### E3. Aggiornamento KB per ruolo
Aggiornamento delle KB entry esistenti per includere i nuovi tool (get_inbox, get_conversation_history, get_holding_pattern, analyze_incoming_email).

---

## Sezione F — Analisi Email in Arrivo

Integrata nel tool `analyze_incoming_email` (Sezione A). L'analisi produce:
- **Sentiment**: positivo / neutrale / negativo
- **Intent**: richiesta info, conferma interesse, rifiuto, OOO, spam, auto-reply
- **Azione suggerita**: follow-up, escalation, close, schedule call
- **Urgenza**: 1-5

Il ciclo autonomo (Sezione D) usa questo tool per analizzare email non lette da contatti nel circuito.

---

## Sezione G — Director Potenziato + Campagne A/B

**File**: `supabase/functions/agent-execute/index.ts` + `src/data/agentTemplates.ts`

### Tool `create_campaign` con A/B Test
```
Parametri:
- name, objective, country_codes[], contact_type (wca/crm/ex_client)
- agent_ids[] (agenti assegnati)
- ab_test: { enabled: true, variants: [
    { agent_id: "...", tone: "formale", percentage: 50 },
    { agent_id: "...", tone: "colloquiale", percentage: 50 }
  ]}
```

La campagna crea i task distribuiti tra gli agenti secondo le percentuali, con un tag `ab_variant` per tracking successivo.

### Aggiornamento prompt Director
Aggiungere istruzioni per:
- Creare piani giornalieri basati sul circuito di attesa
- Usare `assign_contacts_to_agent` per distribuzione per zona/lingua
- Lanciare campagne A/B per testare approcci diversi
- Ricevere solo le proposte high-stakes dal ciclo autonomo

---

## Riepilogo Tecnico

| Sezione | File | Modifiche |
|---------|------|-----------|
| A+F | `agent-execute/index.ts` | +8 tool definitions, +8 executeTool cases |
| B | `agent-execute/index.ts` | +loadUserProfile, +loadMemory, +loadKB (~80 righe) |
| C+E | `agentTemplates.ts` | +3 KB entries universali, +1 KB circuito per ruolo |
| D | `agent-autonomous-cycle/index.ts` | **Nuovo** — ciclo autonomo con auto-approve + cascata |
| G | `agent-execute/index.ts` + `agentTemplates.ts` | +2 tool (assign, campaign) + prompt Director aggiornato |

**Totale**: 1 file nuovo, 2 file modificati. ~10 nuovi tool. 1 cron job.

### Ordine di implementazione
1. **A+B** — Tool + context injection (prerequisito)
2. **E** — KB completa (gli agenti devono sapere cosa possono fare)
3. **C** — Workflow circuito
4. **F** — Analisi email (già nel tool A)
5. **G** — Director + campagne A/B
6. **D** — Ciclo autonomo (dopo che tutto funziona manualmente)

