

# Unificare Cockpit e Workspace in un unico ambiente

## Concetto

Cockpit e Workspace fanno essenzialmente la stessa cosa con due modalita':
- **Cockpit**: drag-and-drop 1-a-1 su drop zone canale, genera bozza AI, azioni rapide (svolta/nota/programma)
- **Workspace**: lista attivita' per source type, generazione batch email, email canvas con anteprima

Si fondono in un **unico Cockpit** che supporta entrambe le modalita' operative. La tab "Workspace" sparisce da Outreach.

## Struttura risultante di Outreach

```text
[Cockpit] [In Uscita] [Attività] [Circuito]
```

Da 5 tab a 4.

## Nuovo Cockpit unificato

Il layout resta a 3 colonne ma diventa piu' flessibile:

### Colonna sinistra — Lista contatti unificata
- **Source tabs** (WCA / Prospect / Contatti) come nel Workspace attuale
- Lista contatti dalla `cockpit_queue` + attivita' pending per il source selezionato
- Supporta: selezione multipla, drag-and-drop, azioni rapide (svolta/nota/programma)
- Checkbox + select all/deselect

### Colonna centrale — Area di lavoro duale
- Se **nessun contatto selezionato o drag attivo**: mostra le **ChannelDropZones** (drag-and-drop per generazione 1-a-1)
- Se **contatti selezionati + click "Genera"**: mostra l'**EmailCanvas** (anteprima/modifica email batch)
- Transizione fluida tra le due viste

### Colonna destra — AIDraftStudio
- Rimane come oggi: anteprima bozza AI dopo drag-and-drop
- Quando si usa la modalita' batch, mostra il progresso della generazione

### Barra azioni in alto (TopCommandBar unificata)
Fonde la TopCommandBar del Cockpit con la action bar del Workspace:
- Source tabs (WCA/Prospect/Contatti)
- Deep Search (singola e bulk)
- Genera (singola e bulk)
- Elimina selezionati
- Progresso batch/deep search

## Modifiche tecniche

| File | Azione |
|------|--------|
| `src/pages/Cockpit.tsx` | Integrare logica Workspace: source tabs, batch generation, EmailCanvas nella colonna centrale |
| `src/pages/Outreach.tsx` | Rimuovere tab Workspace, passare da 5 a 4 tab |
| `src/components/cockpit/TopCommandBar.tsx` | Aggiungere source tabs + pulsanti batch (Genera, Deep Search, Elimina) |
| `src/components/cockpit/ContactStream.tsx` | Aggiungere source tab filtering, supporto attivita' pending |

File **non piu' necessari** (ma non eliminati per sicurezza):
- `src/pages/Workspace.tsx` — non piu' referenziato
- `src/components/workspace/ContactListPanel.tsx` — logica migrata nel ContactStream

Nessuna modifica al database.

