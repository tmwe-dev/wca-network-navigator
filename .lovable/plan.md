

# Piano: Audit Completo + 3 Proposte di Redesign UI

## Fase 1 — Inventario Completo del Sistema

### Pagine Attive (escl. Global e Campaigns)

| Pagina | Route | Contenuto | Componenti principali |
|--------|-------|-----------|----------------------|
| **SuperHome3D** | `/` | Dashboard AI con briefing, agenti, nav cards, stato sistema | HomeAIPrompt, OperativeBriefing, AgentStatusPanel, ActiveJobsWidget |
| **Network** | `/network` | Tab: Partner + Biglietti da visita. VerticalTabNav + sidebar filtri | Operations (PartnerHub), BusinessCardsHub, NetworkFilterSlot |
| **CRM** | `/crm` | Tab: Contatti + Biglietti. VerticalTabNav + sidebar filtri | Contacts (ContactListPanel + ContactDetailPanel), BusinessCardsHub, CRMFilterSlot |
| **Outreach** | `/outreach` | 7 tab verticali: Cockpit, In Uscita, Attività, Circuito, Email, WhatsApp, LinkedIn | Cockpit (ContactStream + DropZones + AIDraftStudio), AttivitaTab, InUscitaTab, HoldingPatternTab, Email/WA/LI InboxViews |
| **Agenda** | `/agenda` | Calendario mese/settimana/giorno con reminder e attività | Vista calendario integrata |
| **Agents** | `/agents` | Lista agenti + dettaglio. Layout master-detail | AgentCard, AgentDetail, CreateAgentDialog |
| **AgentChatHub** | `/agent-chat` | Chat con agenti AI | — |
| **Settings** | `/settings` | 10 tab verticali: Generale, Contenuti, Connessioni, Voce AI, Import/Export, Download Email, Report Aziende, Arricchimento, Abbonamento, Operatori | Componenti settings specializzati |
| **EmailComposer** | `/email-composer` | Composizione email | — |
| **RA** | `/ra/*` | Report Aziende: Dashboard, Explorer, Scraping, Company Detail | Moduli RA dedicati |

### Shell e Navigazione

- **AppLayout**: Header fisso (56px) + sidebar hamburger (220px slide-out) + 2 drawer laterali lilla (Filtri sx, Mission dx) + FAB IntelliFlow
- **VerticalTabNav**: Usato in Network, CRM, Outreach, Settings (140px, icone + label + badge)
- **FiltersDrawer**: Pannello sinistro context-aware (filtri dinamici per pagina)
- **MissionDrawer**: Pannello destro (piano lavori, AI rapida, mission control)

### Connessioni API / Edge Functions

- `cockpit-assistant`, `ai-assistant`, `super-assistant` (AI)
- `daily-briefing` (briefing operativo)
- `wca-scraper`, `wca-deep-search` (download/arricchimento)
- `linkedin-lookup`, `generate-outreach` (outreach)
- `enrich-logo`, `enrichment` (arricchimento dati)
- `email-send`, `email-download` (email)

### Problemi Strutturali Identificati

1. **Duplicazione**: Business Cards appare sia in Network che in CRM
2. **Frammentazione Outreach**: 7 sotto-tab dentro una sola pagina — troppa complessità nascosta
3. **Home sovraccarica**: Briefing + Agenti + Jobs + Nav + Stato — non risponde alla domanda "cosa devo fare adesso?"
4. **Cockpit rigido**: Layout a 3 colonne fisse (lista 380px + drop zone + draft) — non si adatta al flusso reale
5. **Navigazione incoerente**: Hamburger menu + VerticalTabNav + 2 drawer lilla + FAB — 5 punti di interazione
6. **Settings monstre**: 10 tab — molte raramente usate, mescolate con strumenti operativi (Download Email, Arricchimento)

---

## Fase 2 — Tre Proposte di Redesign

Tutte seguono i 15 principi indicati. Ogni proposta verrà implementata come **prototype navigabile** con componenti reali (non mockup statici), accessibile da una pagina `/prototype-A`, `/prototype-B`, `/prototype-C`.

---

### Proposta A — "Focus Flow"
**Filosofia**: Una schermata principale, un pannello dinamico, zero navigazione superflua.

```text
┌──────────────────────────────────────────┐
│  [≡]  WCA Partners    [🔍] [⚡AI] [⚙]  │  ← Header minimo
├──────────────────────────────────────────┤
│                                          │
│   ┌─────────────────────────────────┐    │
│   │  AZIONE PRINCIPALE              │    │  ← Campo AI centrale
│   │  "Cerca partner, scrivi email,  │    │     (come Spotlight/Raycast)
│   │   trova contatto..."            │    │
│   └─────────────────────────────────┘    │
│                                          │
│  [Outreach]  [Network]  [Contatti]       │  ← 3 tab orizzontali
│  ─────────────────────────────────────   │
│  │                    │              │   │
│  │  Lista principale  │  Dettaglio/  │   │  ← Master-detail fluido
│  │  (cards compatte)  │  Draft/AI    │   │
│  │                    │              │   │
│  └────────────────────┴──────────────┘   │
│                                          │
│  [Filtri rapidi in-line]    [Stato: ●●○] │  ← Footer con stato sistema
└──────────────────────────────────────────┘
```

