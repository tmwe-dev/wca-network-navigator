

# Piano: Download Experience Center + Agenda Potenziata

## Panoramica

Tre interventi principali:

1. **Download Experience Popup** — Pagina dedicata (Dialog fullscreen) che raccoglie TUTTO il download in un unico posto, con menu per scegliere la vista live
2. **Agenda Potenziata** — Copia e migliora l'agenda del repo con design moderno + due visualizzazioni (cards profilo e lista riga per riga)
3. **Menu Vista Live** — Durante il download, l'utente sceglie cosa vedere: Terminal, Agenda Partner, o Profili Live in tempo reale

---

## 1. Download Experience Popup

**Cosa**: Un Dialog/Sheet fullscreen che si apre quando c'è un download attivo. Contiene tutto: progress bar, controlli (pausa/stop/resume), e le 3 viste selezionabili.

**File nuovi**:
- `src/components/download/DownloadExperienceDialog.tsx` — Container principale con:
  - Header: paese, progress %, contatori, controlli
  - Menu vista: 3 bottoni icona (Terminal | Agenda | Profili Live)
  - Area contenuto che mostra la vista selezionata

**Componenti vista**:
- **Terminal** → Riusa `DownloadTerminal` esistente (embedded, non dialog)
- **Agenda Partner** → Nuovo `DownloadAgendaView.tsx` — lista partner scaricati con dati chiave (nome, email, tel, network), filtri, stato completamento
- **Profili Live** → Nuovo `LiveProfileCards.tsx` — tabs orizzontali scorrevoli con card per ogni profilo appena scaricato (logo, nome, contatti, network badges). Ispirato alle "scraped tabs" del repo `index.html`

**Integrazione in Operations.tsx**: Il bottone Download apre il DownloadExperienceDialog invece del DownloadCanvas attuale.

---

## 2. Agenda Potenziata

**Cosa**: Rifare `src/pages/Agenda.tsx` con design premium e due modalità di visualizzazione dei partner/attività.

**Modifiche**:
- `src/pages/Agenda.tsx` — Redesign con glassmorphism, header con stats animati, tab migliorate
- `src/components/agenda/AgendaCardView.tsx` — Vista a card dei partner con foto/logo, dati principali, badge network, indicatore completezza
- `src/components/agenda/AgendaListView.tsx` — Vista tabellare compatta riga per riga con tutte le colonne (azienda, città, email, tel, network, stato, data)
- Toggle vista (card/lista) nell'header dell'agenda
- Migliorare `ActivitiesTab.tsx` con design coerente (glassmorphism, animazioni, colori gradient)

---

## 3. Menu Vista Live nel Download

**Cosa**: Dentro il DownloadExperienceDialog, un selettore a 3 opzioni:

| Vista | Icona | Descrizione |
|-------|-------|-------------|
| Terminal | `Terminal` | Log tecnico in tempo reale (esistente) |
| Agenda | `ListTodo` | Lista partner scaricati con dati, filtri, ricerca |
| Profili | `Eye` | Card profilo per ogni partner appena processato |

L'utente cambia vista in qualsiasi momento durante il download. La vista Profili Live mostra l'ultimo partner scaricato in evidenza + storico scorrevole.

---

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/download/DownloadExperienceDialog.tsx` | **NUOVO** — Container principale popup download |
| `src/components/download/DownloadAgendaView.tsx` | **NUOVO** — Vista agenda partner scaricati |
| `src/components/download/LiveProfileCards.tsx` | **NUOVO** — Vista profili live con tabs |
| `src/components/download/DownloadTerminal.tsx` | **MODIFICA** — Estrarre versione embedded (non solo dialog) |
| `src/pages/Operations.tsx` | **MODIFICA** — Sostituire DownloadCanvas con DownloadExperienceDialog |
| `src/pages/Agenda.tsx` | **MODIFICA** — Redesign completo con 2 viste |
| `src/components/agenda/AgendaCardView.tsx` | **NUOVO** — Vista card partner |
| `src/components/agenda/AgendaListView.tsx` | **NUOVO** — Vista lista riga per riga |
| `src/components/agenda/ActivitiesTab.tsx` | **MODIFICA** — Upgrade design |

---

## Design

- Glassmorphism coerente con il resto del sistema (`glass-panel`, `backdrop-blur`)
- Profili Live: card con bordo gradient animato per il profilo in corso, badge colorati per network
- Agenda: header con contatori animati (totale, con email, con tel, completati)
- Transizioni Framer Motion tra le viste

