

## Fix: SelectItem con value vuoto in ContactDetailPanel

Il crash è causato da `<SelectItem value="">Nessuno</SelectItem>` nel dialogo "Nuova Interazione" di `ContactDetailPanel.tsx` (riga ~185). Radix UI non permette `value=""`.

### Modifica in `src/components/contacts/ContactDetailPanel.tsx`

- Cambiare `<SelectItem value="">Nessuno</SelectItem>` → `<SelectItem value="none">Nessuno</SelectItem>`
- Aggiornare `newOutcome` default e il handler per mappare `"none"` → `undefined` quando si salva l'interazione

