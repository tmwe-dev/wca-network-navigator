## Obiettivo

Rendere Outreach **leggibile e logico**. Oggi i tab funzionano ma "non si capisce un cazzo": le righe mostrano "reply received email" anziché *con chi* hai parlato, le sequenze non si capisce a cosa servano, Coda AI / Risposte in arrivo / Storico Attività si confondono.

Riduciamo a **due soli contenitori operativi** + due viste di consultazione, e ridisegniamo le righe per mettere al centro **azienda → cosa è successo → quando**.

---

## 1. La nuova mappa mentale di Outreach

Solo **4 tab visibili**, ognuno con uno scopo univoco:

```text
COCKPIT        → Sala produzione: scelgo contatti, l'AI mi prepara messaggi.
                 Esce sempre una BOZZA (mai invio diretto).

IN USCITA      → Sala spedizioni: tutto ciò che è pronto e attende l'OK.
                 Sotto-tab:
                   • Da approvare  (bozze: manuali + AI + campagna)
                   • Pianificate   (autorizzate, in attesa del loro orario)
                   • Inviate       (storico spedizioni)
                   • Fallite       (errori da rivedere)

RISPOSTE       → Posta in arrivo cross-canale (Email + WA + LinkedIn).
                 Messaggi ARRIVATI da clienti/partner che aspettano una mossa.

ATTIVITÀ       → Diario di bordo: tutto quello che è accaduto + cosa devi fare
                 (chiamate, meeting, follow-up, invii completati).
                 Filtri per tipo, stato, sorgente.
```

**Spariscono come tab autonomi:**
- *Coda AI* → si fonde dentro **In Uscita › Da approvare** (le proposte AI sono bozze come le altre, con badge "🤖 AI" e tooltip "Proposta da Luca / Sherlock").
- *Sequenze* → si sposta dentro **Cockpit** come pannello laterale "Applica una cadenza" (è uno strumento di produzione, non un tab).
- *A/B Test* → si sposta sotto **Cockpit › Strumenti**.

Risultato: 7 tab → **4 tab**. Niente più contenitori che sembrano duplicati.

---

## 2. La riga unica "leggibile" (usata in tutti i tab)

Oggi vedi: `Reply: received email — oversea1@asl-corp.com.vn`. Inutile.

Nuova riga (stessa anatomia in In Uscita / Risposte / Attività):

```text
[LOGO]  Acme Logistics · Vietnam               [↗ Email]   ⏰ 24 apr 09:20
        Maria Nguyen <maria@acme.vn>                       👤 Manuale
        ✉️  "Re: Quotation for Hanoi-Genoa route"
        Aspetta la tua risposta · ricevuta 2h fa
                                              [Approva] [Rispondi] [⋯]
```

