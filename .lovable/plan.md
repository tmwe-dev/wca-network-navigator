## 1. Cos'è oggi ogni tab di `/v2/communicate/outreach` (verità tecnica)

Letta direttamente dal codice — questa è la mappa che mancava:

| Tab | Cosa contiene davvero (nel DB) | A cosa serve |
|---|---|---|
| **Cockpit** | Non è una lista. È una **scrivania di produzione**: a sinistra contatti filtrati, al centro drop‑zone (Email/LinkedIn/WhatsApp/Phone) per generare bozze AI. Non legge code. | Produrre nuove bozze AI partendo da contatti scelti. |
| **In Uscita** | Unione di 3 tabelle: `activities` (manuali/AI), `mission_actions` (orchestrate da agenti), `pending_actions` (proposte agente non ancora attività). Sotto‑tab: **Da Inviare** (pending), **Inviati** (completed), **Programmati** (scheduled), **Falliti** (failed). | Vedere/autorizzare/cancellare/riprogrammare ciò che parte. |
| **Programmazione** | **Template di sequenze multi‑step** (`outreach_timing_templates`): es. "Primo Contatto WCA = Email gg0 → LinkedIn gg2 → Email gg5 → telefonata gg7". Più sotto‑tab "Attive" che mostra le sequenze già lanciate (`mission_actions` con `cadence_rule`). | Lanciare cadenze/sequenze su una lista di contatti. È il "motore di campagna multi‑step". |
| **Attività** | Tutta la tabella `activities` (200 righe più recenti) — qualunque tipo, qualunque stato, qualunque sorgente. | Storico generale: chiamate, meeting, follow‑up, email — non solo email. |
| **Circuito** | `HoldingPatternCommandCenter`: messaggi inbound (Email/WA/LI) **ricevuti** in attesa di risposta. Non è "ciò che parte", è **ciò che è arrivato**. | Triage dell'inbox cross‑canale: rispondi / ignora / escalation telefonica. |
| **Coda AI** | `activities.status='pending' AND executed_by_agent_id NOT NULL` + `agent_tasks` proposti. | Approvare/rifiutare le azioni che gli agenti propongono autonomamente. |
| **A/B Test** | Varianti di subject/body in test. | Solo lab, non produce invii diretti. |

**Doppione confermato:** "In Uscita → Da Inviare" e "Attività → filtro pending+email" mostrano in pratica gli stessi record. Anche "Programmati" (sotto‑tab) e "Programmazione" sono nomi che si confondono ma fanno cose diverse.

---

## 2. Cosa cambiamo (solo chiarezza, niente ridisegno)

### A. Pannello introduttivo "Cosa stai vedendo"
In ogni tab della sidebar, **in alto, sopra la lista**, una banda compatta che spiega in **una frase**:
- icona + titolo del tab
- frase di scopo ("Qui trovi…")
- da quale fonte arriva il dato ("Origine: campagne, missioni AI, manuali")
- cosa puoi fare ("Approva · Riprogramma · Annulla")
- link "→ vai a X" verso il tab gemello quando esiste (es. da Coda AI → "Le azioni approvate finiscono in *In Uscita › Da Inviare*").

