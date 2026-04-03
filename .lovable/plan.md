

# Piano: Aggiungere tab "Operatori" in Settings

## Problema
La pagina `/settings/operators` esiste come route ma non è raggiungibile dal menu Settings. Manca la tab nella navigazione verticale.

## Soluzione
Aggiungere la tab "Operatori" con icona `Users` nella lista tabs di `Settings.tsx`, e integrare il componente `OperatorsSettings` direttamente come tab invece di usare una route separata.

### File da modificare: `src/pages/Settings.tsx`

1. Importare `Users` da lucide-react e importare `OperatorsSettings` da `@/pages/OperatorsSettings`
2. Aggiungere nella lista tabs: `{ value: "operatori", label: "Operatori", icon: Users }`
3. Aggiungere il render condizionale: `{tab === "operatori" && <OperatorsSettings />}`

Risultato: la tab appare nel menu laterale di Settings, accessibile con un click.

