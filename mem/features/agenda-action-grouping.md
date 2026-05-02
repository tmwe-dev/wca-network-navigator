---
name: Agenda Action Grouping
description: Agenda usa la sidebar globale Filtri (giorno, canale, risposta, tipo, priorità). Layout pagina = lista card 1/3 + pannello azione 2/3.
type: feature
---
**Filtri Agenda → sidebar globale** (`AgendaFiltersSection` in `src/components/global/filters-drawer/`):
- Calendario mensile, Cerca, Canale (Tutti/Email/WA/LI/Chiamate/Note), Stato risposta, Tipo, Priorità.
- Persistenza in `GlobalFiltersContext` su `agendaChannel`, `agendaResponse`, `agendaDay` (oltre ai pre-esistenti `agendaType`, `agendaPriority`, `search`).
- `useFiltersDrawerState.isAgenda` riconosce sia `/v2/agenda` sia `/v2/pipeline/agenda`. `activeCount` e `handleResetAll` includono i 3 nuovi filtri.

**Layout `/v2/pipeline/agenda`** (`src/v2/ui/pages/AgendaPage.tsx`):
- Pannello sinistro 1/3 (min 320 / max 480 px): `AgendaDayDetail` — card raggruppate per tipo azione (Da rispondere / Da inviare / Da chiamare / Da decidere), bordo sinistro colorato per età (rosso >24h, ambra >4h, verde ok). Card selezionabile.
- Pannello destro 2/3: `AgendaActionPanel` — header partner+canale+età+status, oggetto, contesto, azioni rapide (verbo primario + Rimanda 24h + Delega + Archivia).
- Helper condivisi in `agendaActionGroups.ts` (ACTION_GROUPS, classifyAction, verbForActivity).
- Niente sidebar locale né barra-chip locale: solo la sidebar globale del sistema.
