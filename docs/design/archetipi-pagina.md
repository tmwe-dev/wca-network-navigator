# Archetipi di pagina — le 5 famiglie (+ i casi speciali)

Tutte le 91 maschere ricadono in una di queste famiglie. Chi progetta una nuova
pagina sceglie un archetipo: non ne inventa uno.

---

## A. Elenco → Dettaglio  (~15 pagine)

Partner/Network, Contatti, Comms, Inbox, Funnemail, Rubriche WA/LI, Prospects,
RA Explorer, Catalogo prompt, Clienti TMWE.

```text
┌ header ─────────────────────────────────────────────────────┐
├ toolbar: [cerca] [ordina] · 49 aziende · 132 contatti       │
├───────────────────────┬─────────────────────────────────────┤
│ ELENCO (38%)          │ DETTAGLIO (62%)                     │
│ ┌───────────────────┐ │ ┌─ identità ───────────────────────┐│
│ │ ◻ logo  Nome      │ │ │ logo  Nome           [stato]     ││
│ │   contatto · città│ │ │ paese · città · id               ││
│ │   [stato] +2   …  │ │ └──────────────────────────────────┘│
│ └───────────────────┘ │ ┌─ pannelli (max 3 aperti) ────────┐│
│ ...                   │ │ Contatti · Attività · Note       ││
└───────────────────────┴─────────────────────────────────────┘
```

Regole proprie:
- Riga di elenco: **3 righe di testo massimo**, altezza fissa, 5 informazioni.
- La selezione è l'unico elemento con l'accento.
- Il dettaglio ripete l'identità in alto: stessa resa del nome della lista.
- Le azioni di contatto (email/WA/chiama) stanno nel menu «…» della riga e come
  gruppo unico nel dettaglio, **non in entrambi i posti come icone sparse**.

---

## B. Monitor / KPI  (~17 pagine)

Missioni Autopilot, Cockpit, Analytics, KPI, Telemetria, Observability,
Diagnostica, Email Intelligence, Pipeline Traces, Campaign Jobs, Token Cockpit.

```text
┌ header ─────────────────────────────────────────────────────┐
├ toolbar: periodo · filtro stato                             │
├─────────────────────────────────────────────────────────────┤
│ FASCIA KPI — max 4 numeri, stessa card, nessun colore       │
│ ┌────────┬────────┬────────┬────────┐                       │
│ │ 12     │ 3      │ 84%    │ 1.240  │                       │
│ │ attive │ pausa  │ successo│ azioni│                       │
│ └────────┴────────┴────────┴────────┘                       │
├─────────────────────────────────────────────────────────────┤
│ ELENCO / TABELLA dell'oggetto monitorato                    │
├─────────────────────────────────────────────────────────────┤
│ EVENTI recenti (collassabile, chiuso di default)            │
└─────────────────────────────────────────────────────────────┘
```

Regole proprie:
- Massimo 4 KPI. Il quinto va nel dettaglio.
- Le barre di avanzamento sono neutre; il colore compare solo fuori soglia.
- Nessun grafico decorativo: un grafico deve rispondere a una domanda scritta
  nel titolo del pannello.

---

## C. Editor / Configurazione  (~18 pagine)

Config, Persona, Prompt Lab, Strategie Email, Brand Voice, Routing AI,
Alert, Capabilities, Mission Builder, DPA, Admin Users, KB.

```text
┌ header ── titolo ──────────── [✦AI] [Annulla] [Salva] [ … ] ┐
├ toolbar: tab di sezione                                     │
├───────────────────────┬─────────────────────────────────────┤
│ FORM (max 720px)      │ ANTEPRIMA / AIUTO (opzionale)       │
│ sezione               │                                     │
│  etichetta            │                                     │
│  [campo]              │                                     │
│  nota                 │                                     │
└───────────────────────┴─────────────────────────────────────┘
```

Regole proprie:
- Colonna form larga al massimo 720px anche su schermi larghi.
- Salvataggio sempre nell'header, mai in fondo alla pagina.
- Stato «modifiche non salvate» come nota nell'header, non come banner.
- Un solo livello di tab.

---

## D. Flusso operativo  (~12 pagine)

Approvazioni, Sorting, Cestinone, Agenda, Notifiche, Deep Search,
Email Download, RA Scraping, Agent Tasks, Onboarding guidato.

```text
┌ header ─────────────────────────────────────────────────────┐
├ toolbar: [coda: 24] [filtro]                                │
├─────────────────────────────────────────────────────────────┤
│ ELEMENTO CORRENTE — grande, una sola cosa alla volta        │
│  contenuto da decidere                                      │
│  [Azione primaria]  [Secondaria]  [Salta]                   │
├─────────────────────────────────────────────────────────────┤
│ CODA — elenco compatto degli elementi successivi            │
└─────────────────────────────────────────────────────────────┘
```

Regole proprie:
- Una decisione alla volta, con avanzamento visibile (`3 di 24`).
- Le azioni di massa esistono, ma sono nel menu «…»: il default è puntuale.
- Scorciatoie da tastiera dichiarate sotto le azioni.

---

## E. Hub di navigazione  (~13 pagine)

Lab, AI Staff, Agenti, Chi fa cosa, CRM, Guida, Docs, Finder API,
Design System, Brain, Staff.

```text
┌ header ─────────────────────────────────────────────────────┐
├─────────────────────────────────────────────────────────────┤
│ Griglia di card identiche (3 colonne)                       │
│ ┌───────────────┐ ┌───────────────┐ ┌───────────────┐       │
│ │ icona         │ │               │ │               │       │
│ │ Titolo        │ │               │ │               │       │
│ │ una riga      │ │               │ │               │       │
│ └───────────────┘ └───────────────┘ └───────────────┘       │
└─────────────────────────────────────────────────────────────┘
```

Regole proprie:
- Card tutte della stessa altezza, una sola riga di descrizione.
- Nessun KPI dentro un hub: l'hub porta altrove, non informa.
- Le voci «in sviluppo» hanno il badge muted già usato nel menu.

---

## F. Casi speciali (fuori dal template)

| Pagina | Perché | Cosa si applica comunque |
| --- | --- | --- |
| Globo / Mappa | canvas 3D full-bleed | palette e header |
| Campagne (globo) | canvas 3D full-bleed | palette e header |
| Galassia di Sistema | canvas 3D full-bleed | palette e header |
| Command | conversazione full-height | palette, header, tasto AI |
| Login / Auth / Landing / Onboarding | fuori dal guscio autenticato | solo palette |

Su queste pagine si cambia **solo il colore**, mai la struttura.
