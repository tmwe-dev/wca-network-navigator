

# Gestione Contatti, Partner Hub e Sincronizzazione Workspace

## Stato implementazione

### ✅ Fase 4 — source_meta JSONB (COMPLETATA)
- Aggiunta colonna `source_meta jsonb DEFAULT '{}'::jsonb` alla tabella `activities`
- Tipo `SourceMeta` definito in `useActivities.ts`
- Popolato automaticamente durante la creazione attività da:
  - **Contatti importati** (`contacts/ContactListPanel.tsx`)
  - **Partner WCA** (`AssignActivityDialog.tsx`)
  - **Prospect RA** (`ProspectListPanel.tsx`)

### ✅ Fase 1 — Fix Workspace per sorgenti polimorfiche (COMPLETATA)
- `workspace/ContactListPanel.tsx`: ricerca, raggruppamento e display usano `getDisplayFields()` che legge `source_meta` con fallback su `partners`
- `workspace/EmailCanvas.tsx`: header email usa `source_meta` per country/city/company quando `partners` è null
- `Workspace.tsx`: Deep Search filtrato solo per partner_id non null con messaggio utente

### ✅ Fase 2 — Pipeline Prospect → Workspace (COMPLETATA)
- `ProspectListPanel.tsx`: aggiunta selezione multipla con checkbox e pulsante "Workspace (N)"
- Crea attività con `source_type: 'prospect'`, `source_meta` completo (company, email, city, country=Italia)
- Il tab "Prospect" nel Workspace ora mostra correttamente le attività create

### 🔲 Fase 3 — Refactoring file grandi (DIFFERITA)
- `ContactListPanel.tsx` (contacts, 627 righe) → da splittare in ContactCard, GroupStrip, ExpandedGroupContent
- `PartnerHub.tsx` (692 righe) → da splittare in PartnerListSidebar
- Differito per evitare regressioni nell'iterazione corrente
