

# Ristrutturazione Outreach: Campagne dentro In Uscita + Workflow Attività dal Cockpit

## Struttura Tab Outreach (da 5 a 4)

```text
[Cockpit] [Workspace] [In Uscita] [Attività]
```

**In Uscita** diventa un container con sub-tab interni:
- **Invii Diretti**: l'attuale Sorting (email/azioni uscite da Cockpit/Workspace)
- **Campagne**: l'attuale CampagneTab (coda email_campaign_queue)

Il tab "Campagne" standalone sparisce da Outreach.

## Workflow Attività dal Cockpit/Workspace

Oggi il Cockpit permette solo drag-and-drop sulle drop zone per generare bozze. Manca la possibilità di:

### A) Azioni rapide sul contatto (nuovo pannello/menu)
Cliccando su un contatto nel Cockpit o Workspace, l'utente può:
1. **Segna come svolta** — crea un'attività `completed` immediata (es. "Telefonata fatta"). Tipo attività selezionabile (phone_call, meeting, other). Il contatto esce dalla coda cockpit.
2. **Aggiungi nota** — salva una nota/descrizione sull'attività senza completarla.
3. **Programma** — crea un'attività `pending` con `due_date` futuro. Appare in Agenda. Il contatto esce dal cockpit oggi ma ricompare quando arriva la data.

### B) Attività programmate per oggi nel Cockpit
Il hook `useCockpitContacts` viene esteso per includere anche le attività con `due_date = oggi` e `status = pending`. Queste appaiono nel Cockpit come contatti "di ritorno" con un badge che indica che sono riprogrammate.

### C) Attività completate vanno in In Uscita
Le attività marcate come `completed` (sia da Cockpit che da Workspace) appaiono automaticamente nel tab "Invii Diretti" di In Uscita, che già legge dalla tabella `activities`.

## Modifiche tecniche

### 1. `src/pages/Outreach.tsx`
- Rimuovere tab "Campagne" standalone
- Rinominare tab: Cockpit, Workspace, In Uscita, Attività (4 tab)

### 2. Nuovo `src/components/outreach/InUscitaTab.tsx`
- Container con sub-tab interni: "Invii Diretti" (Sorting) + "Campagne" (CampagneTab)
- Lazy load di entrambi

### 3. `src/pages/Cockpit.tsx` + nuovo componente `ContactActionMenu`
- Aggiungere menu contestuale (click destro o pulsante azioni) su ogni contatto
- Opzioni: "Svolta" (con scelta tipo), "Nota", "Programma" (con date picker)
- Alla conferma: crea activity + rimuove da cockpit_queue (o marca come "worked")

### 4. `src/hooks/useCockpitContacts.ts`
- Estendere la query per includere activities con `due_date = oggi`, `status = pending`, come contatti aggiuntivi nel cockpit
- Questi contatti hanno un flag `isScheduledReturn: true`

### 5. `src/components/sorting/SortingList.tsx`
- Già mostra activities pending con email_body. Nessuna modifica sostanziale, ma il filtro potrebbe includere anche le attività completate (storico invii).

## File coinvolti

| File | Azione |
|------|--------|
| `src/pages/Outreach.tsx` | Ridurre a 4 tab, caricare InUscitaTab |
| `src/components/outreach/InUscitaTab.tsx` | **Nuovo** — sub-tab Invii Diretti + Campagne |
| `src/pages/Cockpit.tsx` | Aggiungere azioni rapide (svolta/nota/programma) sui contatti |
| `src/hooks/useCockpitContacts.ts` | Includere attività programmate per oggi |
| `src/components/cockpit/ContactStream.tsx` | Supportare menu azioni e badge "riprogrammato" |

