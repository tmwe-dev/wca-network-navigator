

## Riorganizzazione Navigazione e Pagine

### Situazione attuale (problemi)
- **WCA duplicato**: c'e' una sezione WCA nelle Impostazioni che rimanda a una pagina `/wca` separata -- ridondante
- **Export/Import**: pagina dedicata per operazioni rare, spreca un posto in sidebar
- **Reminders**: si chiama "Reminders" invece di "Agenda"
- **Due dashboard**: Partner Hub e' gia' la home, non ci sono conflitti reali ma la voce "WCA" e "Export" nella sidebar creano confusione

### Cosa cambia

**Sidebar semplificata** -- da 7 voci a 4:

```text
Prima:                    Dopo:
Partner                   Partner
Campaigns                 Campaigns
Download                  Download
Reminders                 Agenda
Export                    Impostazioni
Impostazioni
WCA
```

**Pagina Impostazioni** -- diventa un hub con 3 sezioni via Tabs:
1. **Generale** -- WhatsApp e altre configurazioni
2. **WCA** -- tutta la gestione WCA (sincronizza, verifica, cookie manuale) integrata direttamente, non piu' un link esterno
3. **Import / Export** -- CSV import, export CSV/JSON, scarica da WCA (tutto il contenuto attuale della pagina Export)

**Rotte eliminate**:
- `/wca` -- rimossa (contenuto integrato in Settings)
- `/export` -- rimossa (contenuto integrato in Settings)

### Dettagli tecnici

| File | Azione |
|------|--------|
| `src/pages/Settings.tsx` | Riscrittura con Tabs: Generale, WCA (contenuto di WCA.tsx inline), Import/Export (contenuto di Export.tsx inline) |
| `src/components/settings/WcaSessionCard.tsx` | Aggiornamento: rimuovere il link "Gestisci Connessione WCA" (non serve piu'), integrare direttamente i pulsanti di sync e cookie |
| `src/components/layout/AppSidebar.tsx` | Rimuovere le voci "Export" e "WCA", rinominare "Reminders" in "Agenda" |
| `src/App.tsx` | Rimuovere le rotte `/wca` e `/export`, rimuovere gli import di WCA e Export |

### La pagina Impostazioni dopo il refactor

```text
Impostazioni
Configurazione della piattaforma

[Generale] [WCA] [Import / Export]

--- Tab Generale ---
  Card WhatsApp (invariata)

--- Tab WCA ---
  Status badge (Connesso / Non connesso)
  [Apri WCA World e Sincronizza]  (bottone primario)
  Istruzioni estensione Chrome
  [Verifica Sessione]
  Ultimo controllo: ...
  > Inserimento manuale cookie (emergenza) (collapsible)

--- Tab Import / Export ---
  [Importa] [Esporta] [Scarica da WCA]  (sotto-tabs)
  Contenuto identico alla pagina Export attuale
```

### Indicatore WCA nella sidebar
L'indicatore semaforo WCA in fondo alla sidebar resta invariato -- continua a funzionare e a linkare a `/settings` (che ora contiene la gestione WCA completa).
