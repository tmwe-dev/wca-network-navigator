

## Workspace: Filtri a Sinistra e Spiegazione Flusso Deep Search / Email

### Situazione Attuale

Il pannello sinistro del Workspace (`ContactListPanel.tsx`) ha già dei filtri chip (Con email, Senza email, Con contatto, ecc.) ma sono tutti inline in una riga compatta poco leggibile. La barra sorgente (WCA / Prospect / Contatti) è già a icone. La ricerca è nel header.

### Cosa Cambiare

#### 1. Riorganizzare i filtri nel pannello sinistro

Attualmente i filtri sono 8 chip orizzontali compressi. Li riorganizzo in **sezioni logiche verticali** più chiare:

- **Sezione "Dati Contatto"**: Con email / Senza email, Con contatto / Senza contatto
- **Sezione "Arricchimento"**: Arricchito / Non arricchito, Con alias / Senza alias

Ogni sezione avrà un mini-label e i chip saranno su 2 colonne per occupare meno spazio verticale ma essere più leggibili. I conteggi restano visibili su ogni chip.

Aggiungo anche un **filtro per paese** con un dropdown multi-select (come in Rubrica), dato che le attività sono già raggruppate per paese.

#### 2. Filtro "Stato email generata"

Aggiungere un filtro utilissimo che oggi manca:
- **Email generata** — mostra solo le attività che hanno già `email_subject` compilato
- **Email da generare** — mostra quelle senza email

Questo permette di capire a colpo d'occhio cosa manca.

#### 3. Collapsible filter section

I filtri saranno in una sezione collassabile (con un piccolo toggle) per poter nasconderli quando non servono e massimizzare lo spazio lista.

### File da modificare

- `src/components/workspace/ContactListPanel.tsx` — riorganizzazione filtri, aggiunta filtro paese e stato email, sezione collassabile

### Come funziona il flusso Deep Search + Email (spiegazione)

Ecco il flusso operativo del Workspace:

1. **Dalla Rubrica Partner** (o Contatti/Prospect) selezioni record e clicchi "Email Workspace" → vengono create attività `send_email` nel database
2. **Nel Workspace** vedi queste attività nel pannello sinistro, raggruppate per paese
3. **Deep Search** (pulsante in alto): arricchisce i partner/contatti selezionati (o tutti quelli visibili nei filtri) con dati web (social, logo, profilo aziendale). Usa la edge function `deep-search-partner` o `deep-search-contact`. I partner senza profilo WCA scaricato vengono saltati.
4. **Genera Email** (pulsante "Genera Tutte"): per ogni attività visibile/selezionata, chiama la edge function `generate-email` che:
   - Prende il goal, la proposta base, i documenti allegati
   - Legge il profilo del partner/contatto e i dati arricchiti dalla Deep Search
   - Genera un'email personalizzata con AI
   - La salva nell'attività (campi `email_subject`, `email_body`)
5. **Invio**: dal canvas destro puoi inviare direttamente tramite SMTP (edge function `send-email`)

La logica "selezionati vs filtrati": se hai selezionato checkbox specifici, Deep Search e Genera operano solo su quelli. Se non hai selezionato nulla, operano su tutti i record visibili dopo i filtri.

