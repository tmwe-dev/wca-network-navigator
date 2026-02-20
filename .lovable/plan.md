
# Fix Layout: Wizard ATECO fuoriesce dalla schermata

## Problema identificato

Dalla screenshot si vedono **due problemi sovrapposti**:

1. **Altezza non vincolata**: Il wrapper `<div className="h-full">` in `ProspectImporter` (riga 230) non trasmette correttamente l'altezza al wizard figlio, perché manca `flex flex-col`. Il wizard non sa quanto spazio ha disponibile e si espande oltre il contenitore.

2. **Il footer (pulsanti Avanti/Indietro) non è visibile**: Conseguenza diretta del punto 1 — il contenuto scrollabile occupa tutto lo spazio invece di fermarsi prima del footer fisso.

## Causa tecnica

La catena di contenitori è:
```
TabsContent [flex-1 min-h-0]
  └─ div [h-full rounded-2xl overflow-hidden]         ← ProspectCenter.tsx riga 207
       └─ ProspectImporter
            └─ div [h-full]                           ← riga 230 ← MANCA flex flex-col
                 └─ ImportWizard
                      └─ div [h-full flex flex-col]   ← corretto MA il parent non è flex
```

Il `div className="h-full"` in `ProspectImporter` deve diventare `h-full flex flex-col` per propagare correttamente la struttura flex al wizard figlio, che altrimenti non riesce a calcolare lo spazio del footer.

## Fix da applicare

### File: `src/components/prospects/ProspectImporter.tsx` — 1 riga

Riga 230, cambiare:
```tsx
// DA
<div className="h-full">

// A
<div className="h-full flex flex-col">
```

Questo fa sì che il wizard figlio riceva un parent flex con altezza definita, attivando correttamente il layout `flex-1 min-h-0 overflow-y-auto` dell'area scrollabile e il `flex-shrink-0` del footer con i pulsanti.

## File da modificare

| File | Riga | Modifica |
|------|------|---------|
| `src/components/prospects/ProspectImporter.tsx` | 230 | `h-full` → `h-full flex flex-col` |

Nessuna modifica al database o a file di stile globale necessaria.
