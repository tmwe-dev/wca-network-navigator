
Obiettivo: correggere il disallineamento tra quanto promesso e quanto l’utente vede davvero in `/agenda`, rendendo visibili sia il toggle mock sia la nuova agenda “a libro”.

Cosa ho verificato
- La route `/agenda` punta ancora a `src/pages/Agenda.tsx`, che è la vecchia agenda a calendario mensile/settimana/giorno.
- La nuova agenda “a libro” esiste davvero, ma sta in `src/pages/Reminders.tsx` e usa:
  - `src/components/agenda/AgendaCalendarPage.tsx`
  - `src/components/agenda/AgendaDayDetail.tsx`
  - `src/components/agenda/AgendaBulkBar.tsx`
  - `src/hooks/useAgendaDayActivities.ts`
- Quindi il problema principale non è “manca tutto”: è che la route pubblica carica il file sbagliato.
- Il toggle mock esiste, ma solo dentro `src/pages/Outreach.tsx`, nell’header di Outreach. In Agenda non c’è alcun toggle visibile.
- La nuova agenda legge i mock da `localStorage("outreach-mock-enabled")`, quindi dipende da un toggle definito altrove e per questo in Agenda l’utente non capisce dove attivarlo.

Perché l’utente non vede nulla
1. `/agenda` usa ancora la pagina vecchia (`Agenda.tsx`), non quella nuova (`Reminders.tsx`)
2. Il toggle mock è confinato a Outreach, quindi in Agenda non compare
3. Il mock agenda è accoppiato alla chiave `outreach-mock-enabled`, che è poco chiara e invisibile da questa schermata

Intervento proposto
1. Allineare la route Agenda
- Fare in modo che `/agenda` renderizzi la nuova agenda a libro
- Opzione più pulita: sostituire il contenuto di `src/pages/Agenda.tsx` con il layout oggi presente in `Reminders.tsx`
- In alternativa, far importare `Agenda.tsx` da `Reminders.tsx`, ma è meno pulito come naming

2. Rendere il toggle mock visibile anche in Agenda
- Aggiungere nell’header della nuova Agenda un pulsante mock, con la stessa UX di Outreach
- Etichetta chiara: `Mock` / `Mock ON`
- Tooltip esplicito: “Mostra/nascondi dati demo agenda”
- Così l’utente non deve andare in Outreach per popolare Agenda

3. Disaccoppiare o rinominare lo stato mock
- Centralizzare il mock state in un hook/shared util unico
- Evitare che Agenda dipenda semanticamente da `outreach-mock-enabled`
- Usare una chiave più universale, ad esempio `demo-data-enabled` oppure mantenere compatibilità leggendo entrambe le chiavi per non rompere il comportamento già presente

4. Rifinire la nuova agenda per il viewport reale dell’utente
- L’utente è su circa 718x691: il layout a libro va verificato per questa altezza
- Ridurre header/spaziature verticali
- Fare in modo che il pannello destro mostri subito i sub-tab e la lista senza “perdersi” sopra la fold
- Assicurare che la colonna sinistra non rubi troppo spazio

5. Verificare i contenuti promessi
- Sub-tab: Tutti, Email, WhatsApp, LinkedIn, Reminder
- Checkbox selezione
- Badge “Risposto”
- Menu 3 puntini
- Bulk bar con obiettivo + Email/WhatsApp/LinkedIn
- Mock data visibili per oggi quando il toggle è attivo

Dettagli tecnici
- `src/App.tsx`
  - oggi `/agenda` → `Agenda`
  - il componente `Agenda` è ancora quello vecchio
- `src/pages/Agenda.tsx`
  - va riscritto o riallineato alla struttura della nuova agenda
- `src/pages/Reminders.tsx`
  - contiene già il layout corretto a libro
- `src/pages/Outreach.tsx`
  - contiene il toggle mock oggi invisibile da Agenda
- `src/hooks/useOutreachMock.ts`
  - da trasformare in hook mock condiviso o da riusare anche in Agenda
- `src/hooks/useAgendaDayActivities.ts`
  - già supporta i mock, ma oggi li legge tramite una chiave che l’utente non controlla da Agenda

Ordine di esecuzione
1. Spostare/riutilizzare la nuova agenda dentro `src/pages/Agenda.tsx`
2. Aggiungere il toggle mock nell’header della pagina Agenda
3. Centralizzare la logica mock e mantenere compatibilità con lo storage attuale
4. Rifinire il layout per viewport compatta
5. Verificare che con `Mock ON` l’agenda mostri subito dati reali demo nella data odierna

Risultato atteso
- Entrando in `/agenda`, l’utente vede davvero la nuova agenda a libro
- In alto vede subito il toggle mock
- Attivando il toggle, compaiono attività e reminder demo senza dover passare da Outreach
- L’interfaccia corrisponde finalmente a quanto era stato descritto
