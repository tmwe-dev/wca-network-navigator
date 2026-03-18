

## Riepilogo Completo Funzionalita WCA Partners CRM

### Cosa fa il software oggi

**1. Scaricamento Partner WCA** (Download WCA + Global)
- Connessione alla directory WCA tramite estensione Chrome con auto-login
- Scaricamento profili partner per paese e network con job in background
- Terminale live con log di progresso, velocita, contatori
- Griglia paesi con statistiche: partner, profili scaricati, email, copertura

**2. Rubrica Partner** (Partner Hub)
- Navigazione a 3 livelli: griglia paesi -> workbench paese -> lista partner
- Filtri: network, certificazioni, servizi, rating, membership, "incontrati personalmente"
- Dettaglio partner: contatti, social, rating, servizi, mini-globo 3D
- Deep Search: arricchimento automatico (sito web, logo, servizi, social links)
- Generazione alias per contatti e aziende
- Selezione multipla + azioni bulk (email, deep search, attivita)

**3. Contatti CRM** (Contacts)
- Rubrica contatti importati da CSV/Excel con gruppi
- Timeline interazioni, filtri avanzati, indicatori completezza
- Filtro "incontrati personalmente" (biglietti da visita)

**4. Cockpit** (Outreach multicanale AI)
- 3 tab: GENERA (drag-and-drop su canale), REVISIONA (coda approvazione), PIANIFICA
- Generazione messaggi AI per Email, LinkedIn, WhatsApp, SMS
- Contact stream unificato (WCA + Report Aziende + Import)
- Draft studio con editing e invio

**5. Email Workspace**
- Generazione email AI con 3 livelli qualita (Fast/Standard/Premium)
- Knowledge Base aziendale + profilo partner + documenti di riferimento
- Lista attivita per sorgente (WCA, Prospect, Contatti)
- Deep Search integrata, canvas email con anteprima

**6. Email Composer**
- Editor HTML con variabili dinamiche (company, contact, city, country)
- Selezione destinatari, allegati da template, anteprima live
- Invio diretto SMTP

**7. Campagne** (Globo 3D)
- Selezione partner per paese via globo 3D interattivo
- Filtro per network, invio batch a Campaign Jobs
- Aurora boreale, connessioni animate, marker per paese

**8. Global** (Centro di Comando)
- Chat AI + globo 3D + pannello download attivi
- Comandi in linguaggio naturale per avviare job

**9. Prospect Center**
- Griglia ATECO con ranking automatico
- Importazione da estensione Chrome Report Aziende
- Filtri: fatturato, dipendenti, regione, codice ATECO

**10. Agenda/Reminders**
- Calendario con reminder e priorita
- Tab attivita con gestione batch

**11. Operations (Hub Operativo)**
- Lista attivita per sorgente con stati (pending, in_progress, completed)

**12. Import**
- Upload CSV/Excel con mappatura campi AI
- Normalizzazione dati, validazione, gruppi

**13. Assistente AI** (Segretario Operativo Globale)
- Memoria persistente, piani di lavoro multi-step, template riutilizzabili
- Tool di scrittura: aggiorna partner, crea reminder, note, lead status
- Azioni UI: navigazione, filtri, toast
- Biglietti da visita: cerca e collega

**14. Impostazioni**
- SMTP, credenziali WCA/LinkedIn/RA, template allegati, profilo AI, blacklist, abbonamento

**15. Biglietti da Visita**
- Tabella con matching automatico a partner e contatti
- Indicatori visivi sulle card, filtro "incontrati personalmente"

---

### Il Problema: Troppa Dispersione

Il sistema ha **17+ pagine** con sovrapposizioni significative:
- **Workspace** e **Cockpit** fanno cose simili (generazione email/outreach)
- **Operations (Hub Operativo)** e **Agenda** sono liste attivita con logiche diverse
- **Campaigns** e **Email Composer** sono due modi di inviare email
- **Global** e **Operations (Download WCA)** gestiscono entrambi i download
- **Super Home** e un bel cruscotto ma non e operativo

---

## Piano di Ristrutturazione: 5 Ambienti Essenziali

