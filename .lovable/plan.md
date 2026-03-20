

## Conferma Architettura: Network → CRM → Outreach

### Come Funziona Oggi

```text
┌─────────────────────────────────────────────────────────────┐
│  NETWORK (/network)                                         │
│  ├── Tab "Download WCA" → Scarica profili WCA               │
│  │   Salva in: partners + partner_contacts                  │
│  └── Tab "Rubrica Partner" → Consulta/gestisci partner WCA  │
│       Legge da: partners + partner_contacts                 │
├─────────────────────────────────────────────────────────────┤
│  CRM (/crm)                                                 │
│  ├── Tab "Contatti" → Contatti importati (file, biglietti)  │
│  │   Legge da: imported_contacts + import_logs              │
│  ├── Tab "Prospect" → Aziende italiane (Report Aziende)    │
│  │   Legge da: prospects + prospect_contacts                │
│  └── Tab "Import" → Importa nuovi file CSV/Excel           │
│       Scrive in: imported_contacts                          │
├─────────────────────────────────────────────────────────────┤
│  OUTREACH (/outreach)                                       │
│  ├── Tab "Cockpit AI" → Centro operativo outreach           │
│  │   Legge da: TUTTE E TRE le sorgenti (useCockpitContacts)│
│  │   ├── partner_contacts (origine: "wca")                  │
│  │   ├── imported_contacts (origine: "import")              │
│  │   └── prospect_contacts (origine: "report_aziende")      │
│  ├── Tab "Workspace" → Composizione email con preset        │
│  ├── Tab "Email Composer" → Editor email avanzato           │
│  └── Tab "Campagne" → Invio massivo + globo 3D             │
└─────────────────────────────────────────────────────────────┘
```

### Il Passaggio tra i Contenitori

Il **Cockpit** (dentro Outreach) è il punto di convergenza. L'hook `useCockpitContacts` unifica automaticamente i contatti da tutte e tre le sorgenti:

1. **Da Network**: i `partner_contacts` (collegati ai `partners` WCA) appaiono nel Cockpit con badge blu "WCA"
2. **Da CRM → Contatti**: gli `imported_contacts` appaiono con badge verde "Import"
3. **Da CRM → Prospect**: i `prospect_contacts` appaiono con badge arancione "Report Aziende"

**Non serve nessuna azione manuale** per "spostare" contatti da Network o CRM al Cockpit. Tutti i contatti con un nome valido vengono automaticamente aggregati.

### Cosa NON Esiste Ancora (Potenziale Miglioramento)

Attualmente il Cockpit mostra **tutti** i contatti indistintamente. Non esiste un meccanismo di "selezione esplicita" tipo:
- "Aggiungi questo partner al prossimo giro di outreach"
- "Sposta questo prospect nel mio focus list"

Se vuoi un flusso più controllato dove **decidi tu** quali contatti portare nel Cockpit (invece di vederli tutti), servirebbe un sistema di "staging" o "focus list". Ma al momento il design è: **tutto converge automaticamente nel Cockpit**, filtri e priorità ti aiutano a concentrarti.

### Riepilogo

| Ambiente | Sorgente Dati | Direzione |
|----------|--------------|-----------|
| Network | `partners` + `partner_contacts` | Acquisizione WCA |
| CRM | `imported_contacts` + `prospects` + `prospect_contacts` | Gestione contatti non-WCA |
| Outreach (Cockpit) | Tutte e tre le sorgenti via `useCockpitContacts` | Azione commerciale |

Il sistema è già funzionante così. Se vuoi aggiungere un livello di selezione esplicita (focus list / staging), posso pianificarlo come prossimo step.

