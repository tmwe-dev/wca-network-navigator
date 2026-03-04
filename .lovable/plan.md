

## Piano: Pagina Contatti Commerciali con Circuito di Attesa

### Visione d'insieme

Creare una nuova sezione **"Contatti"** (`/contacts`) dedicata alla gestione dei contatti commerciali importati, con un sistema di **circuito di attesa (holding pattern)** che traccia il ciclo di vita di ogni lead: dall'ingresso nel sistema fino alla conversione in cliente. La pagina seguirà lo stesso pattern architetturale di Partner Hub e Prospect Center.

---

### 1. Schema Database — Nuove colonne e tabella

**a) Aggiungere campi di stato al record `imported_contacts`:**

```sql
ALTER TABLE imported_contacts
  ADD COLUMN lead_status text NOT NULL DEFAULT 'new',
  ADD COLUMN deep_search_at timestamptz,
  ADD COLUMN last_interaction_at timestamptz,
  ADD COLUMN interaction_count integer NOT NULL DEFAULT 0,
  ADD COLUMN converted_at timestamptz;
```

I valori di `lead_status` saranno: `new` → `contacted` → `in_progress` → `negotiation` → `converted` → `lost`.

**b) Tabella `contact_interactions`** per tracciare la history/pedigree di ogni contatto:

```sql
CREATE TABLE contact_interactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  contact_id uuid NOT NULL REFERENCES imported_contacts(id) ON DELETE CASCADE,
  interaction_type text NOT NULL, -- 'email_sent', 'phone_call', 'whatsapp', 'meeting', 'deep_search', 'campaign', 'note'
  title text NOT NULL,
  description text,
  outcome text, -- 'positive', 'neutral', 'negative'
  created_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid
);

ALTER TABLE contact_interactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "auth_contact_interactions_all" ON contact_interactions FOR ALL
  USING (auth.uid() IS NOT NULL) WITH CHECK (auth.uid() IS NOT NULL);
```

---

### 2. Nuova Pagina `/contacts` — `src/pages/Contacts.tsx`

Layout a due pannelli (come Partner Hub):

**Pannello sinistro — Lista raggruppata:**
- **Barra filtri superiore:** ricerca globale, filtro per origine, paese, status lead, periodo (date range), deep search (sì/no), con alias (sì/no)
- **Raggruppamento dinamico:** selettore per raggruppare per Paese (default), Origine, Status, Data importazione
- **Card compatte** per ogni contatto (riutilizzo pattern `CompactContactCard` con aggiunta di badge status e indicatore circuito di attesa)
- **Multi-selezione** con checkbox (riutilizzo `useSelection`)
- **Bulk action bar:** Deep Search, Crea Attività, Crea Campagna, Cambia Status, WhatsApp

**Pannello destro — Dettaglio contatto:**
- Anagrafica completa con icone social (WhatsApp, email, telefono)
- **Circuito di attesa visuale:** un indicatore grafico a fasi (stepper orizzontale/ovale) che mostra lo status corrente nel percorso: New → Contacted → In Progress → Negotiation → Converted
- **Timeline interazioni:** cronologia di tutte le interazioni (email, chiamate, deep search, campagne, note) ordinate per data
- Pulsanti azione: Cambia Status, Nuova Interazione, Deep Search, Invia a Partner Hub

---

### 3. Circuito di Attesa — Componente Visuale

`src/components/contacts/HoldingPatternIndicator.tsx`

Un componente visuale che rappresenta il percorso del lead con fasi colorate:
- **New** (grigio) → **Contacted** (blu) → **In Progress** (ambra) → **Negotiation** (viola) → **Converted** (verde)
- Lo status `lost` mostra un badge rosso separato
- La fase attiva è evidenziata, le precedenti mostrano una spunta
- Click su una fase permette di aggiornare lo status

---

### 4. Hook Dati — `src/hooks/useContacts.ts`

- `useContacts(filters)` — query con filtri combinati (paese, origine, status, date range, ricerca)
- `useContactDetail(id)` — dettaglio singolo con interazioni
- `useContactInteractions(contactId)` — timeline interazioni
- `useUpdateLeadStatus()` — mutation per aggiornare status
- `useCreateContactInteraction()` — mutation per aggiungere interazione
- `useContactDeepSearch()` — lancio deep search per contatti importati (invoca `deep-search-partner` adattato o crea un endpoint dedicato)

---

### 5. Integrazione con il Sistema Esistente

- **Sidebar:** aggiungere voce "Contatti" nella sezione "Gestione" con icona `UserCheck`
- **Router:** aggiungere rotta `/contacts` in `App.tsx`
- **Deep Search:** riutilizzare il runner globale `useDeepSearchRunner`, adattando la logica per cercare dati di contatti importati (website, social links)
- **Attività:** riutilizzare `useCreateActivities` esistente, linkando al `contact_id` tramite il campo `description` o un nuovo campo nullable
- **Campagne:** integrazione con il flusso email esistente

---

### 6. File da Creare/Modificare

| File | Azione |
|------|--------|
| `src/pages/Contacts.tsx` | **Nuovo** — Pagina principale |
| `src/components/contacts/ContactListPanel.tsx` | **Nuovo** — Lista raggruppata con filtri |
| `src/components/contacts/ContactDetailPanel.tsx` | **Nuovo** — Dettaglio + timeline |
| `src/components/contacts/HoldingPatternIndicator.tsx` | **Nuovo** — Visualizzazione circuito di attesa |
| `src/components/contacts/ContactInteractionTimeline.tsx` | **Nuovo** — Timeline interazioni |
| `src/components/contacts/ContactFiltersBar.tsx` | **Nuovo** — Barra filtri avanzata |
| `src/hooks/useContacts.ts` | **Nuovo** — Hook dati contatti |
| `src/App.tsx` | **Modifica** — Aggiungere rotta `/contacts` |
| `src/components/layout/AppSidebar.tsx` | **Modifica** — Aggiungere voce menu |
| Migration SQL | **Nuovo** — Aggiunta colonne + tabella interazioni |

---

### 7. Coerenza con le Tre Sezioni

Le tre sezioni (WCA/Partner Hub, Report Aziende/Prospect Center, Contatti Commerciali) condividono:
- Stesso pattern visuale: pannello lista + pannello dettaglio
- Stessa logica di raggruppamento per paese con bandiere
- Stessi filtri di qualità dati (email, telefono, deep search)
- Stesso sistema di bulk actions
- Stesso circuito di attesa (in futuro estendibile anche a Partner e Prospect)

La differenza è la **fonte dati**: `partners` per WCA, `prospects` per Report Aziende, `imported_contacts` per Contatti Commerciali.

