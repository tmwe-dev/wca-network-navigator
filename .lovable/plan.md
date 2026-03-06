

## Piano: Refactoring completo della barra filtri Contatti

### Problema attuale
La barra filtri occupa troppo spazio verticale con blocchi impilati (Cerca, Raggruppa, Circuito, 3 select, Date con input HTML brutti). Il date picker nativo è inutilizzabile nel tema dark. L'AI bar, i filtri, il sort e i toggle sono tutti ammassati senza gerarchia visiva.

### Nuovo layout proposto

Design compatto su 3 righe principali con datepicker Popover:

```text
┌──────────────────────────────────────────────────────────┐
│ 🤖 [_________ Chiedi all'AI... _________] [▶]          │  ← AI bar (se presente)
├──────────────────────────────────────────────────────────┤
│ 🔍 [_________ Cerca... _________]                       │  ← Ricerca testo
│                                                          │
│ [🌍] [📍] [🏷] [📅]  │  ≡Tutti  ✈In attesa  ⚪Da lav. │  ← Raggruppa + Circuito
│                                                          │
│ 🌍 [Tutti ▾]  📍 [Tutte ▾]  🏷 [Tutti ▾]  📂 [Tutti ▾]│  ← Filtri inline (4 col)
│                                                          │
│ 📅 [__ Dal __]📅  →  [__ Al __]📅   ↕ [Azienda A→Z ▾] │  ← Date picker + Sort
└──────────────────────────────────────────────────────────┘
```

### Modifiche dettagliate

**1. `src/components/contacts/ContactFiltersBar.tsx`** — Riscrittura completa

- **AI Bar**: resta in cima, invariato
- **Riga 1**: Campo ricerca senza wrapper `FilterBlock`, solo l'input con icona
- **Riga 2**: Raggruppa (icon buttons) + separatore + Circuito (icon+label buttons) — compatto su una riga, come ora ma con spacing migliore
- **Riga 3**: Filtri inline in griglia 4 colonne (Paese, Origine, Status, Gruppo import) — tutto su una riga, label integrate nel Select come placeholder, no `FilterBlock` wrapper
- **Riga 4**: Date range con **Popover + Calendar** (shadcn DatePicker) per entrambe le date + Select ordinamento (spostato qui dalla `ContactListPanel`)
- Rimuovere `FilterBlock` component — usare label inline o placeholder nei Select
- Padding e gap ridotti: `p-2 gap-1.5` invece di `p-3 gap-2`

**2. `src/components/contacts/ContactListPanel.tsx`** — Spostare sort nella FilterBar

- Rimuovere il sort bar separato (righe 406-421)
- Passare `sortKey` e `onSortChange` come props alla `ContactFiltersBar`
- La FilterBar gestisce il select ordinamento nella riga date

**3. Date Picker** — Usare Popover + Calendar di shadcn

- Sostituire `<Input type="date">` con due bottoni che aprono un `Popover` con `Calendar` (già installato)
- Format data con `date-fns` (`format(date, "dd/MM/yyyy")`)
- Aggiungere `pointer-events-auto` al Calendar come da istruzioni shadcn
- Bottone "Reset" per cancellare le date

### Props aggiornate di ContactFiltersBar

```typescript
interface Props {
  filters: ContactFilters;
  onChange: (f: Partial<ContactFilters>) => void;
  countries: string[];
  origins: string[];
  importGroups?: ImportGroup[];
  groupCounts?: ContactGroupCount[];
  totalContacts?: number;
  selectedCount?: number;
  sortKey: string;
  onSortChange: (key: string) => void;
  onAICommand?: (cmd: AICommand) => void;
}
```

### File da modificare

| File | Azione |
|------|--------|
| `src/components/contacts/ContactFiltersBar.tsx` | Riscrittura completa del layout |
| `src/components/contacts/ContactListPanel.tsx` | Rimuovere sort bar, passare sort come props |

