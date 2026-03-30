

# Contenuti Categorizzati Riutilizzabili nelle Sezioni Operative

## Problema

I contenuti (Goal e Proposte) sono visualizzati con card categorizzate e icone solo nelle Impostazioni. Nelle sezioni operative (Email Composer, Cockpit/AIDraftStudio, GoalBar del Workspace) si vedono solo Select piatte senza categorie, senza icone, senza possibilità di modifica inline. L'utente deve tornare nelle impostazioni per capire cosa ha.

## Soluzione

Creare un **componente riutilizzabile `ContentPicker`** che mostra goal/proposte raggruppati per categoria (come nel ContentManager delle impostazioni), permette la selezione con un click, e offre modifica inline tramite Dialog — tutto senza uscire dalla pagina operativa.

### Design del ContentPicker

```text
┌─────────────────────────────────────┐
│ [Goal ▼]  [Proposta ▼]             │  ← Popover/Sheet trigger
├─────────────────────────────────────┤
│ ▼ Primo contatto (3)               │
│ ┌──────┐ ┌──────┐ ┌──────┐        │
│ │ 🎯   │ │ 🤝   │ │ 📧   │        │
│ │ Nome │ │ Nome │ │ Nome │        │
│ └──────┘ └──────┘ └──────┘        │
│ ▼ Follow-up (2)                    │
│ ┌──────┐ ┌──────┐                  │
│ │ 🔄   │ │ 📋   │    [✏️ Modifica] │
│ └──────┘ └──────┘                  │
└─────────────────────────────────────┘
```

- Click su card → seleziona e inserisce il testo nel campo attivo
- Icona matita su hover → apre Dialog di modifica (stessa del ContentManager)
- Modifiche salvate immediatamente in `app_settings` (stessa logica)

### Dove viene integrato

1. **GoalBar** (`src/components/workspace/GoalBar.tsx`): Sostituire i Select piatti con il ContentPicker nei tab "Goal" e "Proposta"

2. **EmailComposer** (`src/pages/EmailComposer.tsx`): Aggiungere un pulsante/sezione per selezionare goal e proposta dal ContentPicker prima della generazione AI

3. **AIDraftStudio** (`src/components/cockpit/AIDraftStudio.tsx`): Nel tab "Variables", aggiungere accesso al ContentPicker per cambiare goal/proposta del draft

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/shared/ContentPicker.tsx` | **Nuovo** — componente riutilizzabile con griglia categorizzata in Popover + Dialog modifica inline |
| `src/components/workspace/GoalBar.tsx` | Sostituire i Select con ContentPicker |
| `src/pages/EmailComposer.tsx` | Integrare ContentPicker per selezione goal/proposta |
| `src/components/cockpit/AIDraftStudio.tsx` | Aggiungere ContentPicker nel tab Variables |

Nessuna modifica al database — i dati restano in `app_settings`, la logica di lettura/scrittura è la stessa del ContentManager.

