

# Visualizzatore Dati Scaricati per Job

## Obiettivo
Aggiungere un pulsante nella JobCard che apre un pannello/dialog dove puoi sfogliare pagina per pagina tutti i partner scaricati dal job, vedendo per ciascuno: azienda, contatti (con email, telefono, mobile), e un indicatore chiaro di cosa e' stato estratto.

## Come funziona

Nella `JobCard` (la card di ogni job attivo o completato) verra' aggiunto un pulsante con icona "lista/occhio". Cliccandolo si apre un **Dialog** con:

- **Navigazione a pagine**: pulsanti Avanti/Indietro per scorrere i partner scaricati uno alla volta (o una lista scrollabile)
- **Per ogni partner**: nome azienda, citta', paese, email azienda, telefono, e soprattutto la **lista completa dei contatti** con nome, titolo, email, telefono, mobile
- **Indicatori visivi**: icona verde se ha email, rossa se mancante; stesso per telefono
- **Contatore**: "Partner 3 di 95" con navigazione

## Dati disponibili

Il job salva in `processed_ids` la lista ordinata dei WCA ID gia' scaricati. Per ogni WCA ID possiamo caricare dal database:
- Tabella `partners`: company_name, city, country_code, email, phone
- Tabella `partner_contacts`: tutti i contatti con nome, titolo, email, telefono, mobile

Quindi il viewer carica i dati direttamente dal DB, non serve salvare nulla di aggiuntivo.

## Dettagli tecnici

### File da modificare:

**`src/pages/DownloadManagement.tsx`**:
1. Nella `JobCard`, aggiungere un pulsante icona (es. `List` o `Eye`) accanto ai controlli esistenti
2. Creare un componente `JobDataViewer` (dialog modale) che:
   - Riceve la lista `processed_ids` dal job
   - Carica i partner dal DB tramite query `partners` filtrata per `wca_id IN (processed_ids)`
   - Per ogni partner, carica i `partner_contacts` associati
   - Mostra una lista scrollabile con navigazione (precedente/successivo)
   - Per ogni partner mostra: nome azienda, citta', bandiera paese, email/telefono azienda, e sotto tutti i contatti con email/telefono/mobile evidenziati
   - Badge colorati: verde "Email trovata", rosso "Email mancante"

### Struttura UI del viewer:

```text
+------------------------------------------+
|  Dati Scaricati - IT Italia (23/95)      |
+------------------------------------------+
|  [<] Partner 3 di 23 [>]                 |
|                                          |
|  ACME Logistics Srl                      |
|  Roma, IT | WCA #12345                   |
|  Email: info@acme.it                     |
|  Tel: +39 06 1234567                     |
|                                          |
|  --- Contatti (3) ---                    |
|                                          |
|  Mario Rossi - Managing Director         |
|  [v] mario@acme.it                       |
|  [v] +39 333 1234567 (mobile)            |
|                                          |
|  Giulia Bianchi - Pricing Dept           |
|  [v] giulia@acme.it                      |
|  [x] Telefono mancante                   |
|                                          |
|  Luigi Verdi - Operations                |
|  [x] Email mancante                      |
|  [x] Telefono mancante                   |
+------------------------------------------+
```

### Query utilizzate:
- `SELECT * FROM partners WHERE wca_id = ANY(processed_ids)` per caricare i partner
- `SELECT * FROM partner_contacts WHERE partner_id IN (...)` per i contatti
- I dati vengono caricati una sola volta all'apertura del dialog e cachati con React Query

### Nessuna modifica al database necessaria
Tutti i dati sono gia' presenti nelle tabelle `partners` e `partner_contacts`.

