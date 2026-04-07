
# Inserire davvero tutti i contatti nella sidebar sinistra CRM

## Problema reale
Oggi nel CRM la sidebar sinistra mostra solo filtri (`CRMFiltersSection` in `FiltersDrawer.tsx`): paesi, origini, stato, ecc.
Non mostra un navigatore di contatti.

In più la sidebar invia già l’evento `crm-select-contact`, ma `Contacts.tsx` non lo usa come selezione primaria: quindi non può funzionare come elenco contatti vero.

## Cosa costruisco
1. **Sidebar CRM = filtri + elenco contatti**
   - parte alta: filtri compatti
   - parte bassa: elenco completo dei contatti, scrollabile e cliccabile

2. **Gruppi veri dentro la sidebar**
   - attivo il `groupBy` già previsto (`country`, `origin`, `status`, `date`)
   - ogni gruppo sarà espandibile
   - dentro ogni gruppo compariranno i contatti reali
   - quindi non vedrai solo “Italy / United States”, ma anche i contatti interni

3. **Selezione precisa**
   - click su un contatto nella sidebar = selezione per `id` esatto
   - evidenziazione coerente nella lista centrale
   - dettaglio destro aggiornato sul contatto corretto

4. **Ricerca e filtri sincronizzati**
   - la ricerca nella sidebar selezionerà davvero il contatto
   - paesi/origini/stato aggiorneranno anche i gruppi della sidebar
   - reset CRM svuoterà anche i filtri CRM rimasti attivi

## File da toccare
- `src/components/global/FiltersDrawer.tsx`
  - trasformo la sezione CRM in un drawer ibrido: filtri sopra, gruppi+contatti sotto
  - collego `groupBy`, paesi, origini e ricerca al navigatore
- `src/pages/Contacts.tsx`
  - passo a selezione guidata da `selectedContactId`
  - ascolto `crm-select-contact` per selezionare dalla sidebar
- `src/hooks/useContacts.ts`
  - aggiungo fetch leggero per sidebar e fetch singolo per selezione diretta
- `src/components/contacts/GroupStrip.tsx`
  - adatto il rendering gruppo al formato sidebar
- `src/components/contacts/ExpandedGroupContent.tsx`
  - riattivo/adatto il contenuto espanso per mostrare i contatti nel drawer

## Struttura finale
```text
SIDEBAR SX CRM
├ Cerca
├ Filtri rapidi
├ Raggruppa per
├ Italy
│  ├ Contatto A
│  ├ Contatto B
├ United States
│  ├ Contatto C
│  ├ Contatto D
└ ...
```

## Risultato atteso
La sidebar sinistra del CRM diventa finalmente un **navigatore contatti completo**, non solo un pannello filtri.
Il pannello destro non lo tocco: resta il template buono che hai approvato.

## Database
Nessuna modifica database: tutto lato UI/hooks.
