

# Rimozione Centro Operativo dalla Dashboard

## Analisi

Il **Centro Operativo** (`OperationsCenter.tsx`) mostra 5 pannelli:

1. **Download attivi** — non serve più, i download sono gestiti esternamente
2. **Task agenti** — già visibile nella sezione Agenti dedicata
3. **Email in coda / inviate / lette** — già coperto dal tab **Campagne** in Outreach (`CampagneTab`)
4. **Attività aperte** — già coperto dal tab **Attività** in Outreach (`AttivitaTab`)

L'unico dato potenzialmente utile è un riepilogo veloce, ma è già duplicato altrove. La maschera è ridondante.

## Piano

**Rimuovere il tab "Centro Operativo" dalla Dashboard**, semplificando a 3 tab: Mission Control, Global AI, Campagne.

### File modificati

| File | Azione |
|------|--------|
| `src/pages/Dashboard.tsx` | Rimuovere import `OperationsCenterLazy`, tab "ops" e relativo render |

Nessun file viene cancellato — `OperationsCenter.tsx` e `useOperationsCenter.ts` restano nel codebase nel caso servano in futuro, semplicemente non vengono più referenziati dalla Dashboard.