Componenti chiave per ogni riga:
- **Logo azienda** (favicon dal dominio email, fallback: iniziale colorata).
- **Azienda + paese** in grassetto come titolo (non l'oggetto tecnico).
- **Persona + email** sotto, in piccolo.
- **Icona-azione** colorata che dice *cosa è successo*: ✉️ inviata, ↩️ risposta ricevuta, 📞 chiamata, 🤝 meeting, 🤖 proposta AI, 🔄 follow-up, 🗓️ pianificata.
- **Badge sorgente**: 👤 Manuale · 🤖 AI (Luca) · 📧 Campagna · 🎯 Missione · 🔁 Sequenza.
- **Frase in italiano** che spiega *cosa fare/cosa è successo* ("Aspetta la tua risposta", "Pronta per partire alle 10:30", "Follow-up scaduto da 2 giorni").
- **Data + ora** sempre esplicite, mai solo "24 apr".

Su click → si apre il pannello laterale già esistente (`EmailPreviewPane`) con corpo completo, thread e azioni.

---

## 3. Cosa cambia in concreto, tab per tab

### Cockpit (resta produzione)
- Aggiungere pannello laterale "**Applica una cadenza**" che mostra i template di Sequenze (Primo Contatto, Follow-up, Nurturing…) e permette di lanciarli sui contatti selezionati.
- Banner di intro: *"Qui prepari i messaggi. Ogni cosa che invii da qui finisce in **In Uscita › Da approvare** prima di partire."*

### In Uscita (cuore operativo, unificato)
- **Da approvare** = bozze manuali + AI (ex Coda AI) + campagne, tutte insieme con badge sorgente.
- Header del sotto-tab: contatori chiari (`12 da approvare · 3 AI · 2 campagne`).
- Riga ridisegnata come sopra.
- `EmailPreviewPane` mostra in alto la "**provenienza**": "Generata da Luca AI il 24 apr · su missione Vietnam Q2" oppure "Scritta da te nel Cockpit".

### Risposte (ex "Risposte in arrivo / Circuito")
- Banner: *"Messaggi che ti hanno scritto. Da qui decidi: rispondi (l'AI prepara una bozza che finisce in **In Uscita**), ignori, o escali a chiamata."*
- Riga ridisegnata: **Azienda + persona**, anteprima testo, "ricevuto 2h fa", azioni rapide.
- Tab interni canale: 📧 Email · 💬 WhatsApp · 💼 LinkedIn con contatori.

### Attività (ex Storico Attività)
- Banner: *"Diario completo: ogni chiamata, email inviata, meeting, follow-up. Filtra per capire cosa hai fatto e cosa devi ancora fare."*
- Riga ridisegnata: niente più "send_email" tecnico → **icona + frase italiana** ("✉️ Email inviata a Acme · 24 apr 09:20").
- Per le attività AI: tag "🤖 fatto da Luca" con tooltip che spiega perché.

---

## 4. Sequenze: come funzionano e dove vanno

Una **Sequenza** = ricetta multi-step (es. *Email giorno 0 → LinkedIn giorno 3 → Email giorno 7 → Telefono giorno 14*). Si crea una volta, si applica a *N contatti*.

Spostamento e chiarimento:
- Le sequenze diventano un **wizard dentro Cockpit** ("Applica cadenza ai contatti selezionati"), non un tab separato.
- I template di sistema sono visibili e duplicabili. Crearne uno nuovo = wizard in 3 step (obiettivo, sorgente contatti, step della cadenza).
- Una sequenza attiva genera invii singoli che compaiono in **In Uscita › Da approvare** (mai automatica al 100%): tu vedi `🔁 Sequenza "Primo Contatto" · step 2 di 4`.
- Pannello "Sequenze attive" come collassabile dentro Cockpit (vedi quante stanno girando, su quanti contatti, quante hanno risposto).

---

## 5. Componenti tecnici da creare/modificare

**Nuovi componenti UI (presentazione):**
- `OutreachRow.tsx` — riga unificata (logo + azienda + icona-azione + frase + data + sorgente).
- `CompanyAvatar.tsx` — logo da favicon dominio con fallback iniziali colorate.
- `ActionIcon.tsx` — mappa azione → icona + colore + label italiana.
- `SourcePill.tsx` — badge sorgente standard (Manuale / AI / Campagna / Missione / Sequenza).
- `RelativeTime.tsx` — "ricevuta 2h fa", "fra 3 giorni", "scaduto da ieri".

**Modificati:**
- `OutreachPage.tsx` — riduce a 4 tab, sposta A/B Test e Sequenze.
- `CockpitPage.tsx` — aggiunge pannello laterale "Applica cadenza" + "Sequenze attive".
- `DaInviareSubTab.tsx` — assorbe le proposte AI (query unificata activities + agent_tasks pending).
- `AttivitaTab.tsx` — nuova riga, frasi italiane, icone per tipo.
- `HoldingPatternCommandCenter.tsx` — rinominato "Risposte", nuova riga.
- `TabIntroBanner.tsx` — testi rivisti con tono didattico (spiega da dove arriva il dato e che azioni puoi fare).

**Eliminati come tab (codice preservato):**
- `CodaAITab.tsx` — logica fusa in `DaInviareSubTab`.
- `SchedulingTab.tsx` — diventa pannello dentro Cockpit.

**Nessuna modifica al DB e nessuna modifica al motore di invio.** Solo presentazione + riorganizzazione tab.

---

## 6. Microcopy che vedrai ovunque (tono)

- "Niente parte senza il tuo OK."
- "Da qui prepari → da **In Uscita** autorizzi → in **Attività** vedi cosa è successo."
- "Questa l'ha proposta Luca AI il 24 apr per la missione Vietnam Q2."
- "Maria di Acme ti ha scritto 2 ore fa. Vuoi che Luca prepari la risposta?"

---

## 7. Cosa NON tocchiamo

- Schema DB, edge functions, motore invio, regole RLS, sistema permessi.
- Logica di approvazione/coda (resta `email_campaign_queue` + `pending` come stabilito).
- Soft-delete, holding pattern governance, AI Invocation Charter.

---

Confermi e procedo a implementare? Se vuoi cambiamenti (es. mantenere Coda AI separato, o lasciare Sequenze come tab), dimmelo prima e adatto il piano.