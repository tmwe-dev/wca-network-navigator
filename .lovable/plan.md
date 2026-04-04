
# Piano Ristrutturazione: Sidebar Dinamiche + Allineamento CRM

## Stato Attuale
- **VerticalTabNav** (sinistra, 140px): Usata in Settings, Outreach, CRM solo come navigazione tab. NON ospita filtri/ordinamenti contestuali.
- **FiltersDrawer** (sinistra, Sheet overlay): Filtri globali che si adattano per route, ma è un overlay, non integrato nella sidebar.
- **MissionDrawer** (destra, Sheet overlay): Obiettivi, proposte, destinatari — overlay generico, non contestuale alla sezione.
- **Arricchimento**: Ha i propri filtri interni (sidebar sinistra custom da 220px), ma il "LinkedIn Batch" compare sempre. Nessun bottone azione funzionante.
- **CRM**: Grafica minimale, non allineata al Network (che ha 3 colonne: Paesi → Partner → Dettaglio).

## Piano d'Azione

### FASE 1: VerticalTabNav Potenziata con Filtri Contestuali
Estendere `VerticalTabNav` per ospitare sotto i tab anche un **filterSlot** (già previsto nel codice ma MAI usato!) che ogni pagina può popolare dinamicamente.

**Pagine da aggiornare:**
1. **Settings**: Aggiungere filtri contestuali nel filterSlot per ogni sezione (es. Arricchimento → filtri fonte/stato dati inline)
2. **Outreach**: Spostare filtri da FiltersDrawer al filterSlot quando pertinenti (es. Email → filtri email, Cockpit → filtri cockpit)
3. **CRM**: Aggiungere filtri inline (Stato lead, Origine, Raggruppamento)

### FASE 2: Fix Arricchimento
1. **Rimuovere sidebar custom interna** — usare il filterSlot di VerticalTabNav
2. **LinkedIn Batch contestuale** — mostrare solo quando fonte = "Contatti Importati" o "Tutti"
3. **Aggiungere azioni batch per ogni fonte:**
   - WCA Partner → Cerca Logo batch, Cerca LinkedIn batch
   - Contatti Importati → LinkedIn batch (esistente), Deep Search batch
   - Mittenti Email → Risolvi identità batch
   - Cockpit → Arricchisci selezione
4. **Stats contestuali** che cambiano in base ai filtri attivi

### FASE 3: MissionDrawer Contestuale (Destra)
Rendere il contenuto del MissionDrawer dinamico in base alla pagina:
- **Network**: Azioni partner (Deep Search, Invia a Cockpit, Export)
- **CRM/Contatti**: Azioni contatto (LinkedIn lookup, Deep Search, Interazioni)
- **Outreach/Cockpit**: Azioni outreach (Draft email, Call, WhatsApp)
- **Settings/Arricchimento**: Azioni batch (Avvia batch, Stop, Export risultati)
- Sezione Destinatari sempre presente (come ora)

### FASE 4: Allineamento Visivo CRM con Network
1. **CRM Contatti**: Passare da layout ResizablePanel a layout 3 colonne stile Network:
   - Colonna 1: Lista gruppi/origini (compatta, come i paesi nel Network)
   - Colonna 2: Lista contatti (come partner list nel Network)
   - Colonna 3: Dettaglio contatto (come partner detail nel Network)
2. **CRM Biglietti**: Allineare cards e gruppi aziendali allo stile Network
3. **Stili uniformi**: Stessi bordi, spaziature, header e badge tra Network e CRM

### FASE 5: Pulizia
1. Eliminare i filtri duplicati tra FiltersDrawer e filterSlot
2. Rendere FiltersDrawer un "filtro avanzato" per filtri secondari
3. Rimuovere codice Arricchimento inline (220px sidebar interna)

## Ordine di Esecuzione
1. ~~Fase 2~~ **Fix Arricchimento** (priorità assoluta — niente funziona)
2. **Fase 1** VerticalTabNav + filterSlot (infrastruttura)
3. **Fase 4** Allineamento CRM
4. **Fase 3** MissionDrawer contestuale
5. **Fase 5** Pulizia finale