**Caratteristiche**:
- Nessun menu laterale — tutto accessibile da 3 tab + barra AI
- Filtri inline sotto i tab (chips espandibili)
- Dettaglio si apre a destra come pannello scorrevole
- Agenda integrata come widget nel dettaglio contatto
- Settings accessibili solo da icona ⚙ (drawer)
- Max 3 click per qualsiasi operazione

---

### Proposta B — "Command Center"
**Filosofia**: Dashboard operativa con pannelli modulari riorganizzabili.

```text
┌──────────────────────────────────────────┐
│  [≡]  WCA Partners         [👤] [⚙]    │
├────┬─────────────────────────────────────┤
│ N  │                                     │
│ a  │  ┌──────────┐ ┌──────────┐         │
│ v  │  │ Briefing  │ │ Pipeline │         │  ← Widget modulari
│    │  │ AI        │ │ Outreach │         │
│ r  │  └──────────┘ └──────────┘         │
│ a  │  ┌──────────┐ ┌──────────┐         │
│ i  │  │ Contatti  │ │ Agenda   │         │
│ l  │  │ recenti   │ │ oggi     │         │
│    │  └──────────┘ └──────────┘         │
├────┤                                     │
│ 🔍 │  [Ricerca globale unificata]       │
└────┴─────────────────────────────────────┘
```

**Caratteristiche**:
- Sidebar icone stretta (48px) sempre visibile — 5 icone: Home, Contatti, Outreach, Agenda, Settings
- Home = dashboard widget (briefing + pipeline + contatti recenti + agenda oggi)
- Contatti = vista unificata Network+CRM con filtro sorgente
- Outreach = Cockpit semplificato (lista + draft, senza drop zone — si clicca e si sceglie canale)
- Ricerca globale sempre accessibile in basso nella sidebar
- Pannello destro slide-in per dettagli

---

### Proposta C — "Conversational Workspace"  
**Filosofia**: L'AI governa tutto. L'interfaccia è una conversazione con pannelli proiettati.

```text
┌──────────────────────────────────────────┐
│  WCA Partners              [●] [⚙]      │
├──────────────────────────────────────────┤
│                                          │
│  ┌─────────────────────────────────┐     │
│  │  💬 Cosa vuoi fare?             │     │  ← Prompt AI primario
│  │  "Mostra partner italiani"      │     │
│  └─────────────────────────────────┘     │
│                                          │
│  ┌──────────────────────────────────┐    │
│  │  PANNELLO PROIETTATO             │    │  ← L'AI proietta il contenuto
│  │  (tabella, cards, draft, mappa)  │    │     richiesto in questo spazio
│  │                                  │    │
│  │  [Filtri contestuali]            │    │
│  └──────────────────────────────────┘    │
│                                          │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐           │
│  │ 📊 │ │ 📧 │ │ 👥 │ │ 📅 │           │  ← Scorciatoie rapide
│  └────┘ └────┘ └────┘ └────┘           │     (accesso diretto)
│                                          │
│  [Cronologia azioni]     [Stato: ● live] │
└──────────────────────────────────────────┘
```

**Caratteristiche**:
- Interfaccia quasi senza navigazione tradizionale — l'AI è il router
- 4 scorciatoie in basso per accesso diretto (Network, Email, Contatti, Agenda)
- Ogni scorciatoia apre un pannello contestuale nello spazio centrale
- Cronologia azioni sempre visibile (cosa hai fatto, cosa devi fare)
- Filtri appaiono solo quando servono, contestuali al pannello attivo
- Settings minimali (drawer da icona ⚙)
- Versione estrema del principio "1 schermata + 1 pannello dinamico + AI"

---

## Fase 3 — Implementazione Prototipi

Ogni proposta sarà un componente React completo con:
- Navigazione funzionante
- Dati reali (stessi hook esistenti)
- Componenti riutilizzati dove possibile (cards, liste, filtri)
- Route dedicate: `/prototype-a`, `/prototype-b`, `/prototype-c`
- Un selettore in home per passare da uno all'altro

### File da creare

| File | Descrizione |
|------|-------------|
| `src/pages/PrototypeA.tsx` | Shell "Focus Flow" |
| `src/pages/PrototypeB.tsx` | Shell "Command Center" |
| `src/pages/PrototypeC.tsx` | Shell "Conversational Workspace" |
| `src/components/prototypes/FocusFlowShell.tsx` | Layout + tab + master-detail |
| `src/components/prototypes/CommandCenterShell.tsx` | Sidebar icone + widget grid |
| `src/components/prototypes/ConversationalShell.tsx` | Prompt AI + pannello proiettato |
| `src/components/prototypes/shared/` | Componenti condivisi tra prototipi (UnifiedContactList, QuickFilters, MiniAgenda) |

### File da modificare

| File | Modifica |
|------|----------|
| `src/App.tsx` | Aggiunta 3 route prototipi |
| `src/pages/SuperHome3D.tsx` | Link/selector per provare i prototipi |

Stima: ogni prototipo è una shell funzionante con dati reali, non un mockup. L'utente potrà navigare, cercare, filtrare e vedere i dati nelle 3 strutture diverse per decidere quale adottare.

