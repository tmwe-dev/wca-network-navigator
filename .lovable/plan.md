

## Problema

Il `PartnerDetailCompact` (dettaglio singolo partner) ha solo il bottone **Deep Search** standalone. I bottoni **Attività**, **Workspace** e **Email** esistono solo nella `BulkActionBar`, che appare quando selezioni partner con le checkbox nella lista. L'utente si aspetta di poter eseguire tutte le azioni anche sul singolo partner dal dettaglio.

## Piano

### 1. Aggiungere barra azioni nel dettaglio partner (`PartnerDetailCompact.tsx`)

Aggiungere una riga di bottoni nell'header del dettaglio partner con stile glassmorphism lilla coerente con la `BulkActionBar`:
- **Attività** (ClipboardList) — apre il dialog assegnazione attività per quel singolo partner
- **Deep Search** (Sparkles) — già presente, va integrato nella nuova riga
- **Workspace** (Briefcase) — invia il partner al workspace
- **Email** (Send) — naviga all'email composer con quel partner

### 2. Passare i callback necessari (`PartnerHub.tsx`)

Aggiungere props al `PartnerDetailCompact`:
- `onAssignActivity(partnerId)` — apre `AssignActivityDialog` preselezionando quel partner
- `onSendToWorkspace(partnerId)` — chiama la logica esistente per un singolo ID
- `onEmail(partnerId)` — naviga a `/email-composer` con quel partner

### 3. Rimuovere il bottone Deep Search isolato

Sostituire il bottone Deep Search standalone con la nuova barra unificata che include tutte e 4 le azioni nella stessa riga compatta.

### File da modificare
- `src/components/partners/PartnerDetailCompact.tsx` — aggiungere barra azioni unificata
- `src/pages/PartnerHub.tsx` — passare i nuovi callback

