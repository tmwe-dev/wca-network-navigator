

## Analisi: Come si integrano i tre sistemi e proposta di separazione

### Le tre origini dati oggi

```text
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│  OPERATIONS/WCA  │    │  PROSPECT CENTER │    │   CONTATTI       │
│  (partners)      │    │  (prospects)     │    │ (imported_contacts)│
│                  │    │                  │    │                   │
│ Tabella: partners│    │ Tabella: prospects│   │ Tab: imported_    │
│ Contatti: partner│    │ Contatti: prospect│   │     contacts      │
│  _contacts       │    │  _contacts       │   │                   │
│ Origin: WCA      │    │ Origin: Report   │   │ Origin: file CSV  │
│                  │    │  Aziende         │   │  (import_logs)    │
└────────┬─────────┘    └────────┬─────────┘   └────────┬──────────┘
         │                       │                       │
         ▼                       ▼                       ▼
┌──────────────────────────────────────────────────────────────────┐
│                     ACTIVITIES (tabella unica)                   │
│  partner_id → partners.id                                        │
│  activity_type: send_email | phone_call | meeting | follow_up    │
│                                                                  │
│  ⚠️ PROBLEMA: partner_id e' FK verso "partners" soltanto        │
│  → prospects e imported_contacts NON possono creare activities   │
└──────────────────────────────────────────────────────────────────┘
         │
         ▼
┌──────────────────────────────────────────────────────────────────┐
│                     WORKSPACE                                     │
│  Filtra activities con status != completed e type = send_email    │
│  Genera email usando partner data + partner_contacts              │
│  ⚠️ Funziona SOLO con dati da "partners"                         │
└──────────────────────────────────────────────────────────────────┘
```

### Il problema tecnico centrale

La tabella `activities` ha `partner_id UUID NOT NULL` che punta a `partners`. Questo significa:

1. **Partner Hub / Operations** → Seleziono partner → `AssignActivityDialog` crea activity con `partner_id` → Workspace le legge con join su `partners(company_name, ...)` e `partner_contacts(email, ...)` → Genera email → Funziona perfettamente.

2. **Prospect Center** → I prospect vivono nella tabella `prospects` con contatti in `prospect_contacts`. NON possono creare activities perche' `partner_id` non punta a `prospects`.

3. **Contatti (imported_contacts)** → Il `send_to_workspace` che abbiamo appena implementato tenta di matchare per `company_name` con `partners` e creare activity. Se il match fallisce, l'activity non viene creata. I contatti importati da CSV che non esistono in WCA **non possono entrare nel Workspace**.

### Come funziona oggi il flusso job per origine

| Passaggio | Partners (WCA) | Prospects (RA) | Imported Contacts |
|-----------|---------------|----------------|-------------------|
| Selezione | Partner Hub multi-select | ProspectCenter (non ha assign) | Contacts AI command |
| Assign Job | `AssignActivityDialog` → `activities` | Non supportato | `send_to_workspace` (match fragile) |
| Workspace | Legge `activities` + `partners` join | Non accessibile | Solo se match riesce |
| Email gen | `partner_contacts` + `partners.enrichment_data` | N/A | N/A |
| Campaign | `campaign_jobs` (partner_id) | N/A | N/A |

### Proposta: Architettura a 3 contesti con pipeline unificata

L'idea dell'utente e' corretta: separare i tre contesti ma mantenere la stessa UX operativa. Servono due cambiamenti architetturali:

**Opzione A — Tabella `activities` polimorfica** (consigliata)

Aggiungere alla tabella `activities`:
- `source_type TEXT` → `'partner'` | `'prospect'` | `'contact'`
- `source_id UUID` → ID generico (partner_id, prospect_id, o imported_contact_id)
- Rendere `partner_id` nullable (backward compatible)

Il Workspace legge `source_type` e fa il join corretto. Il generatore email adatta il contesto.

**Opzione B — Hub di navigazione con 3 sotto-workspace**

Una pagina "Centro Operativo" con 3 tab:
- Tab WCA → filtra activities dove source=partner
- Tab Prospect → filtra activities dove source=prospect  
- Tab Contatti → filtra activities dove source=contact

Stessi componenti (`EmailCanvas`, `QualitySelector`, `GoalBar`), diverso data source.

### Riepilogo problemi attuali

1. **`activities.partner_id` non nullable** → prospects e imported_contacts esclusi dal workflow
2. **Workspace join hardcoded** su `partners` + `partner_contacts` → non legge altre origini
3. **`campaign_jobs.partner_id`** → stessa limitazione per le campagne
4. **`send_to_workspace` in ContactListPanel** → match per company_name fragile, fallisce se il contatto non esiste in `partners`
5. **Nessun `AssignActivityDialog` equivalente** per prospects e imported_contacts

### Prossimi passi suggeriti

La separazione richiede una migrazione DB (rendere `partner_id` nullable, aggiungere `source_type`/`source_id`) e refactoring del Workspace. E' un intervento strutturale che va pianificato in modo dedicato. Vuoi che prepari il piano di implementazione completo?

