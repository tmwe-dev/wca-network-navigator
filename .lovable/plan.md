

# Fix: Contatti CRM vuoti — filtro origine con valori errati

## Problema

La lista contatti mostra "0 contatti" perché il filtro origini di default contiene valori che non esistono nel database.

Il default in `GlobalFiltersContext.tsx` è:
```
crmOrigin: new Set(["wca", "import", "report_aziende"])
```

Ma nel DB le origini sono tutte diverse: "WCA", "Hubspot", "PITTI UOMO", "Cosmoprof", "MACCHINARI", ecc. — nessun record ha origin = "wca" (lowercase), "import", o "report_aziende".

Con 3 origini selezionate (size < 4), il filtro viene applicato via `q.in("origin", origins)` → 0 risultati.

## Soluzione

1. **Cambiare il default di `crmOrigin` a `new Set()` (vuoto)** — nessun filtro origine attivo = mostra tutti i contatti
2. **Aggiornare i chip origine nella sidebar CRM** — attualmente usa valori fissi ("wca", "import", "RA", "BCA") che non corrispondono ai dati reali. Sostituire con origini dinamiche caricate dal DB (tramite `useContactFilterOptions()` che già esiste e restituisce le origini reali)
3. **Mostrare le origini più frequenti come chip** nella sidebar, con possibilità di cercare/selezionare anche le altre

## File coinvolti

| File | Modifica |
|------|----------|
| `src/contexts/GlobalFiltersContext.tsx` | Cambiare default `crmOrigin` da `Set(["wca","import","report_aziende"])` a `Set()` |
| `src/components/global/FiltersDrawer.tsx` | Nella `CRMFiltersSection`, sostituire i chip origine statici (`CRM_ORIGIN`) con origini dinamiche caricate da `useContactFilterOptions()` — mostrare le top 10-15 origini con conteggi, più un input cerca per le altre |

Nessuna migrazione DB. Il fix del default risolve il problema immediatamente; le origini dinamiche nella sidebar completano la correzione.

