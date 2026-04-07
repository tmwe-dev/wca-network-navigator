

# Ristrutturazione completa sidebar CRM — Semplificazione radicale

## Problema

La sidebar CRM è un disastro di usabilità:
1. **Origini** mostrate come decine di chip espansi → occupano un metro di spazio
2. **Stato/Circuito/Canale/Qualità** in 4 blocchi di chip sparsi → confusione
3. **Paesi** relegati in fondo → invisibili
4. **Click su gruppo** apre la lista contatti DENTRO la sidebar → inutile, l'utente vuole solo filtrare e poi vedere i risultati nella pagina principale
5. **Formattazione**: origini in minuscolo/maiuscolo misto, nessuna capitalizzazione
6. **Nessun arricchimento** dei gruppi (bandiere top, periodo dati, ecc.)

## Soluzione: Sidebar compatta con dropdown multi-select

Ispirarsi alla sezione Network che funziona bene: cerca + filtri puliti + lista paesi con ricerca.

### Layout nuovo della CRM section

```text
┌─────────────────────────────┐
│ 🔍 CERCA                    │  ← come oggi, con risultati inline
│ [Contatto, azienda, email…] │
│ (risultati ricerca inline)  │
├─────────────────────────────┤
│ 📊 RAGGRUPPA PER            │  ← chip: Paese | Origine | Stato | Gruppo
│ [Paese] [Origine] [Stato]   │
├─────────────────────────────┤
│ 🔽 ORIGINE          [▼ dd]  │  ← DROPDOWN multi-select con conteggi
│   ✓ WCA OLD (2659)          │     Cerca + scroll interno
│   ✓ Hubspot (707)           │     Prima lettera maiuscola
│   □ Chimica Inorganica (185)│
├─────────────────────────────┤
│ 🔽 STATO             [▼ dd] │  ← DROPDOWN: Nuovo/Contattato/Qualificato/Convertito
├─────────────────────────────┤
│ 🔽 CIRCUITO          [▼ dd] │  ← DROPDOWN: Fuori/In/Tutti
├─────────────────────────────┤
│ 🔽 CANALE            [▼ dd] │  ← DROPDOWN: Email/Tel/LI/WA
├─────────────────────────────┤
│ 🔽 QUALITÀ           [▼ dd] │  ← DROPDOWN: Arricchiti/Non arricchiti/Con alias/Senza
├─────────────────────────────┤
│ 🏳 PAESI (tutti/3 sel.)     │  ← Come Network: cerca + lista scrollabile con bandiere e conteggi
│ [Cerca paese…]              │
│ 🇮🇹 Italy         4932      │
│ 🇮🇳 India         2337      │
│ 🇺🇸 United States 1477      │
│ …                           │
├─────────────────────────────┤
│ [Reset filtri]  [Conferma]  │
└─────────────────────────────┘
```

### Cambiamenti chiave

1. **Origini → Dropdown multi-select con ricerca**
   - Collapsible dropdown che mostra le origini ordinate per conteggio
   - Ricerca interna al dropdown
   - Prima lettera maiuscola automatica (`capitalize()`)
   - Multi-select con checkbox e conteggi
   - Chiuso di default, mostra solo "N selezionati" o "Tutti"

2. **Stato/Circuito/Canale/Qualità → Dropdown singoli compatti**
   - Ogni sezione diventa un dropdown a selezione singola (o multi dove ha senso)
   - Una riga per filtro invece di un blocco di chip

3. **Eliminare l'apertura contatti dentro la sidebar**
   - Il `CRMContactNavigator` non apre più i gruppi con la lista contatti dentro
   - Click su un gruppo → imposta il filtro nel context → la pagina principale si aggiorna
   - La sidebar resta pulita, la lista si vede nella pagina

4. **Capitalizzazione e arricchimento**
   - Tutte le etichette: prima lettera maiuscola
   - Nei gruppi per paese: bandiere sempre presenti
   - Nei gruppi per origine: indicazione del numero di paesi coperti (es. "WCA OLD · 45 paesi")

5. **Paesi: identico a Network**
   - Stessa logica di Network: lista scrollabile con bandiere, conteggi, ricerca, selezione multipla

### Componente riutilizzabile: `FilterDropdownMulti`

Creare un componente generico usabile ovunque:
```typescript
interface FilterDropdownMultiProps {
  label: string;
  icon?: LucideIcon;
  options: Array<{ value: string; label: string; count?: number }>;
  selected: Set<string>;
  onToggle: (value: string) => void;
  searchable?: boolean; // mostra campo cerca se > 10 opzioni
  singleSelect?: boolean; // per stato/circuito
}
```

## File coinvolti

| File | Modifica |
|------|----------|
| `src/components/global/FilterDropdownMulti.tsx` | **Nuovo** — Componente dropdown multi-select riutilizzabile con ricerca, conteggi, capitalizzazione |
| `src/components/global/FiltersDrawer.tsx` | Riscrivere `CRMFiltersSection`: sostituire chip con dropdown, eliminare apertura contatti inline, semplificare layout. Riscrivere `CRMContactNavigator`: click su gruppo = imposta filtro, non apre lista |
| `src/lib/capitalize.ts` | **Nuovo** — Helper `capitalizeFirst(str)` per uniformare le etichette |

Nessuna migrazione DB.

