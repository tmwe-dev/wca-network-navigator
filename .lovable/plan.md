

# Spostare i Filtri nella Sidebar Sinistra

## Concetto

Eliminare il dropdown "Filtra per stato" dalla CountryGrid (colonna 2) e rendere cliccabili le StatItem nella sidebar sinistra (colonna 1). Ogni statistica diventa un filtro diretto:

| Click su... | Filtro applicato |
|---|---|
| **Paesi** (Globe) | Tutti i paesi con dati (equivale a "Tutti") |
| **Partner** (Users) | Paesi con almeno 1 partner nel DB |
| **Profili** (FileText) | Paesi con profili presenti; secondo click filtra "senza profilo" |
| **Email** (Mail) | Paesi filtrati per presenza email |
| **Telefoni** (Phone) | Paesi filtrati per presenza telefoni |
| **Directory** (FolderDown) | Paesi mai esplorati / senza directory |

Il filtro attivo viene evidenziato visivamente con un bordo/sfondo colorato sulla StatItem corrispondente.

## Modifiche per File

### 1. `src/pages/Operations.tsx`
- Aggiungere uno stato `filterMode` (tipo stringa) al livello Operations, inizializzato a `"all"`
- Passare `filterMode` e `setFilterMode` sia alla sidebar (COL 1) che alla CountryGrid (COL 2)
- Rendere ogni `StatItem` cliccabile: al click cambia `filterMode`
- Aggiungere un prop `active` a `StatItem` per evidenziare il filtro corrente (bordo colorato + sfondo leggermente piu' intenso)

### 2. `src/components/download/CountryGrid.tsx`
- Rimuovere il Select dropdown del filtro (righe 146-155)
- Rimuovere lo stato locale `filterMode` -- ora viene ricevuto come prop
- Accettare `filterMode` come prop dall'esterno
- Mantenere solo: Search + Sort dropdown + Select All button
- La logica di filtraggio resta identica, usa solo il prop invece dello stato locale

### 3. `StatItem` (in Operations.tsx)
- Aggiungere prop `onClick` e `active`
- Quando `active=true`: bordo piu' visibile, sfondo leggermente colorato, cursore pointer
- Quando ha `onClick`: `cursor-pointer` e hover effect

## Dettagli Tecnici

### Mappatura StatItem -> FilterKey

```text
"Paesi"    -> filterMode = "all"       (mostra tutti con dati)
"Partner"  -> filterMode = "todo"      (paesi da lavorare)
"Profili"  -> filterMode = "no_profile" (paesi con profili mancanti)
"Email"    -> filterMode = "all" + sort by email coverage
"Telefoni" -> filterMode = "all" + sort by phone coverage  
"Directory"-> filterMode = "missing"   (mai esplorati)
```

Nota: per Email e Telefoni, il click potrebbe semplicemente impostare il filtro "all" e cambiare l'ordinamento a "completion" per evidenziare i paesi con meno copertura. Oppure piu' semplicemente, restano filtri visivi e solo Paesi/Partner/Profili/Directory sono cliccabili come filtri effettivi -- i 4 filtri originali mappati 1:1.

### Flusso dati

```text
Operations.tsx
  |-- filterMode state + setFilterMode
  |-- COL 1: StatItem(onClick => setFilterMode("all"|"todo"|...))
  |-- COL 2: CountryGrid(filterMode={filterMode})  -- no piu' stato locale
```

### CountryGrid props aggiornate

```text
interface CountryGridProps {
  selected: ...;
  onToggle: ...;
  onRemove: ...;
  filterMode: FilterKey;        // nuovo: ricevuto da Operations
  onFilterChange: (f: FilterKey) => void;  // opzionale se serve feedback
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
}
```

### StatItem aggiornato

```text
function StatItem({ ..., onClick, active }: {
  ...existing props...
  onClick?: () => void;
  active?: boolean;
}) {
  // Se active, bordo colorato + sfondo piu' intenso
  // Se onClick, cursor-pointer + hover
}
```

## Risultato Visivo

La sidebar sinistra diventa interattiva: cliccando su "Profili" (183), la lista paesi si filtra immediatamente mostrando solo i paesi con profili mancanti. La StatItem "Profili" si illumina con un bordo viola. Nella CountryGrid sparisce il dropdown filtro, liberando spazio verticale per la lista paesi.
