
Obiettivo: far entrare i file dei biglietti da visita nello stesso flusso degli import esistenti, ma in modo esplicito e riconoscibile come origine “Biglietto da visita”, anche quando una riga contiene più telefoni o più cellulari.

Cosa ho verificato nella struttura attuale
- Il flusso giusto non è `Settings > CSVImport`: quello importa direttamente in `partners` ed è separato.
- Il flusso corretto è la pagina `Import`, che già salva in:
  - `import_logs` = lotto / gruppo / evento
  - `imported_contacts` = staging contatti
- `imported_contacts` oggi ha un solo `phone` e un solo `mobile`, più `origin`, `note`, `raw_data`, `external_id`, `position`.
- In Cockpit e nei contatti importati i record vengono già letti da `imported_contacts`, quindi se facciamo entrare i biglietti lì diventano subito utilizzabili come gli altri.
- Quando poi trasferisci verso `partners` / `partner_contacts`, oggi il sistema usa ancora un solo `direct_phone` e un solo `mobile`.

Problema reale da risolvere
- I biglietti da visita possono avere:
  - più numeri
  - numeri non chiaramente distinti tra fisso/mobile
  - campi presenti solo a volte
  - JSON/CSV con struttura variabile
- Lo schema attuale regge bene l’import “minimo”, ma non conserva bene la pluralità dei numeri.

Proposta consigliata
1. Tenere i biglietti dentro il flusso Import esistente
- Upload nella pagina `Import`, non nel vecchio `CSVImport`.
- Ogni file crea un gruppo/evento in `import_logs`.
- `group_name` obbligatorio, es. “Fiera Milano 2026”.
- `origin` valorizzato in modo chiaro, ad esempio `business_card` oppure `business_card:<evento>`.

2. Aggiungere supporto JSON oltre a CSV/Excel
- Estendere il parser esistente per leggere anche JSON.
- Supportare:
  - array di oggetti
  - oggetto wrapper con lista interna
- Convertire il JSON nello stesso formato `headers/rows` usato oggi dal mapping AI/manuale.
- Così CSV, Excel e JSON entrano tutti nello stesso wizard.

3. Gestire i numeri multipli senza perdere dati
Scelta migliore:
- mantenere `phone` e `mobile` come campi “primari” per compatibilità con UI attuale
- aggiungere un contenitore completo dei numeri dentro `raw_data` oppure, meglio, in nuovi campi JSON dedicati tipo:
  - `phones_json`
  - `mobiles_json`
  - oppure un unico `contact_numbers`
- Regola operativa:
  - il mapping estrae il numero principale in `phone` e/o `mobile`
  - tutti gli altri numeri restano salvati nel payload completo
- Questo evita di rompere il codice esistente e permette evoluzione successiva.

4. Rendere l’origine molto chiara in UI
- Nello storico import mostrare badge o label “Biglietti da visita”.
- In Cockpit `originDetail` dovrebbe preferire:
  - “Biglietti da visita”
  - nome evento/gruppo
- Nei filtri contatti sarà chiaro distinguere WCA vs Import standard vs Biglietti da visita.

5. Allineare il trasferimento verso i contatti WCA-like
- Quando un contatto da biglietto viene trasferito:
  - `partners`: dati azienda principali
  - `partner_contacts`: nome, ruolo, email, telefono principale, mobile principale
- I numeri extra non vanno persi:
  - restano nello staging
  - oppure vengono copiati in metadati/note del contatto trasferito nella prima fase
- In una fase 2 si può introdurre una tabella numeri separata se vuoi trattare più recapiti in modo pienamente strutturato.

Proposta di implementazione pratica
Fase 1: subito utile e senza stravolgere
- aggiungere JSON nel parser
- aggiungere “Import biglietti da visita” come variante del wizard Import
- valorizzare `origin = business_card`
- usare `group_name` come evento obbligatorio
- salvare tutti i numeri originali in `raw_data`
- scegliere `phone/mobile` primari con regole semplici

Fase 2: robustezza per numeri multipli
- aggiungere campi JSON dedicati per i recapiti multipli nello staging
- mostrare in UI “+ altri numeri”
- trasferire anche i recapiti aggiuntivi in forma strutturata o note

Fase 3: modello pieno enterprise
- creare tabella relazionale per recapiti multipli dei contatti
- un contatto può avere N telefoni, N mobili, N email
- è la soluzione più pulita, ma è anche più invasiva

Raccomandazione architetturale
Ti consiglio la Fase 1 + preparazione Fase 2.
Perché:
- riusi tutto il flusso Import attuale
- i biglietti diventano subito “come gli altri”
- il sistema resta compatibile con Cockpit e contatti esistenti
- non perdi i numeri multipli
- non fai subito una refactor pesante delle relazioni

Dettagli tecnici da toccare
- `src/lib/import/types.ts`
  - aggiungere supporto formato `json`
- `src/lib/import/fileParser.ts`
  - aggiungere parser JSON
- `src/pages/Import.tsx`
  - aggiornare copy/UI per indicare anche JSON e import biglietti da visita
- `src/hooks/useImportWizard.ts`
  - accettare `.json`
  - imporre gruppo/evento
  - valorizzare origine specifica business card
- `src/hooks/useImportLogs.ts`
  - inserire eventuale logica per numeri multipli e metadati origine
- `src/hooks/useCockpitContacts.ts`
  - migliorare `originDetail` per mostrare chiaramente “Biglietti da visita”
- opzionale DB
  - aggiungere campi JSON per numeri multipli se vuoi conservarli in modo esplicito oltre `raw_data`

Decisione progettuale consigliata
- Sì: import JSON oltre a CSV/Excel
- Sì: usare il wizard `Import`, non il vecchio `CSVImport`
- Sì: tracciare chiaramente l’origine come “biglietto da visita”
- Sì: gestire più numeri con campo principale + archivio completo dei numeri
- Non subito: rifare tutto il modello contatti con relazioni multiple, a meno che tu voglia un CRM molto più avanzato già ora

Se approvi questa direzione, il passo successivo corretto è:
- integrare JSON nel wizard Import
- aggiungere la semantica “business card import”
- preparare la conservazione dei numeri multipli senza rompere il resto dell’app
