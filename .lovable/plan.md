
Obiettivo: riallineare Campaigns e Global alla fonte di verità dei dati, come da documento: prima si decide dove vive la verità, poi si costruisce la UI.

Cosa ho verificato
- Nel database `partners`, Albania (`AL`) ha davvero 12 partner attivi.
- Oggi il dropdown di `Campaigns` non è guidato in modo puro dalla tabella `partners`: passa da `usePartnersForGlobe()`, che costruisce la lista paesi partendo da `src/data/wcaCountries.ts` e poi innesta i conteggi.
- Quindi la UI sta mescolando due fonti:
  - `partners` = dati operativi reali
  - `wcaCountries.ts` = riferimento statico geografico
- La sidebar porta “Global” dentro “Campagne” perché in `src/App.tsx` c’è un redirect esplicito:
  - `/global` → `/campaigns`
- Non esiste oggi una pagina `Global` dedicata; la base distinta già presente nel repo è `src/pages/Operations.tsx`.

Piano di correzione

1. Rendere `partners` la fonte di verità del dropdown Campaigns
- Creare una logica dedicata per aggregare da `partners`:
  - `country_code`
  - `country_name`
  - count partner reali
- Il dropdown Partner userà questi dati reali, non il dataset statico come fonte primaria.

2. Tenere la lista completa dei paesi, ma con overlay reale
- Mantengo tutti i paesi visibili.
- Per i paesi presenti nel DB:
  - nome e count arrivano da `partners`
- Per i paesi assenti:
  - count = `0`, in grigio
- In questo modo Albania dovrà mostrare `12`.

3. Separare responsabilità: globo vs dropdown
- `wcaCountries.ts` resta solo per:
  - coordinate
  - flag/fallback geografici
  - supporto al globo 3D
- `usePartnersForGlobe` continua a servire il globo.
- `Campaigns.tsx` smette di usare il hook del globo come fonte del dropdown/header.

4. Ripristinare Global come maschera distinta
- Rimuovere il redirect `/global -> /campaigns`.
- Collegare `/global` alla pagina distinta già esistente nel progetto (`Operations`) oppure a un wrapper `Global` dedicato basato su quella pagina.
- `Campagne` resta la pagina globo/campagne.
- `Global` torna a essere una pagina separata, come richiesto.

5. Chiarire i contatori in header
- Rendere espliciti i badge per evitare ambiguità:
  - Paesi totali
  - Paesi attivi
  - Partner
- Così non si confonde più la lunghezza della lista con il numero reale di partner.

File coinvolti
- `src/hooks/usePartnersForGlobe.ts`
- `src/pages/Campaigns.tsx`
- `src/App.tsx`
- `src/pages/Operations.tsx` oppure nuovo `src/pages/Global.tsx`

Risultato atteso
- In `Campaigns`, il dropdown Partner mostra i numeri reali della tabella `partners`
- Albania mostra `12`
- I paesi a zero restano visibili in grigio
- `Global` e `Campagne` tornano a essere due maschere diverse
- La sidebar non manda più “Global” dentro “Campagne”
