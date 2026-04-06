

# Matching manuale BCA + Bordo colore per origine

## 1. Matching manuale per biglietti "no match"

Nella card di dettaglio di un biglietto con `match_status === "unmatched"` (pannello destro di BusinessCardsHub), aggiungere un blocco "Cerca partner":

- Input di ricerca che esegue una query fuzzy su `partners` (via `ilike` su `company_name` e `company_alias`)
- Risultati ordinati per **paese, citta, nome**
- L'utente clicca sul partner corretto per confermarlo
- Al click: `updateBusinessCard({ id, matched_partner_id: partner.id, match_status: "matched", match_confidence: 100 })`
- Se nessun risultato va bene, l'utente lascia il biglietto come "unmatched"

Nessuna estensione PostgreSQL necessaria — si usa `ilike('%termine%')` lato client con una query Supabase standard.

## 2. Bordo sinistro colorato per origine nelle card BCA

Applicare lo stesso pattern del Cockpit (`originAccent`) alle card del BusinessCardsHub. Ogni card avrà un bordo sinistro di 3px con gradiente colore basato sull'origine:

- **WCA** (matched con partner WCA): `from-chart-1/60` (blu/viola)
- **BCA** (biglietto da visita senza match): `from-amber-500/60` (ambra)
- **Import** (importati da file): `from-chart-3/60` (verde acqua)
- **Manual** (inseriti manualmente): `from-emerald-500/60` (verde)

La logica determina l'origine dal `match_status`:
- `matched` + `partner.id` presente → WCA
- `unmatched` o `pending` → BCA

Si aggiunge il `div` con classe `absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l` a tutte e 3 le view (CompactRow, CardView, ExpandedView), più una sfumatura di colore leggera nel background della riga superiore della card.

## 3. Stessa logica nel CRM (CompactContactCard)

Le card dei contatti importati (`imported_contacts`) avranno il bordo sinistro basato sul campo `origin`:
- `wca` → chart-1
- `import` → chart-3
- `bca` → amber-500
- `manual` → emerald-500
- `report_aziende` → chart-4

Identico al Cockpit.

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/contacts/BusinessCardsHub.tsx` | Aggiungere bordo sinistro colorato alle 3 view mode + pannello ricerca manuale partner nel dettaglio |
| `src/components/import/CompactContactCard.tsx` | Aggiungere bordo sinistro colorato per origine |

Nessuna migrazione DB, nessun nuovo file.

