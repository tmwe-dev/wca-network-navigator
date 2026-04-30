Ripristino esattamente il comportamento storico dei filtri: una sidebar contestuale a scomparsa, richiamabile con linguetta, con dentro i filtri CRM/Network/BCA.

Piano di intervento:

1. Ripristinare la sidebar filtri laterale
- In `AuthenticatedLayout.tsx` rimuovo il nuovo rail fisso `ContextFiltersRail` dal layout principale.
- Mantengo il contenuto pagina a larghezza piena, senza avere i filtri sempre dentro la maschera.
- La sidebar filtri tornerà come pannello laterale apribile/chiudibile.

2. Ripristinare la linguetta sempre disponibile
- Aggiungo una linguetta verticale lato sinistro, subito dopo la navigazione principale.
- La linguetta apre/chiude i filtri contestuali.
- Deve restare visibile anche quando il pannello filtri è chiuso.
- Su desktop sarà una linguetta laterale; su mobile/tablet resta il drawer.

3. Rimettere i filtri dentro la sidebar, non nella maschera
- CRM: dentro la sidebar rimetto `CRMFiltersSection`.
- Network: dentro la sidebar rimetto `NetworkFiltersSection`.
- Biglietti/BCA: dentro la sidebar rimetto `BCAFiltersSection`.
- Il contenuto sarà determinato dalla rotta, usando la logica già presente in `ContextFiltersRail`.

4. Preservare navigazione principale e comportamento collassabile
- La sidebar di navigazione principale resta presente.
- Il pulsante menu nell’header continuerà a collassare/espandere la navigazione principale, ma non deve eliminare i filtri.
- La linguetta filtri sarà indipendente dalla sidebar di navigazione.

5. Pulizia regressione
- Aggiorno o sostituisco `ContextFiltersRail.tsx` per diventare un pannello a scomparsa, non una rail sempre visibile.
- Evito modifiche a database, business logic o query.
- Verifico sulla rotta attuale `/v2/pipeline/contacts` che i filtri CRM siano nel pannello laterale e che la pagina non li abbia più incollati nella maschera.