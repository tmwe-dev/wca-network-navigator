

# Piano: Riorganizzazione Pannelli Laterali

## Situazione Attuale

Due pannelli laterali con linguette lilla:
- **Sinistra** (`FiltersDrawer`): Contiene solo "Cerca avanzata" e "Origine dati" -- quasi vuoto e inutile
- **Destra** (`MissionDrawer`): Contiene Mission Control (presets, obiettivi, proposte, docs), azioni contestuali (Sync, Deep Search, Export), destinatari

Inoltre esistono filtri nelle sidebar interne delle pagine (`OutreachFilterSlot`, `CRMFilterSlot`, `NetworkFilterSlot`) che duplicano/confondono.

## Obiettivo

- **Pannello SINISTRO**: Diventa il centro filtri/ordinamenti UNICO e DINAMICO per tutta la piattaforma
- **Pannello DESTRO**: Diventa il centro operativo (piano lavori, attivita, AI, controllo)

## Modifiche

### 1. FiltersDrawer (Sinistra) -- Potenziamento completo

Il pannello sinistro diventa context-aware: rileva la pagina corrente e mostra i filtri appropriati.

**Per ogni pagina mostra:**
- **Outreach/Cockpit**: Cerca, Ordina (Nome/Paese/Priorita/Ultimo/Azienda), Origine (WCA/Import/RA/BCA), Paese (lista dinamica con flag e conteggi), Canale (Email/LI/WA), Qualita (Arricchiti/Alias), Stato lead
- **Outreach/Attivita**: Stato (Todo/Progress/Done), Priorita (Alta/Media/Bassa)
- **Outreach/In Uscita**: Stato coda, ordinamento
- **Outreach/Email|WA|LI**: Letto/Non letto, Categoria, Ordinamento data
- **Outreach/Circuito**: Filtri holding pattern
- **Network**: Cerca, Ordina (Nome/Paese/Contatti/Recenti), Qualita dati (Con email/tel/profilo)
- **CRM**: Cerca, Raggruppa, Ordina, Origine, Stato lead, Circuito, Canale, Qualita
- **Operations/Settings**: Filtri specifici se presenti

Logica: il `FiltersDrawer` importa e renderizza il filterSlot appropriato in base a `location.pathname` e al tab attivo (via `GlobalFiltersContext.outreachTab`).

### 2. MissionDrawer (Destra) -- Aggiunta AI e piano lavori

Il pannello destro mantiene tutto cio che ha gia (presets, obiettivo, proposta, docs, link, azioni contestuali, destinatari) e aggiunge:
- **Sezione AI rapida**: Campo input per comandi AI rapidi (collegato a IntelliFlow/unified-assistant) con risposte inline
- **Sezione Attivita/Piano lavori**: Riepilogo attivita in corso, prossime scadenze, conteggi (da fare/in corso/fatte)
- **Link diretto a IntelliFlow**: Tasto per aprire il workspace completo

### 3. Eliminazione duplicati nelle pagine

Le sidebar interne delle pagine (`VerticalTabNav` con `filterSlot`) NON vengono rimosse -- continuano a funzionare come filtri rapidi in-page. Pero il `FiltersDrawer` sinistro li replica tutti con l'aggiunta di filtri avanzati non presenti nelle sidebar.

In alternativa, se preferisci che i filtri esistano SOLO nel pannello sinistro e le sidebar interne vengano svuotate dei filtri, lo posso fare -- ma perderesti la comodita di avere filtri rapidi visibili senza aprire il pannello.

### File coinvolti

| File | Azione |
|------|--------|
| `src/components/global/FiltersDrawer.tsx` | Riscrittura completa: context-aware, importa filtri per pagina |
| `src/components/global/MissionDrawer.tsx` | Aggiunta sezioni AI e piano lavori |
| `src/contexts/GlobalFiltersContext.tsx` | Eventuale aggiunta stato `outreachTab` se non gia esposto |

