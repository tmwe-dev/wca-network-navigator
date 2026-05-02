---
name: Agenda Action Grouping
description: Agenda layout: filtri in Sheet a scomparsa con linguetta, lista card 1/3 + pannello azione 2/3 a destra. Raggruppata per tipo di azione, bordo sinistro colorato per età.
type: feature
---
Layout `/v2/pipeline/agenda`:
- **Filtri in Sheet a scomparsa** (`AgendaFiltersTab` linguetta sinistra → `Sheet side="left"` con `AgendaCalendarPage`). Niente più sidebar fissa.
- **Pannello sinistro** (1/3 larghezza, min 320px / max 480px): `AgendaDayDetail` con card selezionabili, raggruppate per tipo azione (Da rispondere / Da inviare / Da chiamare / Da decidere). Bordo sinistro colorato per urgenza (rosso >24h, ambra >4h, verde ok).
- **Pannello destro** (2/3 larghezza): `AgendaActionPanel` mostra header partner + canale + età + status, oggetto, contesto/descrizione, azioni rapide (verbo primario contestuale, Rimanda 24h, Delega, Archivia). Empty state se nessuna selezione.
- **Barra chip** sopra la lista (`AgendaActiveFiltersBar`) con filtri attivi rimovibili.
- Helper condivisi in `agendaActionGroups.ts` (ACTION_GROUPS, classifyAction, verbForActivity).
- Selezione card → popola pannello destro (no navigazione fuori pagina). `Apri partner` resta CTA secondaria.
- Menu rapido per riga (Fatto / Rimanda / Delega / Archivia) con `stopPropagation` per non interferire con la selezione.
