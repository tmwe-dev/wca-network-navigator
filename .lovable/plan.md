

# Piano: Centro Operativo Circuito d'Attesa + Contesto Outreach

## Panoramica

Due interventi collegati:

1. **Holding Pattern Command Center** — Riprogettare il tab "Circuito" (✈️) come centro operativo con messaggi in arrivo a sinistra (3 tab: Email/WhatsApp/LinkedIn) e strategia AI a destra (3 tab: Messaggio proposto / Strategia / Azioni), con approvazione singola e bulk.

2. **Contesto Outreach** — Aggiungere un campo "Contesto" al MissionContext (perché stiamo scrivendo: fiera, trovato online, referral, ecc.) che l'AI usa per generare messaggi pertinenti e personalizzati.

---

## Struttura UI del Circuito rinnovato

```text
┌─────────────────────────────────────────────────────────────┐
│  Circuito di Attesa (✈️)                    [Approva Tutti] │
├────────────────────────┬────────────────────────────────────┤
│  ┌──────────────────┐  │  ┌──────────────────────────────┐  │
│  │ Email│WA│LinkedIn│  │  │ Risposta│Strategia│Azioni    │  │
│  ├──────────────────┤  │  ├──────────────────────────────┤  │
│  │                  │  │  │                              │  │
│  │ Lista messaggi   │  │  │ Draft AI proposto            │  │
│  │ in arrivo dai    │  │  │ + analisi sentiment/intent   │  │
│  │ contatti nel     │  │  │ + history conversazione      │  │
│  │ circuito         │  │  │                              │  │
│  │                  │  │  │ [✓ Approva] [✎ Modifica]     │  │
│  │ (badge: nuovo,   │  │  │ [✗ Ignora]  [→ Escalation]  │  │
│  │  circuito ✈️)    │  │  │                              │  │
│  └──────────────────┘  │  └──────────────────────────────┘  │
└────────────────────────┴────────────────────────────────────┘
```

---

## Dettaglio implementativo

### A. Holding Pattern Command Center

**A1. Nuovo componente `HoldingPatternCommandCenter.tsx`**
- Sostituisce l'attuale `HoldingPatternTab` (che resta come fallback)
- Layout split 50/50: pannello messaggi + pannello strategia AI

**A2. Pannello sinistro — Messaggi in arrivo**
- 3 sub-tab (Email / WhatsApp / LinkedIn) filtrati per contatti che hanno `lead_status` in holding pattern
- Query su `channel_messages` con JOIN verso `partners` e `imported_contacts` per verificare appartenenza al circuito
- Badge conteggio non letti per tab
- Click su messaggio → carica history conversazione e trigger analisi AI

**A3. Pannello destro — Strategia AI (3 sub-tab)**
- **Risposta**: Draft di risposta generato dall'AI basato su history, KB, profilo contatto
- **Strategia**: Analisi AI (sentiment del messaggio ricevuto, intent rilevato, suggerimento prossimo step nel workflow holding pattern)
- **Azioni**: Bottoni operativi (Approva e Invia, Modifica, Ignora, Cambia stato, Escalation)

**A4. Bulk Approval**
- Toolbar superiore con "Approva tutti" che approva le risposte AI pending
- Checkbox per selezione multipla dei messaggi

**A5. Hook `useHoldingMessages`**
- Recupera messaggi da `channel_messages` dove il contatto è nel circuito
- Incrocia `partner_id` / `source_id` con la lista holding pattern
- Ordina per data, raggruppa per contatto

**A6. Hook `useHoldingStrategy`**
- Dato un messaggio selezionato, invoca edge function (o AI gateway) per generare:
  - Risposta proposta
  - Analisi sentiment/intent
  - Suggerimento azione successiva basato sulle regole del circuito (reminder +5gg, escalation +7gg, ecc.)

### B. Contesto Outreach

**B1. Estendere `MissionContext`**
- Nuovo campo `context: string` + `setContext`
- Esempi: "Incontrato alla fiera di Milano del 15 marzo", "Trovato online nel settore logistica", "Referral da partner XYZ"

**B2. Aggiornare `MissionDrawer`**
- Nuova sezione "Contesto" con textarea + suggerimenti rapidi (chip cliccabili: "Fiera", "Trovato online", "Referral", "Ex-cliente", "Cold outreach")

**B3. Iniettare contesto nelle Edge Function**
- `generate-outreach` e `agent-execute` ricevono il campo `context` nel payload
- Il prompt AI include il contesto come istruzione primaria: "Stai scrivendo perché: {context}"

**B4. Aggiornare `WorkspacePreset`**
- Salvare/caricare il campo `context` nei preset per riuso

### C. Persistenza (opzionale, fase 2)
- Colonna `context` nella tabella `outreach_missions` (già esistente) per storicizzare il contesto per missione
- Le risposte AI approvate dal Command Center vengono inserite in `activities` + `outreach_queue`

---

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/outreach/HoldingPatternCommandCenter.tsx` | Nuovo — layout split |
| `src/hooks/useHoldingMessages.ts` | Nuovo — query messaggi circuito |
| `src/hooks/useHoldingStrategy.ts` | Nuovo — AI strategy per messaggio |
| `src/components/outreach/HoldingPatternTab.tsx` | Sostituito dall'import del nuovo componente |
| `src/contexts/MissionContext.tsx` | +campo `context` |
| `src/components/global/MissionDrawer.tsx` | +sezione Contesto |
| `src/hooks/useOutreachGenerator.ts` | Passare `context` al payload AI |

---

## Ordine di esecuzione

1. **B1-B2**: Contesto nel MissionContext + MissionDrawer (veloce, impatto immediato)
2. **B3**: Iniezione contesto nelle edge function
3. **A1-A2**: Pannello messaggi holding pattern
4. **A3-A4**: Pannello strategia AI + bulk approval
5. **A5-A6**: Hook dati e AI strategy

