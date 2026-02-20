
# Fix Layout Wizard Step 1 — Sezioni ATECO che escono dallo schermo

## Problema identificato

Nel wizard (Step 1 — Settore ATECO), il layout attuale usa `h-full flex flex-col gap-3 p-4 overflow-y-auto` come wrapper esterno, ma il div interno con le sezioni ATECO ha `flex-1 space-y-2 overflow-y-auto`. Il problema è che `flex-1` richiede che il parent abbia un'altezza definita e vincolata, ma la catena di contenitori in `ProspectCenter` ha `overflow-hidden` a vari livelli che non propaga correttamente l'altezza disponibile al wizard.

Il risultato visivo: le card delle sezioni ATECO si espandono oltre i bordi del pannello, non scrollano, e il pulsante "Avanti" non è raggiungibile.

## Causa tecnica

```
ProspectCenter → TabsContent (flex-1 min-h-0) 
  → div border overflow-hidden  ← qui il contenuto è clippato
    → ProspectImporter → ImportWizard
      → div h-full flex flex-col  ← h-full funziona
        → flex-1 space-y-2 overflow-y-auto  ← flex-1 NON funziona senza min-h-0 sul parent
```

Il `div.flex-1` che contiene le sezioni ATECO manca di `min-h-0` (necessario in flexbox per consentire lo scroll interno quando il contenuto è più alto del container).

## Fix da applicare — solo `ImportWizard.tsx`

### Step 1 (linea ~209): aggiungere `min-h-0` al div delle sezioni

```tsx
// PRIMA (riga ~209)
<div className="flex-1 space-y-2 overflow-y-auto">

// DOPO
<div className="flex-1 min-h-0 space-y-2 overflow-y-auto pb-2">
```

### Step 2 (linea ~303): stesso fix
```tsx
// PRIMA
<div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">

// DOPO  
<div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">  // OK già corretto
```

### Step 3 e Step 4 (linee ~401, ~500): stesso controllo

### Wrapper principale di tutti gli step

Tutti i return di ogni step hanno il wrapper:
```tsx
<div className="h-full flex flex-col gap-3 p-4 overflow-y-auto">
```

Questo in realtà dovrebbe funzionare perché `h-full` + `overflow-y-auto` è il pattern giusto — MA solo se il parent ha un'altezza definita. 

Il vero problema è che il container padre in `ProspectCenter.tsx` ha `overflow-hidden` ma NON ha `min-h-0` nella catena di flex:

```tsx
// ProspectCenter.tsx riga ~207
<div className={`h-full rounded-2xl border overflow-hidden ...`}>
  <ProspectImporter ... />
</div>
```

Questo `div` ha `h-full` ma il `TabsContent` che lo contiene usa `flex-1 min-h-0` — questo è corretto. Il problema è all'interno di `ImportWizard`: il `div` con `flex-1 space-y-2 overflow-y-auto` che lista le sezioni ATECO manca di `min-h-0`.

## Modifiche da fare

### File: `src/components/prospects/ImportWizard.tsx`

**Modifica 1** (Step 1, riga ~209): aggiungere `min-h-0` al div scrollabile delle sezioni
```tsx
// DA
<div className="flex-1 space-y-2 overflow-y-auto">
// A
<div className="flex-1 min-h-0 space-y-2 overflow-y-auto">
```

**Modifica 2** (Step 2, riga ~309): il wrapper dello step 2 ha già `overflow-y-auto` su `h-full` — verificare che il `flex-wrap gap-2` delle regioni non esploda. Aggiungere `overflow-y-auto` al div delle province se manca.

**Modifica 3** (Tutti gli step): cambiare il wrapper da `h-full flex flex-col gap-3 p-4 overflow-y-auto` in modo che l'area del contenuto centrale scroll correttamente senza che i pulsanti "Avanti/Indietro" escano dallo schermo. Invece di far scrollare tutto il componente, meglio usare:
- Header fisso (StepBar + titolo card)
- Area centrale `flex-1 min-h-0 overflow-y-auto` 
- Footer fisso (pulsanti navigazione)

Questa struttura garantisce che i pulsanti siano sempre visibili in basso e che solo il contenuto medio scrolli.

## Struttura corretta per ogni step

```tsx
<div className="h-full flex flex-col">          // wrapper non scroll
  <div className="flex-shrink-0 p-4 pb-2">      // header fisso
    <StepBar />
    <TitoloCard />
  </div>
  
  <div className="flex-1 min-h-0 overflow-y-auto px-4 pb-2 space-y-2">
    {/* contenuto scrollabile */}
  </div>
  
  <div className="flex-shrink-0 p-4 pt-2 border-t ...">
    {/* pulsanti Indietro / Avanti — sempre visibili */}
  </div>
</div>
```

## File da modificare

| File | Operazione |
|------|-----------|
| `src/components/prospects/ImportWizard.tsx` | Refactor layout di tutti e 4 gli step per separare header/scroll/footer |

Nessuna modifica al database o a file backend necessaria.
