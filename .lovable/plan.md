# Piano: Sidebar come unica fonte — Context Bar in alto

## Principio

Le due sidebar globali (Filtri a sinistra, Mission a destra) sono gli UNICI strumenti per impostare Goal, Proposta, Filtri, e Ricerca. Ogni maschera mostra in alto una **Context Bar** compatta che riflette le scelte attive delle sidebar, senza duplicare i controlli.

## Problema attuale

- **EmailComposer** duplica Goal/Proposta con ContentPicker inline (righe 481-494)
- **EmailComposer** ha un pannello sinistro di ricerca destinatari che dovrebbe stare nella FiltersDrawer
- **AIDraftStudio** (Cockpit) duplica Goal/Proposta con ContentPicker
- Nessuna pagina mostra un riepilogo delle scelte attive delle sidebar

## Cosa cambia

### 1. Nuovo componente `ActiveContextBar.tsx`
Barra orizzontale compatta (h-9) da posizionare sotto l'header di ogni pagina. Mostra:

```text
┌──────────────────────────────────────────────────────────┐
│ 🎯 Acquisizione nuovi partner  │ 📝 Servizio LCL...  │ 📧 3 destinatari  │ 🔍 2 filtri attivi │
└──────────────────────────────────────────────────────────┘
```

- Chips cliccabili: click su Goal/Proposta apre MissionDrawer, click su Filtri apre FiltersDrawer
- Chips removibili con X (es. rimuovi un destinatario)
- Se nessuna selezione: chip grigio "Configura obiettivo →"

### 2. Aggiungere "Destinatari" alla MissionContext
Estendere `MissionContext` con:
- `recipients: SelectedRecipient[]`
- `addRecipient / removeRecipient`
- Ricerca destinatari spostata nella **MissionDrawer** come nuova sezione "Destinatari"

### 3. Refactor EmailComposer
Rimuovere:
- Pannello sinistro ResizablePanel (ricerca + lista destinatari)
- Sezione "Contesto AI" con ContentPicker duplicati
- ResizablePanelGroup (non serve piu)

Il composer diventa **full-width, singola colonna**:
```text
┌─────────────────────────────────────────┐
│ ActiveContextBar (Goal, Proposta, Dest) │
├─────────────────────────────────────────┤
│ Oggetto: [___________________________] │
│ Variabili: {{company}} {{contact}}...   │
│                                         │
│ [       Textarea corpo email         ]  │
│ [                                    ]  │
│                                         │
│ [✨ Genera con AI]                      │
│                                         │
│ Link + Allegati (collapsible)           │
│                                         │
│ Anteprima (collapsible)                 │
│                                         │
│ [Salva bozza]  [==== Invia a N ====]   │
└─────────────────────────────────────────┘
```

### 4. Refactor AIDraftStudio (Cockpit)
Rimuovere ContentPicker duplicati per Goal/Proposta — leggere da `useMission()` e mostrare nella ActiveContextBar.

### 5. ActiveContextBar in tutte le pagine
Inserire `ActiveContextBar` in: EmailComposer, Cockpit, Outreach, CRM. Ogni click apre la sidebar appropriata.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/shared/ActiveContextBar.tsx` | **Nuovo** — barra compatta con chips |
| `src/contexts/MissionContext.tsx` | Aggiungere recipients state |
| `src/components/global/MissionDrawer.tsx` | Aggiungere sezione "Destinatari" con ricerca |
| `src/pages/EmailComposer.tsx` | Rimuovere pannello sinistro e ContentPicker, layout singola colonna |
| `src/components/cockpit/AIDraftStudio.tsx` | Rimuovere ContentPicker duplicati |
| `src/pages/Cockpit.tsx` | Aggiungere ActiveContextBar |
| `src/pages/CRM.tsx` | Aggiungere ActiveContextBar |
| `src/components/outreach/WorkspaceTab.tsx` | Aggiungere ActiveContextBar (se presente) |

## Risultato
- Zero duplicazioni di controlli tra sidebar e maschere
- Ogni pagina mostra in alto cosa e' selezionato
- Un click sulla Context Bar apre la sidebar giusta
- Email Composer pulito e focalizzato solo sulla composizione