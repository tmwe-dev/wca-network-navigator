

# Analisi Sidebar + Piano Centro di Comando Header

## PARTE 1: Stato attuale delle Sidebar

### Sidebar SINISTRA (FiltersDrawer) — per sezione

```text
SEZIONE              FILTRI PRESENTI
─────────────────────────────────────────────────────────
Cockpit              Cerca, Ordina, Origine, Paese, Canale, Qualità, Stato lead
Attività             Cerca, Stato, Priorità, Ordina
Workspace            Cerca, Stato email, Contatti
In Uscita            Cerca, Stato coda
Circuito             Cerca, Fase, Ordina
Email Inbox          Cerca, Stato, Categoria, Ordina
WhatsApp Inbox       Cerca, Stato, Ordina
LinkedIn Inbox       Cerca, Stato, Ordina
Network              Cerca, Paesi (checkbox), Qualità, Solo directory
CRM                  Cerca (inline), Paesi (checkbox), Raggruppa+Origine, Ordina, Stato+Circuito, Canale+Qualità
Agenda               Cerca, Tipo, Priorità, Ordina
Email Composer       Rubrica contatti
Altre pagine         Nessun filtro (fallback vuoto)
```

### Sidebar DESTRA (MissionDrawer) — per sezione

```text
SEZIONE              CONTENUTO
─────────────────────────────────────────────────────────
SEMPRE               AI Rapida (input + risposta), Piano Lavori (contatori attività)
Outreach (tutte)     Presets, Quality selector, Goal, Proposta, Docs, Link, Destinatari
Network              Azioni Network: Sync WCA, Deep Search, Alias batch, Export
CRM                  Azioni CRM: Deep Search, LinkedIn, → Cockpit, Export
Settings             Strumenti: Avvia batch, Export
Altre                Solo AI + Piano Lavori + Destinatari
```

### Header attuale (ConnectionStatusBar)

```text
[Menu] [CRM↔Network switch] [ActiveProcess] [⚡ 3/4 attivi ●●●○] [coda outreach]  ...  [Operatore] [Test] [+Contatto] [Sync WCA] [AI ⌘J]
```

Mostra: LinkedIn, WhatsApp, Partner Connect, AI — solo pallini verde/rosso. Nessun contatore messaggi, nessun indicatore circuito, nessun badge notifiche.

## PARTE 2: Problemi identificati

1. **Incoerenze tra sezioni della FilterDrawer**:
   - WhatsApp/LinkedIn/Email inbox hanno filtri quasi identici ma duplicati 3 volte
   - Cockpit ha "Stato lead" ma usa `cockpitStatus`, CRM usa `leadStatus` — stessi valori, variabili diverse
   - Cerca usa `search` in alcune sezioni, `sortingSearch` in altre, `networkSearch` in Network
   - Ordina usa `sortBy` in alcune, `emailSort` in Email, `networkSort` in Network

2. **MissionDrawer poco contestuale**:
   - AI Rapida e Piano Lavori sono sempre visibili ma duplicano IntelliFlow
   - Azioni Network/CRM sono bottoni che emettono custom events — non danno feedback
   - Destinatari sono sempre visibili anche dove non servono (Agenda, Settings)

3. **Header manca informazioni operative critiche**:
   - Nessun contatore messaggi WhatsApp non letti
   - Nessun contatore email in arrivo
   - Nessun badge contatti nel circuito di attesa
   - Nessun indicatore sync in corso (WCA, email)
   - I tasti Sync WCA, Test, + Contatto sono sparsi senza logica

## PARTE 3: Piano di allineamento

### A. Unificare variabili di filtro nel GlobalFiltersContext

Ridurre la frammentazione:
- `search` / `sortingSearch` / `networkSearch` → ognuno resta specifico per contesto (necessario per non interferire tra sezioni) ma il **pattern** nel drawer deve essere identico
- Estrarre i 3 inbox (Email/WA/LinkedIn) in un componente `InboxFiltersSection` condiviso dato che hanno filtri identici

### B. Ristrutturare MissionDrawer

- Rimuovere AI Rapida (c'è già IntelliFlow ⌘J)
- Piano Lavori → spostare nell'header come badge (contatore attività pendenti)
- Destinatari → visibili solo in contesti Outreach/Email Composer
- Azioni contestuali → mantenere ma raggruppare meglio

### C. Centro di Comando Header (la parte più importante)

Trasformare la `ConnectionStatusBar` in un **Command Center** compatto con:

```text
┌─────────────────────────────────────────────────────────────────┐
│ [≡] [Area switch]  [▶ Sync ↻]  [📊 Dashboard rapida]  ... [+] [AI] │
└─────────────────────────────────────────────────────────────────┘
```

Dove **Dashboard rapida** è un cluster di indicatori cliccabili:

```text
┌──────────────────────────────────────────────────────┐
│ ⚡ 3/4  │ 📧 12  │ 💬 5  │ 🔗 2  │ ✈️ 38  │ 📋 3  │
│ attivi  │ email  │  WA   │  LI   │circuito│ to-do │
└──────────────────────────────────────────────────────┘
```

Ogni indicatore:
- **⚡ Connessioni** (esistente) — click → verifica tutte le connessioni
- **📧 Email** — contatore email non lette dal check-inbox — click → naviga a Inreach/Email
- **💬 WhatsApp** — contatore messaggi WA non letti — click → naviga a Inreach/WhatsApp
- **🔗 LinkedIn** — contatore messaggi LI non letti — click → naviga a Inreach/LinkedIn
- **✈️ Circuito** — contatori contatti nel holding pattern — click → naviga a Outreach/Circuito
- **📋 To-do** — attività pendenti — click → naviga a Outreach/Attività

I contatori si aggiornano ogni 60s con query leggere (count only).

Il tasto **Sync** unifica:
- Sync WCA (click singolo)
- Download email (se IMAP configurato)
- Scan WhatsApp (se estensione attiva)
- Indicatore animato quando qualsiasi sync è in corso

### File coinvolti

| File | Modifica |
|------|----------|
| `src/components/layout/ConnectionStatusBar.tsx` | Espandere in CommandCenterBar con contatori messaggi, circuito, attività |
| `src/components/layout/AppLayout.tsx` | Aggiornare riferimenti header, rimuovere tasti sparsi (Sync WCA, Test) integrandoli nel CommandCenter |
| `src/components/global/MissionDrawer.tsx` | Rimuovere AI Rapida, condizionare Destinatari al contesto, compattare |
| `src/components/global/FiltersDrawer.tsx` | Estrarre `InboxFiltersSection` condiviso per Email/WA/LinkedIn |
| `src/hooks/useUnreadCounts.ts` | **Nuovo** — hook che query count non letti per email, WA, LinkedIn + circuito + attività pendenti con polling 60s |

### Priorità di implementazione

1. **`useUnreadCounts`** — hook contatori (prerequisito per tutto)
2. **CommandCenterBar** — sostituzione ConnectionStatusBar con tutti gli indicatori
3. **Pulizia MissionDrawer** — rimuovere duplicati
4. **Unificazione filtri inbox** — refactor cosmetico