```text
PRIMA: 17+ pagine                    DOPO: 5 ambienti + Settings
─────────────────────────            ──────────────────────────
Super Home                           1. DASHBOARD (home operativa)
Global                              
Operations (Download)                2. NETWORK (WCA download + rubrica)
Partner Hub                         
Contacts                            3. CRM (contatti + prospect unificati)
Prospect Center                     
Cockpit                             4. OUTREACH (genera + revisiona + invia)
Workspace                           
Email Composer                      
Campaigns                           
Campaign Jobs                       
Sorting                             
Hub Operativo                        5. AGENDA (reminder + attivita + piani AI)
Reminders                           
Import                               → integrato in CRM come tab
Diagnostics                          → integrato in Settings
Guida                                → integrato in Settings
```

### 1. DASHBOARD (`/`)
Unifica Super Home + Global. Una sola home con:
- Statistiche aggregate (partner, contatti, attivita pending, email inviate)
- Globo 3D compatto con stato download attivi
- Quick actions: "Scarica paese", "Genera email", "Crea attivita"
- Feed attivita recenti dell'AI (ultimi piani completati, memorie)
- Chat AI sempre visibile in sidebar

### 2. NETWORK (`/network`)
Unifica Operations (Download) + Partner Hub. Due tab:
- **Tab Download**: griglia paesi, job manager, terminale, deep search bulk
- **Tab Rubrica**: navigazione paesi -> partner, filtri, dettaglio, azioni

### 3. CRM (`/crm`)
Unifica Contacts + Prospect Center + Import. Tre tab:
- **Tab Contatti**: rubrica importata con gruppi e timeline
- **Tab Prospect**: griglia ATECO, filtri finanziari
- **Tab Import**: wizard upload con mappatura AI
Filtri condivisi, biglietti da visita integrati

### 4. OUTREACH (`/outreach`)
Unifica Cockpit + Workspace + Email Composer + Campaigns + Sorting. Il cuore commerciale:
- **Colonna sinistra**: contact stream unificato (tutti i contatti: WCA, prospect, import)
- **Centro**: canvas di generazione (drag-and-drop o click per generare)
- **Destra**: draft studio con preview e editing
- **Barra superiore**: selezione canale (Email/LinkedIn/WhatsApp/SMS), qualita, goal
- **Tab in basso**: "In coda" (bozze da approvare), "Inviate" (storico), "Campagne" (globo 3D batch)
Il sorting diventa un pannello "Revisiona" dentro outreach

### 5. AGENDA (`/agenda`)
Unifica Reminders + Hub Operativo. Due tab:
- **Tab Calendario**: reminder con priorita e scadenze
- **Tab Pipeline**: tutte le attivita per stato (pending/in_progress/completed) con filtri per sorgente

### Sidebar semplificata
```text
┌─────────────────┐
│ ◉ WCA Partners  │
├─────────────────┤
│ 🏠 Dashboard    │
│ 🌐 Network      │
│ 👥 CRM          │
│ ✉️ Outreach     │
│ 📅 Agenda       │
├─────────────────┤
│ ⚙️ Settings     │
│ 🤖 AI (status)  │
│ 🌙 Tema         │
└─────────────────┘
```

### Modifiche tecniche

**File da creare:**
- `src/pages/Dashboard.tsx` — unione SuperHome3D + Global
- `src/pages/Network.tsx` — unione Operations + PartnerHub
- `src/pages/CRM.tsx` — unione Contacts + ProspectCenter + Import
- `src/pages/Outreach.tsx` — unione Cockpit + Workspace + EmailComposer + Campaigns
- `src/pages/Agenda.tsx` — unione Reminders + HubOperativo

**File da modificare:**
- `src/App.tsx` — nuove route, redirect vecchie URL
- `src/components/layout/AppSidebar.tsx` — 5 voci + settings

**File da rimuovere (dopo redirect):**
Le vecchie pagine restano come redirect per compatibilita

**Nessuna modifica al database** — le tabelle restano identiche, cambia solo l'interfaccia

### Vantaggi
- Da 17 pagine a 5: l'utente sa sempre dove andare
- Zero duplicazioni: ogni funzione ha un solo posto
- L'AI assistant resta globale e funziona ovunque
- I componenti esistenti vengono riutilizzati, non riscritti
- Le vecchie URL fanno redirect automatico

