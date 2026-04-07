
Problema capito: l’elenco non è sparito “per caso”, è stato implementato in modo che di fatto non emerge nella sidebar come navigatore vero.

## Perché oggi non lo vedi

Dalla struttura attuale di `FiltersDrawer.tsx` risultano 4 problemi concreti:

1. `CRMContactNavigator` esiste davvero, ma viene renderizzato in fondo alla `CRMFiltersSection`, sotto tanti blocchi filtro.
   - Quindi visivamente sembra una sidebar solo filtri.
   - Su viewport come il tuo, il navigatore contatti resta troppo in basso.

2. Non c’è un controllo chiaro “Raggruppa per” nella sidebar CRM.
   - Il navigator usa `g.filters.groupBy`, ma nella sidebar non stai scegliendo in modo evidente il grouping.
   - Quindi resti bloccato sul default `country`.

3. C’è una incoerenza tra UI e RPC:
   - UI usa `lead_status` / `import_group`
   - RPC `get_contact_group_counts()` restituisce `status` / `date`
   - Risultato: alcuni gruppi non combaciano correttamente.

4. I gruppi nel drawer non sono filtrati con gli stessi filtri della lista centrale.
   - La lista centrale usa `crmSelectedCountries`, `crmOrigin`, `leadStatus`, `crmChannel`, `crmQuality`, `holdingPattern`
   - Il navigator invece carica i gruppi da RPC “grezza” e i contatti per gruppo con query quasi indipendente
   - Quindi la sidebar e la lista non parlano davvero la stessa lingua.

## Obiettivo

Far diventare la sidebar sinistra CRM un navigatore reale, come nel Network:

```text
Sidebar CRM
├ Cerca
├ Raggruppa per
├ Filtri rapidi
├ Gruppi contatti
│  ├ Italy
│  │  ├ Contatto A
│  │  ├ Contatto B
│  ├ WCA OLD
│  │  ├ Contatto C
│  │  ├ Contatto D
```

## Piano di allineamento

### 1. Rendere il navigatore visibile subito
In `src/components/global/FiltersDrawer.tsx` sposterò il blocco navigatore più in alto nella sezione CRM:

Ordine nuovo:
1. Cerca
2. Raggruppa per
3. Navigatore contatti
4. Filtri avanzati (paesi, origine, stato, circuito, qualità, canale, ordina)

Così la sidebar smette di sembrare un pannello filtri puro.

### 2. Aggiungere un controllo esplicito “Raggruppa per”
Userò `CRM_GROUPBY` già presente per mostrare chip o tab compatti:
- Paese
- Origine
- Stato
- Gruppo import

Questo renderà immediato capire perché i contatti sono raggruppati in un certo modo.

### 3. Correggere la mappatura dei gruppi
Va riallineata la logica tra:
- `CRM_GROUPBY`
- `CRMContactNavigator`
- `get_contact_group_counts()`

Decisione consigliata:
- mantenere lato UI: `country | origin | lead_status | import_group`
- adattare il navigator a tradurre i valori RPC esistenti
oppure
- estendere la sorgente dati gruppi per includere davvero `lead_status` e `import_group`

Così evitiamo mismatch come `status` vs `lead_status`.

### 4. Sincronizzare sidebar e lista centrale
Il navigatore deve usare gli stessi filtri attivi della lista contatti:
- ricerca
- paesi selezionati
- origini
- holding pattern
- stato lead
- qualità
- canale

In pratica:
- i conteggi gruppo devono riflettere i filtri correnti
- l’espansione gruppo deve mostrare solo i contatti coerenti con quei filtri

### 5. Rendere la selezione realmente “da sidebar”
La selezione via `crm-select-contact` già esiste e `Contacts.tsx` la ascolta.
Va solo resa coerente in UX:
- evidenziazione stabile nella lista centrale
- chiusura drawer dopo click
- gruppo/contatto visivamente chiari e densi come nel Network

### 6. Ridurre il peso dei filtri in alto
La parte filtri CRM oggi occupa troppo spazio.
La compatto così:
- Paesi con area collassabile o altezza più corta
- Origini con chip scrollabili
- Ordina meno invasivo
- Stato/circuito/canale/qualità in griglie più strette

Obiettivo: lasciare più spazio verticale all’elenco contatti.

## File coinvolti

| File | Intervento |
|---|---|
| `src/components/global/FiltersDrawer.tsx` | Riordinare layout CRM, aggiungere “Raggruppa per”, dare priorità visiva al navigatore, sincronizzare i filtri col navigator |
| `src/pages/Contacts.tsx` | Mantenere la selezione guidata da evento, verificare evidenziazione coerente dopo click sidebar |
| `src/hooks/useContactGroups.ts` oppure logica in `FiltersDrawer.tsx` | Allineare group keys/types ai valori reali usati nel CRM |
| `supabase/migrations/...get_contact_group_counts...` | Solo se serve estendere i raggruppamenti reali a `lead_status` e `import_group` |

## Scelta progettuale consigliata

La soluzione migliore non è “aggiungere ancora roba”, ma fare questa gerarchia:

```text
TOP: cerca + raggruppa
MID: elenco gruppi/contatti
BOTTOM: filtri avanzati
```

Perché il tuo uso principale lì non è filtrare: è navigare e selezionare velocemente i contatti.

## Risultato atteso

Dopo l’allineamento:
- apri la sidebar CRM
- vedi subito gruppi e contatti
- scegli come raggrupparli
- clicchi un contatto preciso
- si aggiorna lista centrale + dettaglio a destra
- i filtri restano disponibili ma non nascondono più il navigatore

## Nota tecnica importante

In questo momento il codice conferma che l’elenco è stato inserito, ma è stato integrato male nella gerarchia della sidebar. Quindi il fix corretto non è “aggiungerlo di nuovo”, ma:
- renderlo visibile,
- metterlo nella posizione giusta,
- e farlo usare gli stessi criteri della lista centrale.
