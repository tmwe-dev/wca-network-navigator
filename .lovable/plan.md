## Riassetto sezione Comunica

Obiettivo: separare nettamente **ricezione** (Inbox) da **invio** (Outreach), togliere le ripetizioni con Cestinone/Agenda e mettere "Componi" come azione di primo livello con ricerca destinatario integrata.

### 1. Nuova struttura tab di /v2/communicate

Da 4 tab a 3, con ordine ripensato:

```text
[ ✍ Componi ]   [ 📥 Inbox ]   [ 🚀 Outreach ]   [ 📣 Campagne ]
```

- **Componi** diventa la prima tab (azione primaria: "scrivi un'email").
- **Inbox** = solo posta ricevuta da leggere/rispondere (resta `InreachPage`).
- **Outreach** = tutto ciò che riguarda l'invio (cockpit + strumenti), molto più snello.
- **Campagne** invariato come ingresso, ma il cuore operativo passa per Esplora→Mappa→Aggiungi a campagna (vedi §4).

### 2. Pulizia di Outreach (rimuove duplicati con Cestinone, Inbox, Agenda)

`OutreachPage` oggi ha 5 sub-tab verticali. Riduzione a 2:

| Sub-tab attuale | Decisione |
|---|---|
| Cockpit | **Tieni** — centro di comando outbound |
| In Uscita | **Rimuovi dalla UI** — duplica il Cestinone/Da Inviare. Redirect `/v2/communicate/outreach/inuscita` → `/v2/cestinone` |
| Risposte (Holding Pattern) | **Rimuovi dalla UI** — duplica Inbox. Redirect → `/v2/communicate/inbox` |
| Attività | **Sposta in Agenda** — la sub-tab sparisce, le attività vengono mostrate dentro `/v2/agenda` (nuova sezione "Attività outreach") |
| Strumenti (Sequenze, Coda AI, A/B Test) | **Tieni**, ma con tooltip esplicativi e copy chiaro: "Coda AI = azioni che gli agenti vogliono eseguire e attendono approvazione", "A/B Test = confronto varianti subject/body" |

Risultato: Outreach = `Cockpit` + `Strumenti`. Niente più liste-mail duplicate.

I componenti rimossi dalla UI restano nel codebase (governance "non cancellare codice in sviluppo") ma non sono più montati dalle tab.

### 3. Componi: ricerca destinatario in cima

Nella `EmailComposerPage`, sopra (o dentro) il campo "Destinatario":

- Barra di ricerca unica con tasto "Cerca destinatario" che apre il picker (`EmailComposerContactPicker` esiste già).
- La ricerca interroga partner, contatti partner e biglietti da visita (BCA) e restituisce nome + email + azienda + paese.
- Selezionando un risultato → popola automaticamente partner, contatto ed email.
- Resta possibile digitare manualmente un'email libera.

Bonus coerente con la richiesta precedente: quando si esce dalla pagina, il destinatario viene resettato (no carry-over fra contatti diversi).

### 4. Attività → Agenda

- Le voci oggi mostrate in `AttivitaTab` (follow-up, reply received, ecc.) vengono mostrate dentro `/v2/agenda` come nuova fascia "Outreach" del raggruppamento per tipo già esistente (vedi `agenda-action-grouping`).
- `AttivitaTab` non più montata in Outreach.

### 5. Routing e redirect

In `CommunicateSection.tsx`:
- Default `/v2/communicate` → `/v2/communicate/compose` (era inbox).
- Aggiunte route legacy con redirect:
  - `/v2/communicate/outreach/inuscita` → `/v2/cestinone`
  - `/v2/communicate/outreach/circuito` → `/v2/communicate/inbox`
  - `/v2/communicate/outreach/attivita` → `/v2/agenda`

### 6. File toccati (solo UI / presentazione)

- `src/v2/ui/pages/sections/CommunicateSection.tsx` — riordino tab + redirect.
- `src/v2/ui/pages/OutreachPage.tsx` — rimozione 3 sub-tab, copy migliorato su Strumenti.
- `src/v2/ui/pages/EmailComposerPage.tsx` — barra ricerca destinatario in alto + tasto picker.
- `src/components/global/EmailComposerContactPicker.tsx` — già esiste, viene riutilizzato dal nuovo trigger.
- Pagina Agenda (`/v2/agenda`) — aggiunta sezione "Outreach" che riusa la query di `AttivitaTab`.

Nessuna modifica a edge function, RLS, DB o orchestratori AI.

### Domande aperte

1. La tab "Componi" deve diventare default di `/v2/communicate`, oppure preferisci che resti Inbox?
2. La ricerca destinatario in Componi deve includere anche **lead non-partner** (es. solo BCA non ancora promossi) o solo partner+contatti partner?
3. Per "Attività in Agenda": vuoi vederle insieme alle attività manuali oppure in una sezione collassabile separata "Outreach" dentro Agenda?