### B. Rinominazioni mirate
Per togliere ambiguità senza rivoluzionare:
- **Programmazione** → **Sequenze** (sottotitolo: "Cadenze multi‑step e template")
- **In Uscita › Programmati** → **In Uscita › Pianificati** (data futura impostata dall'utente)
- **Cockpit** resta com'è (è la scrivania di produzione, distinta da Outreach come confermato).
- **Circuito** → **Risposte in arrivo** (sottotitolo: "Email/WA/LinkedIn da gestire")

### C. **Anteprima email nel pannello laterale** (la cosa più importante per te)
Su **In Uscita › Da Inviare** la lista diventa **split‑view**:
- a sinistra: lista contatti con check, canale, sorgente (come ora)
- a destra: pannello che si apre al click sulla riga e mostra:
  - destinatario (nome + email + azienda)
  - **oggetto reale**
  - **corpo reale della mail** (HTML sanitizzato)
  - **sorgente/percorso**: "Generata da Cockpit", "Bozza AI agente Luca", "Step 2/5 della sequenza Primo Contatto WCA", ecc.
  - se è parte di una sequenza: i passi precedenti già fatti e i prossimi
  - bottoni: **Autorizza invio** · **Riprogramma** · **Annulla** · **Apri composer per modifica**

Stessa preview‑pane verrà riusata per **Programmati** e **Falliti** (con motivo del fallimento + bottone "Riprova").

### D. Banda "Origine record" su ogni riga
Pillola colorata sempre visibile: **Manuale · AI · Campagna · Missione · Sequenza** — così a colpo d'occhio sai da dove arriva ogni messaggio. Già presente in parte, la rendiamo coerente in **tutti** i tab.

### E. Mini‑legenda fissa nel footer del pannello
Una riga sottile in basso al pannello Outreach con la legenda dei badge (cosa significa "Cadence", "Missione", "Manuale"). Puoi nasconderla con una X — lo stato resta in localStorage.

### F. "Avvia Programmazione" (Sequenze) — chiarire da dove arrivano i template
Sopra la griglia template, una banda esplicativa:
- **Sistema**: preset forniti di default (badge grigio "Sistema")
- **Custom**: creati da te o dal tuo team (badge viola)
- **Bottone "Nuovo Template"** → apre il builder
- **Bottone "Avvia"** su ogni card → wizard che chiede: *quali contatti* + *data inizio* + *canali abilitati* → crea le righe in `mission_actions` che poi vedrai in "Sequenze › Attive" e i singoli invii in "In Uscita".

---

## 3. Cosa NON tocchiamo in questo passaggio

- Logica di invio / coda / autorizzazione: già sistemata nel turno precedente (tutte le mail → `email_campaign_queue` in stato `pending`).
- Cockpit: resta separato come scrivania di produzione (tua scelta).
- Circuito: resta funzionalmente identico, cambia solo il nome e l'intestazione esplicativa.
- Nessun pannello "Approval" duplicato viene rimosso (come da tuo precedente input "non rimuovere niente adesso").

---

## 4. File toccati (frontend, presentational)

```text
src/components/outreach/
  ├─ TabIntroBanner.tsx            (NUOVO — banda esplicativa riusabile)
  ├─ OutreachLegendFooter.tsx      (NUOVO — legenda badge)
  ├─ EmailPreviewPane.tsx          (NUOVO — pannello laterale preview)
  ├─ DaInviareSubTab.tsx           (split-view + integrazione preview pane)
  ├─ ProgrammatiSubTab.tsx         (idem)
  ├─ FallitiSubTab.tsx             (idem + motivo errore + Riprova)
  ├─ InviatiSubTab.tsx             (preview read-only)
  ├─ SchedulingTab.tsx             (banda "Sistema vs Custom" + intestazione "Sequenze")
  ├─ AttivitaTab.tsx               (banda intro + chiarisce che è uno storico)
  ├─ CodaAITab.tsx                 (banda intro: "le approvate vanno in In Uscita")
  └─ HoldingPatternCommandCenter.tsx (banda intro: "messaggi RICEVUTI da gestire")

src/v2/ui/pages/communicate/OutreachPage.tsx
  └─ etichette tab: Programmazione→Sequenze, Circuito→Risposte in arrivo
```

Nessuna modifica a DB, edge functions, hook di business, query keys.

---

## 5. Come saprai che è chiaro

Apri `/v2/communicate/outreach`, clicchi un tab a caso: **in alto vedi una frase che ti dice cosa stai guardando, da dove arriva e cosa puoi farci**. Clicchi una riga in "Da Inviare": **a destra si apre la mail intera** con sorgente e bottoni di azione. Apri "Sequenze": capisci subito differenza tra template **Sistema** e **Custom** e dove finiscono gli invii quando avvii.