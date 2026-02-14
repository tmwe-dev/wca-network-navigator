

# Piano: Deduplicazione Rigorosa — Una Persona, Un Record, Una Email

## Problema

Ci sono **3 punti** nel codice che salvano contatti, e ognuno ha una logica diversa:

1. **`useDownloadProcessor.ts`** (frontend, download loop): dedup solo per `name` — non controlla email, non unisce ruoli
2. **`save-wca-contacts/index.ts`** (edge function): dedup multi-chiave ma non unisce persone con stesso nome ed email diversa
3. **`scrape-wca-partners/index.ts`** (edge function): stessa logica di save-wca-contacts

Il caso "Ms. Genta Toska" mostra che la stessa persona appare con due ruoli (Sales, Finance) e due email diverse (una delle quali errata: `t.lamaj@...` assegnata a Toska). Il sistema deve:
- Riconoscere che e' la stessa persona (stesso nome)
- Tenere una sola email (quella coerente col nome)
- Unire i titoli in un solo record

## Soluzione

### Regola unica: dedup per NOME come chiave primaria

Il **nome della persona** diventa la chiave principale di deduplicazione. Se due contatti hanno lo stesso nome (case-insensitive), sono la stessa persona. I titoli vengono concatenati ("Sales / Finance"), e l'email viene scelta con una logica di validazione:

```text
Email corretta = quella il cui prefisso (prima della @) contiene
                 iniziale nome o cognome della persona
Esempio: "Ms. Genta Toska" -> g.toska@... e' corretta
         "Ms. Genta Toska" -> t.lamaj@... e' sbagliata (appartiene a Lamaj)
```

### File da modificare

#### 1. `src/hooks/useDownloadProcessor.ts` (righe 135-156)

Sostituire il salvataggio contatti ingenuo con una logica completa:
- Deduplicare i contatti in ingresso per nome (unire titoli, scegliere email migliore)
- Prima di inserire, controllare se esiste gia' un contatto con stesso nome O stessa email
- Se esiste: aggiornare campi mancanti, unire titoli
- Se non esiste: inserire

#### 2. `supabase/functions/save-wca-contacts/index.ts`

Rafforzare la dedup in ingresso:
- Dopo il merge per email, fare un secondo pass di merge per **nome** (case-insensitive)
- Per ogni gruppo con stesso nome, scegliere l'email piu' coerente (matching iniziale/cognome)
- Nella fase di match con il DB, dare **priorita' al nome** rispetto al titolo

#### 3. `supabase/functions/scrape-wca-partners/index.ts` (funzione `saveContactsBatch`)

Stessa logica di save-wca-contacts:
- Dedup input per nome dopo dedup per email
- Match DB: nome -> email -> titolo (invertire la priorita' attuale titolo -> email -> nome)

### Pulizia una tantum: International Trans

Eseguire una query per unire i due record di Ms. Genta Toska:
- Tenere il record con email `g.toska@internationaltrans06.com` (coerente col nome)
- Aggiungere il titolo "Sales / Finance" e il telefono
- Eliminare il record con email `t.lamaj@...`

### Logica di selezione email (comune a tutti e 3 i punti)

```text
function bestEmail(name, emails[]):
  cognome = ultima parola del nome (senza Mr/Ms/Dr)
  iniziale = prima lettera del nome proprio
  per ogni email:
    prefisso = parte prima della @
    se prefisso contiene cognome.toLowerCase() -> punteggio +2
    se prefisso contiene iniziale.toLowerCase() -> punteggio +1
  ritorna email con punteggio piu' alto
  se nessun match: ritorna la prima email non-null
```

### Ordine di priorita' nel match DB (tutti e 3 i punti)

```text
Vecchio: title -> email -> name
Nuovo:   name -> email -> title
```

Il nome e' piu' stabile del titolo (una persona puo' cambiare ruolo ma non nome).

