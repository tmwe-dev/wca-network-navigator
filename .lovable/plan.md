
# Piano: Sidebar come unica fonte — Context Bar in alto

## Principio

Le due sidebar globali (Filtri a sinistra, Mission a destra) sono gli UNICI strumenti per impostare Goal, Proposta, Filtri, e Ricerca. Ogni maschera mostra in alto una **Context Bar** compatta che riflette le scelte attive delle sidebar, senza duplicare i controlli.

## Problema attuale

- **EmailComposer** duplica Goal/Proposta con ContentPicker inline (righe 481-494)
- **EmailComposer** ha un pannello sinistro di ricerca destinatari che dovrebbe stare nella sidebar
- **AIDraftStudio** (Cockpit) duplica Goal/Proposta con ContentPicker
- Nessuna pagina mostra un riepilogo delle scelte attive delle sidebar

## Cosa cambia

### 1. Nuovo componente `ActiveContextBar.tsx`
Barra orizzontale compatta (h-9) sotto l'header di ogni pagina:

```text
┌──────────────────────────────────────────────────────────────────┐
│ 🎯 Acquisizione partner  │ 📝 Servizio LCL...  │ 📧 3 dest.  │ 🔍 2 filtri │
└──────────────────────────────────────────────────────────────────┘
```

- Chips cliccabili: click su Goal/Proposta apre MissionDrawer, click su Filtri apre FiltersDrawer
- Se vuoto: chip grigio "Configura obiettivo →"

### 2. Destinatari nel MissionContext
Estendere `MissionContext` con `recipients[]`, `addRecipient()`, `removeRecipient()`. Spostare la ricerca destinatari nella **MissionDrawer** come nuova sezione.

### 3. Refactor EmailComposer — Layout singola colonna
Rimuovere: pannello sinistro, ResizablePanelGroup, ContentPicker duplicati.

```text
┌─────────────────────────────────────────┐
│ ActiveContextBar (Goal, Proposta, Dest) │
├─────────────────────────────────────────┤
│ Oggetto: [___________________________] │
│ Variabili: {{company}} {{contact}}...   │
│ [       Textarea corpo email         ]  │
│ [✨ Genera con AI]                      │
│ Link + Allegati (collapsible)           │
│ Anteprima (collapsible)                 │
│ [Salva bozza]  [==== Invia a N ====]   │
└─────────────────────────────────────────┘
```

### 4. Rimuovere ContentPicker dal Cockpit AIDraftStudio

### 5. ActiveContextBar in tutte le pagine
EmailComposer, Cockpit, Outreach, CRM — ogni click apre la sidebar giusta.

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/shared/ActiveContextBar.tsx` | **Nuovo** |
| `src/contexts/MissionContext.tsx` | Aggiungere recipients |
| `src/components/global/MissionDrawer.tsx` | Sezione "Destinatari" con ricerca |
| `src/pages/EmailComposer.tsx` | Refactor singola colonna |
| `src/components/cockpit/AIDraftStudio.tsx` | Rimuovere ContentPicker |
| `src/pages/Cockpit.tsx` | Aggiungere ActiveContextBar |
| `src/pages/CRM.tsx` | Aggiungere ActiveContextBar |
