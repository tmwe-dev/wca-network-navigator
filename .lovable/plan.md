

# Piano: Sistema di Supervisione AI, Briefing a 3 Tab e Strategia Operativa

## Panoramica

Tre interventi interconnessi:

1. **Agente Supervisor (Gigi/Felice)** — Assegnare il ruolo di supervisore che verifica contenuti, approva strategie e controlla il rispetto della "Guida Operativa" nella KB.
2. **Briefing Operativo a 3 Tab** — Riprogettare il briefing nella Home con: Effettuato, Da Effettuare, Sospesi/Strategia.
3. **Strategia Operativa nei Settings** — Nuova sezione "Guida Operativa" che definisce regole, quantità, canali, etica — il "manuale" che il Supervisor AI segue.

---

## A. Agente Supervisor e Guida Operativa KB

**A1. Guida Operativa nella KB (`kb_entries`)**
- Inserire un set di card KB predefinite (categoria `operative_guide`) con le regole del circuito d'attesa: fonti dati, quantità giornaliere, canali preferiti, regole etiche, toni, timing follow-up.
- Il Supervisor AI le carica come contesto prima di validare ogni azione degli agenti venditori.

**A2. Sezione Settings "Guida Operativa"**
- Nuovo tab nel Settings: "Guida Operativa" con editor strutturato per le regole (fonti dati, limiti giornalieri, canali, regole etiche, template messaggi).
- Salvataggio come `app_settings` con chiave `operative_strategy` (JSON strutturato).
- Il Supervisor e tutti gli agenti leggono queste regole prima di eseguire.

**A3. Ruolo Supervisor nell'agent-execute**
- Quando un agente Sales genera un draft/azione, prima dell'esecuzione viene creato un task di review per il Supervisor.
- Il Supervisor analizza: conformità alla Guida Operativa, qualità del messaggio, coerenza con la storia del contatto.
- Output: `approved`, `needs_edit` (con suggerimenti), `rejected` (con motivazione).
- L'utente vede il risultato della review nel Command Center e decide se inviare.

---

## B. Briefing Operativo a 3 Tab

Riprogettare `OperativeBriefing.tsx` con tabs:

```text
┌──────────────────────────────────────────────────┐
│  Briefing Operativo                              │
│  [✅ Effettuato] [📋 Da Effettuare] [⏸ Sospesi] │
├──────────────────────────────────────────────────┤
│                                                  │
│  Tab Effettuato:                                 │
│  - Lavoro svolto dagli agenti (ultime 24h)       │
│  - Mail/messaggi inviati dal circuito            │
│  - Contatti totali e copertura                   │
│                                                  │
│  Tab Da Effettuare:                              │
│  - Contatti assegnati per oggi                   │
│  - Task programmati per gli agenti               │
│  - Contatti non ancora nel circuito              │
│                                                  │
│  Tab Sospesi:                                    │
│  - Strategia per domani e futura                 │
│  - Messaggi in attesa di revisione Supervisor    │
│  - Programmazione attività e ricerca             │
│                                                  │
└──────────────────────────────────────────────────┘
```

**B1. Aggiornare `daily-briefing` edge function**
- Aggiungere al contesto: contatti nel circuito d'attesa (count), contatti non ancora nel circuito (count per lead_status), task programmati per oggi, messaggi in arrivo non letti.
- L'LLM genera 3 sezioni separate: `completed`, `todo`, `suspended`.

**B2. Aggiornare `useDailyBriefing` + tipi**
- `DailyBriefing` → aggiungere `completed`, `todo`, `suspended` come sezioni markdown separate.

**B3. Nuovo `OperativeBriefing` con Tabs**
- 3 tab con contenuto specifico per sezione.
- Ogni tab ha le sue azioni contestuali.
- Statistiche in alto: totale contatti, nel circuito, da contattare, programmati oggi.

---

## C. Missione con Task Progressivi

**C1. Estendere il Mission Builder**
- Quando l'utente descrive una missione complessa ("scrivi a tutti entro un mese, usa FindAir..."), il sistema genera automaticamente task progressivi:
  1. Crea lista contatti nel Cockpit
  2. Prepara documenti/allegati
  3. Genera draft per batch
  4. Review Supervisor
  5. Approvazione utente
  6. Invio programmato
- Questi step vengono salvati in `ai_work_plans` con progressione tracciabile.

---

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/home/OperativeBriefing.tsx` | Riscrittura con 3 tab |
| `src/hooks/useDailyBriefing.ts` | Nuovi tipi per 3 sezioni |
| `supabase/functions/daily-briefing/index.ts` | +query circuito, 3 sezioni LLM |
| `src/pages/Settings.tsx` | +tab "Guida Operativa" |
| `src/components/settings/OperativeGuideSettings.tsx` | Nuovo — editor regole |
| `src/components/home/BriefingStatsBar.tsx` | Nuovo — barra statistiche |

---

## Ordine di esecuzione

1. **A2**: Sezione Guida Operativa nei Settings (base per tutto)
2. **B1-B3**: Briefing a 3 tab + edge function aggiornata
3. **A1**: Card KB predefinite per la guida operativa
4. **A3**: Logica Supervisor nella review dei draft
5. **C1**: Task progressivi nel Mission Builder

