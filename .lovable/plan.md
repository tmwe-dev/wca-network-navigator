

# Piano: Alias, Filtri Contatto e Cancella Attivita

## Obiettivo

Migliorare la vista Attivita mostrando gli alias (azienda e contatto), aggiungere filtri per partner senza email/contatto, un pulsante "Genera Alias" e la possibilita di cancellare attivita (singole o in bulk).

## Modifiche

### 1. Query `useAllActivities` -- aggiungere alias

Estendere la select per includere:
- `partners.company_alias` nel join partners
- `partner_contacts.contact_alias` nel join selected_contact

### 2. Hook `useDeleteActivities` (nuovo in useActivities.ts)

Aggiungere una mutation per cancellare attivita per lista di ID:
```text
DELETE FROM activities WHERE id IN (...)
```
Invalida le query `all-activities` e `activities` al successo.

### 3. Componente `ActivitiesTab.tsx` -- nuove funzionalita

**a) Mostrare alias nella riga attivita:**
- Nome azienda: mostra `company_alias` come badge accanto a `company_name`
- Contatto selezionato: mostra `contact_alias` (cognome) accanto al nome completo

**b) Nuovi filtri:**
- "Contatto" con opzioni: Tutti / Senza email / Senza contatto / Senza alias
  - "Senza email": il partner non ha contatti con email (basato su contactsMap)
  - "Senza contatto": il partner non ha contatti affatto (contactsMap vuoto)
  - "Senza alias": il partner non ha company_alias o il contatto selezionato non ha contact_alias

**c) Pulsante "Genera Alias" sopra i filtri:**
- Chiama la edge function `generate-aliases` passando i country codes dei paesi visibili
- Mostra spinner durante l'elaborazione
- Al completamento, invalida le query e mostra toast con risultato

**d) Cancella attivita:**
- Pulsante cestino su ogni riga attivita per cancellazione singola
- Quando il filtro "Senza email" o "Senza contatto" e attivo, mostra un pulsante bulk "Cancella filtrate" nella barra sopra i risultati che cancella tutte le attivita visibili
- Conferma con dialog prima della cancellazione bulk

### 4. Riepilogo file modificati

| File | Modifica |
|------|----------|
| `src/hooks/useActivities.ts` | Aggiunge alias nei tipi e nella query; aggiunge `useDeleteActivities` |
| `src/components/agenda/ActivitiesTab.tsx` | Aggiunge alias visibili, filtro contatto, pulsante Genera Alias, cancella singola/bulk |

Nessuna modifica al database necessaria -- i campi `company_alias` e `contact_alias` esistono gia.

