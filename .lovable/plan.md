
# Proposta restyling sidebar filtri (WCA Partner + CRM)

Obiettivo: rendere la sidebar leggibile, "respirata" e con campi/filtri chiaramente riconoscibili. Nessun cambio di logica o di dati — solo presentazione.

## Problemi attuali (dallo screenshot)

1. Tutto è incollato al bordo sinistro/destro: zero margine interno.
2. Header "WCA Partner" + descrizione occupano spazio ma non aiutano.
3. Gli `Input` (Cerca, Cerca paese) sono `bg-muted/30` su sfondo scuro → quasi invisibili, sembrano testo.
4. Le label di sezione (CERCA, PAESI, QUALITÀ DATI, ORDINA PARTNER) sono micro-testo (10px) allineate a sinistra senza separatori → tutto sembra un blocco unico.
5. I chip "Qualità dati" e "Ordina" sono sparsi a sinistra senza griglia → caotici, soprattutto "Senza email", "Senza contatti" che vanno a capo male.
6. Nessuna gerarchia visiva tra "filtri primari" (paesi, ricerca) e "filtri secondari" (qualità, sort).

## Proposta visiva

```text
┌─────────────────────────────────────┐
│  [icona] FILTRI WCA PARTNER         │  ← header compatto, 1 riga
├─────────────────────────────────────┤
│                                     │
│   🔍  Cerca partner                 │  ← label sopra il campo
│   ┌───────────────────────────────┐ │
│   │ 🔍  Partner, azienda, email…  │ │  ← input con bordo visibile,
│   └───────────────────────────────┘ │     bg più chiaro, h-9
│                                     │
│  ─────────────────────────────────  │  ← divider netto
│                                     │
│   🌍  Paesi          [3 attivi ✕]   │  ← contatore + reset inline
│   ┌───────────────────────────────┐ │
│   │ 🔍 Cerca paese…               │ │
│   └───────────────────────────────┘ │
│   ╔═══════════════════════════════╗ │
│   ║ 🇨🇳 China              2.471  ║ │  ← lista in card con
│   ║ 🇺🇸 United States      1.080  ║ │     bordo + righe alternate
│   ║ 🇮🇳 India ✓              689  ║ │
│   ╚═══════════════════════════════╝ │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ✨  Qualità dati                  │
│   ┌──────────┬──────────┬─────────┐ │  ← griglia 2-3 colonne,
│   │  Tutti   │ 📧 Email │ 📱 Tel  │ │     chip uniformi
│   ├──────────┼──────────┼─────────┤ │
│   │🔗 Profilo│❌ No mail│👤 No ctt│ │
│   └──────────┴──────────┴─────────┘ │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ↕  Ordina                         │
│   ┌──────────┬──────────┬─────────┐ │
│   │  Nome    │  Rating  │ Recenti │ │
│   └──────────┴──────────┴─────────┘ │
│                                     │
│  ─────────────────────────────────  │
│                                     │
│   ⚡  Azioni                        │
│   [   🔄  Sincronizza WCA       ]   │
│                                     │
└─────────────────────────────────────┘
```

## Modifiche concrete

### A. Container sidebar
- `ContextFiltersRail`: aggiungere `px-4 py-3 space-y-4` al wrapper `.overflow-y-auto`.
- Header sezione (`Filtri WCA Partner`) ridotto a 1 riga, niente descrizione.

### B. `FilterSection` (`shared.tsx`)
- Label da `10px uppercase` → `11px font-semibold` con icona 14px e padding-bottom `mb-2`.
- Aggiungere variante con "trailing slot" (per il contatore "3 attivi ✕" sui Paesi).
- Aggiungere `<Separator />` automatico tra sezioni (oppure gestito dal container con `divide-y`).

### C. Input (Cerca / Cerca paese)
- Sostituire `bg-muted/30 border-border/40` → `bg-background border-border h-9` con `focus-visible:ring-1 ring-primary`.
- Icona 🔍 dentro il campo a sinistra (`pl-9`), placeholder con opacità 60%.
- Stessa altezza (h-9) per tutti i campi → coerenza.

### D. Lista paesi
- Wrap in `Card` con `border` netto, niente `bg-muted/10`.
- Riga selezionata: `bg-primary/10 border-l-2 border-primary` (ora è `bg-primary/15` pieno).
- Hover più visibile: `hover:bg-muted`.
- Pillola "Paesi attivi" sopra la lista come badge inline accanto al titolo, non come blocco a parte.

### E. Chip gruppo (Qualità + Sort)
- `ChipGroup` riceve prop `columns?: 2 | 3` e passa a `grid grid-cols-{n} gap-1.5`.
- Chip: altezza fissa `h-8`, testo centrato, larghezza 100% della cella → niente più chip che vanno a capo storti.
- Stato attivo: bordo `border-primary` pieno + `bg-primary/15`, non solo opacity.

### F. Pulsante azione (Sincronizza WCA)
- Variant `default` (primary) invece di `outline` per dargli peso, full-width h-9.

### G. CRM (`CRMFiltersSection`)
Applicare lo stesso schema: padding container, input h-9 con bordo visibile, chip in grid 2 colonne, divider tra sezioni.

## File toccati (solo UI/preset)

- `src/components/global/filters-drawer/shared.tsx` — aggiornare `FilterSection`, `ChipGroup` (prop `columns`), `Chip` (h-8 full-width quando in grid).
- `src/components/global/filters-drawer/NetworkFiltersSection.tsx` — header compatto, input con icona e bordo, contatore Paesi inline, chip in grid.
- `src/components/global/filters-drawer/CRMFiltersSection.tsx` — stesso trattamento.
- `src/components/contacts/bca/BCAFiltersRailContent.tsx` — allineare stile (container padding + chip grid).
- `src/v2/ui/templates/ContextFiltersRail.tsx` — aggiungere `px-4 py-4 space-y-4 divide-y divide-border/40` al contenuto scrollabile + header sezione più compatto.

Nessuna modifica a hook, contesti o query: solo classi Tailwind e piccoli ritocchi di markup.

## Domanda prima di procedere

Vuoi che applichi anche **icone emoji native** dentro i chip qualità (📧 📱 🔗 ❌ 👤) per aumentare la riconoscibilità immediata, oppure preferisci un look più "enterprise" con sole icone Lucide monocrome a sinistra del testo?
