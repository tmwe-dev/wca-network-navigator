---
name: Agenda Action Grouping & Multi-Day
description: Agenda V2 raggruppata per tipo azione, multi-giorno via sidebar, tabs giorni con frecce, filtri attivi visibili
type: feature
---
- Filtri Agenda VIVONO nella sidebar globale "Filtri" (AgendaFiltersSection): MiniCalendar multi-select (`agendaDays: string[]`), Search (cerca anche company/alias/contact/title), Canale, Stato risposta, Priorità.
- Niente filtro "Tipo" (Promemoria/Attività/Follow-up): rimosso, confondeva.
- AgendaPage mostra **tabs giorni** (uno per ogni giorno selezionato) con frecce ‹/›; il giorno attivo alimenta lista+pannello.
- Sotto i tabs c'è una riga **"Filtri attivi:"** con chip rimovibili per Canale, Stato risposta, Search (solo se diversi da default).
- Lista (1/3): cards raggruppate per azione, bordo sinistro colorato per età.
- Pannello (2/3): AgendaActionPanel — contesto + bozza + CTA primaria.
