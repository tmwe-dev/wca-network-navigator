

## Due problemi da risolvere

### Problema 1: Contacts — Dettaglio non visibile alla selezione

**Causa**: `Contacts.tsx` cerca il contatto selezionato dentro `useContacts()` (query flat senza filtri), ma il `ContactListPanel` carica i contatti tramite `useContactsByGroup` dentro `ExpandedGroupContent`. Sono due query diverse: il contatto cliccato non esiste nell'array `contacts` di `useContacts()`, quindi `selectedContact` è sempre `null`.

**Fix**: Eliminare la dipendenza da `useContacts()` in `Contacts.tsx`. Invece, quando viene selezionato un ID, fare una query dedicata per caricare quel singolo contatto dal database (`imported_contacts` per ID). Oppure, passare l'intero oggetto contatto da `ExpandedGroupContent` → `ContactListPanel` → `Contacts.tsx` invece del solo ID.

Approccio scelto: cambiare `onSelect` da `(id: string) => void` a `(contact: Contact) => void` nel `ContactListPanel`, e in `Contacts.tsx` salvare direttamente l'oggetto contatto invece di cercarlo.

**File**:
- `src/pages/Contacts.tsx` — rimuovere `useContacts()`, salvare l'oggetto contatto selezionato direttamente
- `src/components/contacts/ContactListPanel.tsx` — cambiare `onSelect` per passare l'intero oggetto
- `src/components/contacts/ExpandedGroupContent.tsx` — passare l'oggetto contatto in `onSelect`
- `src/components/contacts/ContactCard.tsx` — verificare che passi l'oggetto corretto

---

### Problema 2: Deep Search nel Workspace limitata solo a partner WCA

**Causa**: In `Workspace.tsx` riga 115, `handleDeepSearch` estrae `partner_id` dalle attività. Per le attività con `source_type === "contact"`, `partner_id` è `null` → l'array `uniquePartnerIds` è vuoto → mostra il toast "Deep Search disponibile solo per partner WCA".

L'edge function `deep-search-partner` è progettata per lavorare sulla tabella `partners` (WCA). Per i contatti importati (`imported_contacts`), serve una logica diversa: cercare online la persona/azienda usando nome, email, azienda come query di ricerca.

**Fix**: Creare una nuova edge function `deep-search-contact` che:
1. Riceve un `contactId` (da `imported_contacts`)
2. Cerca online usando Firecrawl: nome persona + azienda, LinkedIn, profili social
3. Salva i risultati in `imported_contacts.enrichment_data` (va aggiunta la colonna) o direttamente nei campi esistenti
4. Aggiorna `deep_search_at`

Nel Workspace, quando `sourceTab === "contact"`, usare `source_id` (che punta all'`imported_contact`) e chiamare la nuova edge function invece di `deep-search-partner`.

**File**:
- `supabase/functions/deep-search-contact/index.ts` — nuova edge function
- `src/pages/Workspace.tsx` — biforcazione logica Deep Search per tipo sorgente
- `src/hooks/useDeepSearchRunner.ts` — supporto per tipo "contact" (query su `imported_contacts` invece di `partners`)
- Migration DB: aggiungere colonna `enrichment_data jsonb` a `imported_contacts` (se necessario per salvare risultati)

La nuova edge function eseguirà:
- Ricerca Firecrawl: `"Nome Cognome" azienda linkedin`
- Ricerca Firecrawl: `"Nome Cognome" azienda`
- AI analysis dei risultati per estrarre: profilo LinkedIn, ruolo, azienda attuale/passate, social links
- Salvataggio risultati nel contatto

