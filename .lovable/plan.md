

# Piano: Deduplicazione Contatti per Email e Nome

## Problema riscontrato

Asia Pamir Logistics ha 8 contatti nel DB, di cui **3 sono duplicati esatti** di Mr. Nesar Ahmad Naziri (stesso nome, stesso titolo "Manager", stessa email). Questo succede perche' il sistema di deduplicazione si basa solo sul campo `title` del contatto. Se lo scraper gira piu' volte, o se ci sono inserimenti concorrenti, i duplicati non vengono catturati.

Inoltre, la stessa persona puo' avere **piu' ruoli** (es. "Manager" e "Operations") con email diverse, creando righe separate per la stessa persona fisica.

## Soluzione

### 1. Fix della logica di deduplicazione (prevenzione futura)

Modificare `saveContactsBatch` in `scrape-wca-partners/index.ts` e la logica equivalente in `save-wca-contacts/index.ts`:

- Costruire **3 indici di lookup**: per `title`, per `email`, per `name`
- Prima di inserire un nuovo contatto, verificare:
  1. Esiste gia' un contatto con lo stesso `title`? --> aggiorna
  2. Esiste gia' un contatto con la stessa `email`? --> aggiorna (aggiungi titolo se diverso)
  3. Esiste gia' un contatto con lo stesso `name`? --> aggiorna
  4. Nessun match --> inserisci
- Deduplicare anche i contatti in ingresso (dal parsing) prima di salvarli: se due contatti hanno la stessa email, unirli in uno solo

### 2. Pulizia duplicati esistenti (una tantum)

Eseguire una query SQL che:
- Trova contatti duplicati per lo stesso `partner_id` con stessa `email` (non null)
- Trova contatti duplicati per lo stesso `partner_id` con stesso `name` e `title`
- Mantiene solo il record piu' completo (con piu' campi compilati) e cancella gli altri

### 3. Raggruppamento contatti per persona nel frontend

Questo e' gia' gestito dalla logica di deduplicazione: una volta puliti i duplicati, ogni persona apparira' una sola volta.

---

## Dettaglio tecnico

### File da modificare

**`supabase/functions/scrape-wca-partners/index.ts`** (funzione `saveContactsBatch`, righe 973-1017)

Logica attuale:
```
existingByTitle = Map(title -> contact)
per ogni contatto: se title esiste, aggiorna; altrimenti inserisci
```

Nuova logica:
```
existingByTitle = Map(title -> contact)
existingByEmail = Map(email -> contact)  // NUOVO
existingByName  = Map(name -> contact)   // NUOVO

// Dedup contatti in ingresso: unisci quelli con stessa email
deduplicatedContacts = mergeByEmail(contacts)

per ogni contatto:
  match = existingByTitle[title] || existingByEmail[email] || existingByName[name]
  se match: aggiorna campi mancanti
  altrimenti: inserisci
```

**`supabase/functions/save-wca-contacts/index.ts`** (stessa logica, righe 54-112)

Applicare la stessa strategia di dedup multi-chiave.

### Migrazione SQL -- pulizia duplicati

```text
-- Trova e rimuovi duplicati per email (mantieni il piu' completo)
-- Trova e rimuovi duplicati per nome+titolo esatto
-- Solo per lo stesso partner_id
```

La query identifica per ogni gruppo di duplicati il record "migliore" (con piu' campi compilati: email, direct_phone, mobile) e cancella gli altri.

### Nessuna modifica frontend necessaria

La pulizia avviene tutta lato backend e database. Il frontend mostrera' automaticamente i contatti senza duplicati.

