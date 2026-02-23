

# Filtri combinabili nel Workspace ContactListPanel

## Problema attuale

I filtri nel ContactListPanel del Workspace sono **mutuamente esclusivi** (radio): puoi selezionare solo "Con email" OPPURE "Senza alias", ma non entrambi contemporaneamente. Inoltre manca il filtro "Senza alias".

Nell'Agenda (ActivitiesTab), i filtri sono invece **indipendenti e combinabili** con logica AND.

## Soluzione

Trasformare i filtri da chip esclusivi a **toggle indipendenti** (multi-select), permettendo combinazioni come "Con email + Senza alias". Aggiungere anche i filtri mancanti.

## Filtri disponibili (tutti combinabili)

| Filtro | Logica |
|--------|--------|
| Con email | `contact?.email` presente |
| Senza email | `contact?.email` assente |
| Con contatto | `selected_contact` presente |
| Senza contatto | `selected_contact` assente |
| Con alias | `contact_alias` O `company_alias` presente |
| Senza alias | `contact_alias` E `company_alias` assenti |

## Dettagli tecnici

**File: `src/components/workspace/ContactListPanel.tsx`**

1. Sostituire `FilterType` (stringa singola) con un `Set<string>` per i filtri attivi
2. Click su un chip lo attiva/disattiva (toggle), piu chip possono essere attivi contemporaneamente
3. Il chip "Tutti" resetta tutti i filtri
4. Logica di filtraggio AND: ogni filtro attivo deve essere soddisfatto
5. I contatori dinamici su ogni chip mostrano quanti record corrispondono a quel criterio nel set corrente (come nel Partner Hub Workbench)
6. Aggiungere i filtri mancanti: "Con contatto" e "Senza alias"

Il tipo diventa:
```typescript
type FilterKey = "with_email" | "no_email" | "with_contact" | "no_contact" | "with_alias" | "no_alias";
const [activeFilters, setActiveFilters] = useState<Set<FilterKey>>(new Set());
```

La logica di filtraggio applica tutti i filtri attivi in AND:
```typescript
const filtered = searched.filter((a) => {
  for (const f of activeFilters) {
    if (f === "with_email" && !a.selected_contact?.email) return false;
    if (f === "no_email" && a.selected_contact?.email) return false;
    // ... etc
  }
  return true;
});
```

Filtri mutuamente contraddittori (es. "con email" + "senza email") sono gestiti automaticamente: il risultato sara semplicemente vuoto, senza errori.

