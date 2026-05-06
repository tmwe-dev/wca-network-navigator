
`CLASSE: STANDARD — OBIETTIVO: Aggiungere un Kanban "Agenda per Reparto" che riusa l'estetica e l'interazione di ContactPipelineView, mostrando i job (activities) raggruppati per reparto invece che per lead_status.`

## Cosa costruire

Una nuova vista Kanban dentro la sezione Agenda esistente, che chiamiamo **"Reparti"**, con 4 colonne fisse corrispondenti alle 4 agende del documento:

```
COMMERCIALE  |  OPERATIVO  |  AMMINISTRATIVO  |  SERVIZI GENERALI
```

Ogni card è un job (`activities`). Drag-and-drop fra colonne aggiorna il reparto del job. Stessa estetica del Kanban Pipeline (icona + label colorata per colonna, badge contatore, card draggable con grip).

Niente nuove pagine, niente 4 agende separate. Solo una nuova tab dentro `/v2/agenda`.

---

## Dove vive

`src/v2/ui/pages/sections/AgendaSection.tsx` ha già 3 tab (Agenda, Pipeline, Duplicati). Ne aggiungiamo una:

```
Agenda  |  Reparti  |  Pipeline  |  Duplicati
```

La tab **Reparti** punta a `/v2/agenda/reparti` e renderizza il nuovo componente.

---

## Schema dati (modifica minima)

Aggiungiamo una colonna `department` su `activities`:

```sql
ALTER TABLE activities ADD COLUMN department text
  CHECK (department IN ('commercial','operations','admin','general'))
  DEFAULT NULL;
CREATE INDEX idx_activities_department ON activities(department) WHERE deleted_at IS NULL;
```

Nessuna migrazione di dati: tutti i job esistenti restano `NULL` finché qualcuno non li sposta o finché il decision→job converter (P1 §4 del backlog) non li scrive valorizzati. La quinta colonna virtuale **"Da assegnare"** mostra i job con `department IS NULL`.

Quindi le colonne effettive del Kanban sono **5**:

```
DA ASSEGNARE | COMMERCIALE | OPERATIVO | AMMINISTRATIVO | SERVIZI GENERALI
```

---

## Componente nuovo

`src/v2/ui/pages/agenda/DepartmentKanbanView.tsx` — copia 1:1 della struttura di `ContactPipelineView`, con questi adattamenti:

- `STAGES` → `DEPARTMENTS` con icone: `Briefcase` (Commerciale), `Truck` (Operativo), `Receipt` (Amministrativo), `Wrench` (Servizi), `HelpCircle` (Da assegnare)
- Query: legge `activities` (via DAL `findAllActivities` esteso o nuova funzione `findActivitiesForKanban`) invece di `imported_contacts`. Filtra solo job non completati/cancellati.
- `PipelineContact` → `JobCard` con `{ id, title, partner_name, priority, due_date, department, activity_type }`
- Card mostra: titolo, azienda partner, badge priorità (P0/P1/P2/P3 — già allineata al P0 del backlog), data scadenza in formato relativo
- Drag-and-drop chiama `updateActivityDepartment(id, newDept)` (nuovo DAL) → UPDATE su `activities.department`
- Stessa palette colore (muted, blue, amber, indigo, purple), stesso `border-2 border-dashed` su drag-over

---

## Hook + DAL

- `src/data/activities.ts`: aggiungere `findActivitiesForKanban()` e `updateActivityDepartment(id, dept)`. Invalidate `activityKeys.all` dopo update.
- `src/hooks/useActivitiesKanban.ts`: thin wrapper React Query.
- `src/lib/queryKeys.ts`: aggiungere `queryKeys.activities.kanban()` (no inline keys).

---

## Cosa NON tocchiamo

- `AgendaPage` esistente (vista lista per giorno) resta identica
- `ContactPipelineView` resta identico (Kanban lifecycle clienti)
- Nessuna modifica a `cadence-engine`, `funnemail-classify`, edge AI
- Nessuna modifica all'enum `activity_type` (uso `department` come dimensione ortogonale)

---

## Verifica post-implementazione

1. Migrazione DB applicata, RLS invariata (eredita policy `activities`)
2. Tab "Reparti" appare in `/v2/agenda` e carica
3. Card draggabili fra le 5 colonne, persistenza su refresh
4. Job esistenti compaiono tutti in "Da assegnare"
5. Nessuna regressione su Agenda/Pipeline/Duplicati esistenti

---

## Fuori scope (lo facciamo dopo, sono i punti P1 del backlog approvato)

- Decision→Job converter (popolerà `department` automaticamente)
- Bottone "Lo prendo io" sulla card (richiede colonne `claimed_by/claimed_at`)
- Filtro per priorità nel Kanban (arriva con la standardizzazione P0-P3)

Ti basta approvare e parto con la migrazione + componente.
