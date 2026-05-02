## Obiettivo

Trasformare la pagina **Agenda** (`/v2/pipeline/agenda`) da layout a 2 colonne fisse (sidebar fissa con calendario+filtri / lista attività) a un layout **a 2 pannelli operativi** dove i filtri vivono in una **sidebar a scomparsa** (Sheet con linguetta), come da convenzione del sistema.

```text
┌─────────────────────────────────────────────────────────────────────────┐
│ Header sezione (Kanban · Duplicati · Campagne · Agenda)                 │
├──┬──────────────────────────────────────────────────────────────────────┤
│ ║│  ┌──────────────────────┐  ┌────────────────────────────────────┐    │
│ ║│  │  CARD ATTIVITÀ (1/3) │  │  PANNELLO AZIONE (2/3)             │    │
│ ║│  │                      │  │                                    │    │
│ ║│  │  ✉ Acme Logistics    │  │  Oggetto: "Quote request"          │    │
│ ║│  │  IT · BCA · ★87      │  │  ───────────────────────────────   │    │
│ ║│  │  Da 2g · in ritardo  │  │  [thread / contesto / draft]       │    │
│ ║│  │  Ultimo: "Quote..."  │  │                                    │    │
│ ║│  │  [score · canale]    │  │                                    │    │
│ ║│  │  ─────────────────   │  │  ───────────────────────────────   │    │
│ ║│  │  ✉ MSC Italy         │  │  [Rispondi] [Rimanda] [Archivia]   │    │
│ ║│  │  ...                 │  │  [Apri partner ↗]                  │    │
│ ║│  └──────────────────────┘  └────────────────────────────────────┘    │
│ ║│                                                                      │
│ └─ linguetta ⚙ Filtri (apre Sheet con calendario + tipo + stato)        │
└─────────────────────────────────────────────────────────────────────────┘
```

`║` = linguetta laterale (`SidebarFiltersTab`) sempre visibile sul bordo sinistro che apre/chiude lo Sheet dei filtri. Quando lo Sheet è chiuso, **tutto lo spazio** della pagina è dedicato all'operatività.

## Struttura nuova

### 1. Sidebar a scomparsa (`AgendaFiltersSheet`)
Contiene tutto ciò che oggi sta nella colonna sinistra fissa:
- Calendario mensile con badge giorni
- Sezione "Tipo attività" (Tutti / Email / WhatsApp / LinkedIn / Chiamate / Note)
- Sezione "Stato risposta" (Tutti / Ha risposto / Non ha risposto)
- Pulsante "Reset filtri"

Pattern: usa `<Sheet side="left">` di shadcn (stesso pattern di `EntityFiltersDrawer`). Larghezza ~320px. Si apre cliccando la linguetta a bordo pagina.

Sopra la lista, una **barra compatta** mostra i filtri attivi (es. "Sabato 2 Mag · Email · Non ha risposto") con chip rimovibili — così l'utente sa sempre cosa sta vedendo senza riaprire lo Sheet.

### 2. Pannello sinistro — Card attività (1/3 larghezza)
Lista verticale scrollabile di card più ricche di quelle attuali. Ogni card mostra (a colpo d'occhio, niente apertura modale):
- **Riga 1**: bandiera · nome partner · badge BCA/Top · score commerciale (★87)
- **Riga 2**: icona canale · contatto coinvolto · "da 2g fa" con colore urgenza
- **Riga 3**: titolo/subject pulito (1 riga troncata)
- **Riga 4**: ultima azione registrata o snippet ultimo messaggio (italics, muted)
- **Bordo sinistro** colorato (rosso/giallo/verde) per urgenza — già presente
- **Card selezionata**: highlight + bordo primary

Raggruppamento per tipo di azione (Da rispondere / Da inviare / Da chiamare / Da decidere) **mantenuto** come oggi, con header sezione collassabile.

### 3. Pannello destro — Azione operativa (2/3 larghezza)
Il vero "tavolo di lavoro". Quando l'utente seleziona una card a sinistra, qui appare:
- **Header**: partner + canale + età richiesta + status badge
- **Contesto**: ultimo thread/messaggio ricevuto (per email/WA/LI), oppure note recenti, BCA badge se presente
- **Bozza pronta**: se l'AI ha già generato una risposta (campagna / autopilot), preview editabile inline
- **Azioni rapide a piè pagina**:
  - Primaria: `Rispondi ora` / `Chiama ora` / `Invia` (dipende dal tipo azione)
  - Secondarie: `Rimanda 24h` · `Delega` · `Archivia` · `Apri partner ↗`
- **Empty state**: se nessuna card selezionata → "Seleziona un'attività a sinistra per agire"

### 4. Linguetta filtri (`SidebarFiltersTab`)
Pulsante verticale fisso sul bordo sinistro della pagina (icona ⚙ + label "Filtri" ruotato 90°), allineato con il pattern già usato altrove nel sistema. Mostra un **dot rosso** quando ci sono filtri attivi diversi da default.

## Mapping ai file

- `src/v2/ui/pages/AgendaPage.tsx` — riscrittura layout: rimuove la colonna fissa 240px, aggiunge `<Sheet>` + linguetta + split 1/3 – 2/3
- `src/components/agenda/AgendaCalendarPage.tsx` — convertito/rinominato in `AgendaFiltersSheet.tsx` (stesso contenuto, ma pensato per stare dentro uno Sheet)
- `src/components/agenda/AgendaDayDetail.tsx` — aggiornato: emette `onSelectActivity(id)` invece di solo navigare al partner; le card diventano selezionabili
- **Nuovo** `src/components/agenda/AgendaActionPanel.tsx` — pannello destro operativo (header + contesto + bozza + azioni)
- **Nuovo** `src/components/agenda/AgendaFiltersTab.tsx` — linguetta laterale che apre lo Sheet
- **Nuovo** `src/components/agenda/AgendaActiveFiltersBar.tsx` — barra chip filtri attivi sopra la lista

Nessuna modifica a hook (`useAgendaDayActivities`, `useUpdateActivity`, `useReminders`) né a edge functions: solo presentazione.

## Comportamenti chiave

- **Default all'apertura**: Sheet chiuso, oggi selezionato, lista a sinistra, pannello destro in empty state.
- **Click su card** → seleziona e popola pannello destro (no navigazione fuori pagina).
- **Click su `Rispondi ora`** → apre composer inline nel pannello destro (riusa `EmailComposer` se canale email).
- **Mobile / viewport stretto** (<900px CSS): il pannello destro diventa un overlay full-width sopra la lista (split non praticabile sotto questa soglia).
- **Persistenza filtri**: stato locale (come oggi); nessuna nuova tabella DB.

## Fuori scope (esplicito)

- Nessuna modifica al modello dati / RLS / edge functions.
- Nessuna modifica a Kanban/Duplicati/Campagne (solo Agenda).
- Composer email: si **riusa** quello esistente, non se ne crea uno nuovo.
- Le azioni "Rimanda" / "Delega" restano placeholder come oggi (UX prevista, backend separato).
