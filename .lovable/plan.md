# Cambio Origine in Bulk dai Contatti CRM

## Obiettivo
Permettere, dalla pagina Contatti CRM (`/v2/explore/contacts`), di selezionare N contatti e riassegnare la loro `origin` in un colpo solo: o scegliendo un'origine esistente, o digitandone una nuova. Aggiornamento server immediato, refresh lista e chip filtri.

## UX

Nel pannello destro `BulkActionsPanel` (quello con "AZIONI BULK"), aggiungere — solo per source `crm` — una nuova riga azione:

- **Cambia origine** (icona `Tag`/`FolderInput`) → apre dialog.

Dialog "Cambia origine":
- Header: "Sposti N contatti"
- Combobox unica con:
  - lista delle origini esistenti (`origin` distinct dal DB, ordinata per frequenza, conteggio a destra)
  - opzione "Crea nuova origine: «testo digitato»" se la stringa digitata non esiste
- Anteprima: mostra l'origine attuale dei contatti selezionati raggruppata (es. "Da: TIPOGRAFIA (10), – (4)")
- Pulsanti: Annulla / Conferma sposta
- Conferma → chiama DAL → toast → invalida query → chiude dialog e pulisce selezione

Niente bottone in topbar: l'azione vive nel pannello "N selezionati" già presente, dove convivono "Aggiungi al Cockpit", "Deep Search batch", ecc. È coerente con il pattern attuale e l'utente la trova nello stesso posto delle altre azioni di massa.

## Implementazione

### 1. DAL — `src/data/contacts/mutations.ts` (nuovo o esteso)
- `bulkUpdateOrigin(contactIds: string[], newOrigin: string): Promise<{updated: number}>`
- `listDistinctOrigins(): Promise<{origin: string; count: number}[]>` (cached 5 min con react-query)
- Usa `supabase.from("imported_contacts").update({ origin: newOrigin }).in("id", ids)` via accesso untyped centralizzato.
- Trim, normalizza maiuscolo/minuscolo? **No**: rispetta esattamente quanto digitato (così l'operatore può unificare manualmente). Limite 100 char, non vuoto.

### 2. Hook — `src/v2/hooks/contacts/useBulkChangeOrigin.ts`
- React-query mutation che chiama il DAL e invalida `queryKeys.crmContacts.*` + `queryKeys.crmContacts.distinctOrigins`.

### 3. UI — `src/v2/ui/organisms/BulkChangeOriginDialog.tsx`
- Dialog shadcn con Combobox (Command + Popover), validazione zod (1-100 char), preview origini correnti, conta destinazioni.

### 4. `BulkActionsPanel`
- Nuova prop opzionale `onChangeOrigin?: (selected) => void` + `availableOrigins?: {origin; count}[]`.
- ActionRow "Cambia origine" mostrato solo se `onChangeOrigin` è passato.

### 5. `EntityListWithDetail`
- Forwarda `onChangeOrigin` e `availableOrigins` al pannello.

### 6. `ContactsPage`
- Carica `useDistinctOrigins()`, gestisce stato dialog aperto + selezione corrente, chiama mutation, toast.
- Passa `onChangeOrigin` solo qui (NetworkPage non lo riceve, quindi su WCA Partner non appare).

## Note tecniche
- Tabella reale: `imported_contacts.origin` (text, nullable). Le origini esistenti più frequenti sono già quelle visibili nei filtri (es. "TIPOGRAFIA", "WCA OLD", "Hubspot"…).
- Soft-delete: l'UPDATE non è intercettato dai trigger soft-delete (riguardano solo DELETE), quindi il cambio origine è un UPDATE diretto sicuro.
- Audit: opzionale, lascio fuori per non gonfiare lo scope. Se serve, in seguito si aggiunge una riga in `contact_interactions` o un log dedicato.
- RLS: l'utente già ha permesso UPDATE su `imported_contacts` (CRM standard). Verifico in fase di build con un select di prova.

## Out of scope
- Merge di origini duplicate ("BOLOGNA VINI" vs "Bologna vini") — utile ma è un'altra feature.
- Bulk change su WCA Partner (`source="wca"`): le origini lì sono diverse (`source_type`), niente azione per ora.

## Cosa NON cambia
- Nessuna modifica a NetworkPage, BCA, Cestinone.
- Nessuna modifica al filtro origine esistente (lo riusa, semplicemente la lista filtri si aggiorna grazie all'invalidate).

