

## Analisi: Cockpit vs Workspace vs Sorting

### Ruoli attuali

| Pagina | Cosa fa | Dati | Limite |
|---|---|---|---|
| **Cockpit** | Selezione contatti → drag su canale → AI genera draft | Contatti reali (3 fonti) | Il draft generato **non viene salvato** nel DB, non crea attività, non passa al Sorting |
| **Workspace** | Lista attività `send_email` → configura goal/proposta/documenti → genera email batch → salva su `activities` | Attività esistenti (create da Campaigns o Hub) | Grafica standard, nessun drag-drop, nessuna AI command bar |
| **Sorting** | Coda di revisione: approva, modifica, invia o scarta le email generate dal Workspace | `activities` con `status=pending` e `email_body` non null | Solo revisione, nessuna generazione |

### Flusso attuale (disconnesso)

```text
Campaigns → crea activities → Workspace (genera email) → Sorting (revisiona e invia)
Cockpit → genera draft → NULLA (il draft muore nel componente)
```

Il Cockpit genera email ma non le salva. Il Workspace genera e salva ma non ha la UX premium. Il Sorting solo revisiona. Sono 3 step di un unico funnel frammentato.

### Proposta: Cockpit come centro operativo unificato con 3 modalità

Trasformare il Cockpit in un'unica pagina con **3 tab/modalità** che coprono l'intero funnel, eliminando Workspace e Sorting come pagine separate:

```text
┌─────────────────────────────────────────────────────────┐
│  AI Command Bar + Filtri                                │
├──────────┬──────────────────────┬───────────────────────┤
│          │                      │                       │
│ Contact  │   Tab: GENERA        │   AI Draft Studio     │
│ Stream   │   Tab: REVISIONA     │   (genera / preview   │
│          │   Tab: PIANIFICA     │    / modifica / invia) │
│          │                      │                       │
├──────────┴──────────────────────┴───────────────────────┤
│  Batch Action Bar (approva / invia / scarta)            │
└─────────────────────────────────────────────────────────┘
```

**Tab GENERA** (ex Workspace):
- La colonna centrale mostra i channel drop zones (drag-drop)
- Drag un contatto → AI genera email → salva come `activity` con `email_body`
- Goal bar, documenti, preset integrati nel pannello destro
- Batch generation: seleziona N contatti → genera per tutti

**Tab REVISIONA** (ex Sorting):
- La colonna sinistra filtra solo `activities` con `email_body` e `status=pending`
- La colonna centrale mostra l'anteprima email con edit inline
- Azioni: Approva, Modifica, Invia, Scarta
- Batch: approva/invia tutti i selezionati

**Tab PIANIFICA** (nuovo):
- Crea attività future (chiamate, meeting, follow-up) senza generare email
- Calendario/timeline per scheduling
- Drag contatto → scegli tipo attività → pianifica data

### Collegamento con Campaigns

Attualmente Campaigns crea `activities` e naviga a `/reminders`. Il piano prevede:
- Campaigns → crea activities → redirect a **Cockpit tab GENERA** con filtro `campaign_batch_id`
- Le attività create da Campaigns appaiono automaticamente nel Contact Stream del Cockpit
- L'utente può generare email direttamente, poi passare a tab REVISIONA per approvare e inviare

### File da modificare

1. **`src/pages/Cockpit.tsx`** — Aggiungere sistema a 3 tab (genera, revisiona, pianifica); integrare la logica di generazione email dal Workspace (goal, documenti, preset); integrare la logica di revisione dal Sorting
2. **`src/components/cockpit/GeneratePanel.tsx`** (nuovo) — Colonna centrale per tab GENERA: drop zones + goal bar + batch generation
3. **`src/components/cockpit/ReviewPanel.tsx`** (nuovo) — Colonna centrale per tab REVISIONA: lista job pending + anteprima email + azioni (approva/modifica/invia/scarta)
4. **`src/components/cockpit/AIDraftStudio.tsx`** — Estendere per supportare sia la generazione che la revisione: in modalità genera mostra il draft in tempo reale; in modalità revisiona mostra l'email salvata con edit inline
5. **`src/pages/Campaigns.tsx`** — Cambiare il redirect da `/reminders` a `/cockpit?tab=genera&batch=<id>`
6. **`src/components/layout/AppSidebar.tsx`** — Rimuovere le voci Workspace e Sorting dalla sidebar (diventano tab del Cockpit)
7. **`src/App.tsx`** — Redirect `/workspace` e `/sorting` a `/cockpit` per backward compatibility

### Cosa NON cambia

- L'estetica del Cockpit (glassmorphism, 3 colonne, badge origin, AI command bar) resta identica
- Il Contact Stream resta la colonna sinistra in tutte le modalità
- L'AI Draft Studio resta la colonna destra
- Gli hook esistenti (`useSortingJobs`, `useEmailGenerator`, `useWorkspaceDocuments`) vengono riutilizzati senza modifiche

### Dimensione dell'intervento

- ~600 righe di nuovo codice (2 pannelli centrali)
- ~200 righe di refactoring (Cockpit.tsx + routing)
- 2 pagine eliminate (Workspace.tsx e Sorting.tsx diventano redirect)
- Nessuna migrazione DB necessaria

