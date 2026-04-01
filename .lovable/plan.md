
## Diagnosi rapida

Ho verificato il flusso e il problema non sembra la sessione LinkedIn: dai log `verifySession` risulta `success: true` e `authenticated: true`.

Il guasto reale è nella pipeline LinkedIn del Cockpit:

1. Il pulsante bulk `LinkedIn` del Cockpit oggi non usa un flusso LinkedIn completo: `useLinkedInLookup` fa solo Google Search via Partner Connect.
2. `useLinkedInLookup` considera “già risolto” solo `enrichment_data.linkedin_url`.
3. Il Cockpit e gli altri flow leggono invece soprattutto `enrichment_data.linkedin_profile_url`.
4. Quindi un contatto già risolto può risultare come “0 già risolti”, venire ricercato di nuovo e finire “non trovato”.
5. In più, il bulk lookup del Cockpit passa `sourceId` di card unificate, ma la funzione batch interroga solo `imported_contacts`, quindi la feature non è coerente con tutte le sorgenti del Cockpit.

Ho anche verificato nel database che esistono contatti con `linkedin_profile_url` valorizzato ma `linkedin_url` vuoto: questo conferma il mismatch.

## Cosa penso del sistema

Le potenzialità ci sono già:
- verifica reale della connessione,
- ricerca URL LinkedIn,
- estrazione profilo,
- generazione draft,
- invio multicanale.

Il problema non è che “LinkedIn non esiste”: è che oggi ricerca, persistenza e lettura usano regole diverse. Quindi il sistema sembra rotto anche quando una parte ha già funzionato.

## Piano di correzione

1. Unificare il motore di discovery LinkedIn
- Far usare al bulk lookup del Cockpit la logica di `useSmartLinkedInSearch`.
- Quindi il batch userà davvero:
  - Google via Partner Connect come primo tentativo
  - fallback estensione LinkedIn quando disponibile e autenticata

2. Definire un solo campo canonico
- Usare `linkedin_profile_url` come campo principale in tutto il Cockpit.
- Tenere `linkedin_url` solo come fallback legacy in lettura.
- Aggiornare anche il conteggio “già risolti” per considerare tutti i campi legacy/canonici.

3. Rendere il salvataggio coerente per sorgente
- `imported_contacts`: salvare in `enrichment_data.linkedin_profile_url`, `linkedin_lookup_at`, `linkedin_resolved_method`, log ricerca
- `prospect_contacts`: aggiornare `linkedin_url`
- `partner_contact`: salvare/aggiornare `partner_social_links`
- evitare che il Cockpit lanci una funzione “universale” che oggi supporta solo `imported_contacts`

4. Allineare la lettura del Cockpit
- Far sì che `useCockpitContacts` e le card leggano sempre prima il campo canonico
- invalidare/refetch subito dopo il salvataggio, così il risultato appare senza ambiguità

5. Chiarire la UI
- Rinominare il bottone bulk da generico `LinkedIn` a `Trova profilo LinkedIn`
- mostrare nel progresso quale motore sta lavorando: `Partner Connect`, `LinkedIn fallback`, `già risolto`
- distinguere chiaramente:
  - estensione disponibile
  - sessione autenticata
  - profilo trovato / non trovato / già presente

6. Verifica end-to-end
- Caso A: contatto con `linkedin_profile_url` già presente → deve andare in `già risolti`
- Caso B: contatto senza URL ma trovabile → deve andare in `trovati` e comparire subito in card
- Caso C: contatto non trovabile → `non trovati`
- Caso D: estensione LinkedIn attiva ma Partner Connect assente → fallback coerente o messaggio chiaro
- Caso E: selezione mista nel Cockpit → nessun errore dovuto al tipo sorgente

## Dettagli tecnici

File principali:
- `src/hooks/useLinkedInLookup.ts`
- `src/hooks/useSmartLinkedInSearch.ts`
- `src/hooks/useCockpitContacts.ts`
- `src/pages/Cockpit.tsx`

Approccio consigliato:
```text
Cockpit action
  -> unified LinkedIn resolver
     -> check existing canonical URL
     -> Partner Connect Google search
     -> LinkedIn extension fallback
     -> save to correct table/field by source type
     -> invalidate cockpit query
     -> update progress UI
```

Nella prima iterazione non serve introdurre nuove tabelle: il problema è soprattutto di coerenza applicativa e di persistenza sui campi già esistenti.

## Risultato atteso

Dopo questo intervento, quando lanci LinkedIn dal Cockpit:
- non ricercherà contatti già risolti,
- userà davvero il motore migliore disponibile,
- mostrerà uno stato leggibile,
- e il risultato apparirà subito sulla card giusta.

In sintesi: non farei altre pezze sulla connessione. Sistemerei la pipeline LinkedIn end-to-end, perché è lì che oggi si rompe tutto.
