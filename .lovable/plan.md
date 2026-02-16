
# Refactoring Completo Operations Center

## Problemi Identificati

1. **Bug dati**: I conteggi filtri mostrano tutti 0 perche' la logica di filtro nasconde i paesi con partner ma senza "directory cache" quando `showEmpty` e' disattivato. I dati dal database arrivano correttamente (country_stats: ~40 paesi con partner, directory_counts: ~180 paesi), ma la UI non li mostra.

2. **Layout sbilanciato**: La colonna centrale (280px) e' troppo stretta per contenere filtri + ordinamenti + toggles + lista paesi. I controlli escono dai bordi. La colonna destra (65%) e' sovradimensionata rispetto al contenuto.

3. **Controlli confusi**: Ordinamenti (A-Z, N, Dir, %) + toggle (Dir, All) + checkbox (seleziona tutti) sono ammassati nella stessa riga, rendendo impossibile capire cosa fa cosa.

4. **Definizione "completato" errata**: Un paese NON deve essere "completato" se ha solo il download ma manca il profilo (es. USA: 837 partner, solo 137 profili = NON completato).

## Soluzione

### Fase 1: Fix Bug Dati e Logica Filtri

- Correggere la logica di visibilita': mostrare TUTTI i paesi che hanno almeno 1 partner nel DB, indipendentemente dalla directory cache
- Ricalcolare lo stato "completato": un paese e' completo solo se ha TUTTI i profili scaricati (without_profile === 0) E il download dalla directory e' completo (pCount >= cCount)
- Rimuovere il toggle "All" confusionario e mostrare di default tutti i paesi con dati

### Fase 2: Ridisegno Layout 3 Colonne

```text
+----------------------------------------------------------------+
| TOP BAR: Operations | SpeedGauge | Sessione | Tema             |
+------+-----------------------+---------------------------------+
| STATS|  PAESI                |  PANNELLO CONTESTUALE           |
| 140px|  flex (min 320px)     |  flex-1                         |
|      |                       |                                 |
| Paesi|  [Cerca] [Filtro v]   |  (Partner / Scarica / Acquisisci)|
| Part.|  [Ordina: Nome v]     |                                 |
| Prof.|                       |                                 |
| Email|  Card AF  3/3  100%   |                                 |
| Tel. |  Card US 837 !! 16%   |                                 |
| Dir. |  Card AU 91/144  63%  |                                 |
|      |  Card IN 63/...  ...  |                                 |
|      |  ...                  |                                 |
+------+-----------------------+---------------------------------+
```

Colonne responsive:
- COL 1 (Stats): 140px fissi, invariata -- funziona bene
- COL 2 (Paesi): `min-w-[280px] w-[35%]` -- si adatta allo schermo
- COL 3 (Pannello): `flex-1` -- prende il resto

### Fase 3: Controlli Compatti e Chiari

**Filtri**: Un unico dropdown (Select) con le opzioni:
- Tutti (conteggio)
- Da fare (conteggio)
- Senza Profilo (conteggio) 
- Completati (conteggio)
- Mai esplorati (conteggio)

Posizionato accanto alla barra di ricerca su un'unica riga.

**Ordinamento**: Un unico dropdown (Select) con le opzioni:
- Nome A-Z
- Partner (decrescente)
- Directory (decrescente)
- Completamento % (crescente)

Posizionato sulla stessa riga del filtro.

**Toggle "Solo Directory" e "Mostra tutti"**: Spostati nel pannello contestuale (tab Scarica), dove hanno senso operativo, non sopra la lista paesi.

### Fase 4: Card Paese Ottimizzate

Ogni card mostra:
- Bandiera + Nome (troncato)
- Stats compatte: `45/120` partner, icona profilo con colore (verde se completo, arancione se mancante)
- Badge percentuale grande a destra con colore semantico:
  - Verde 100% = tutto fatto
  - Giallo/Ambra 1-99% = parziale  
  - Rosso 0% = da fare
  - Badge nascosto se nessuna directory scansionata
- Stato "DL OK" con badge arancione lampeggiante se download completo ma profili mancanti

### Fase 5: Logica "Completamento" Corretta

Un paese ha 3 livelli di stato:
1. **Completo** (verde): download >= directory E without_profile === 0
2. **DL OK ma senza profili** (arancione): download >= directory MA without_profile > 0 -- badge lampeggiante per segnalare necessita' di ri-scaricamento profili
3. **Download parziale** (blu): partner < directory
4. **Mai esplorato** (grigio): nessun dato

## Dettagli Tecnici

### File da modificare:

**`src/components/download/CountryGrid.tsx`** -- Riscrittura completa:
- Sostituire i bottoni filtro/ordinamento con due `<Select>` compatti di Radix UI
- Correggere la logica di filtraggio: rimuovere la condizione `!showEmpty` che nasconde paesi con dati
- Rimuovere i toggle "Dir" e "All" dalla toolbar (spostati nel pannello download)
- Layout toolbar: una riga con [Cerca | Filtro dropdown | Ordina dropdown]
- Card responsive con flex-wrap per adattarsi a diverse larghezze

**`src/pages/Operations.tsx`** -- Aggiornamento layout:
- Cambiare la colonna paesi da `w-[280px]` a `min-w-[280px] w-[35%] max-w-[400px]` per responsivita'
- Mantenere la sidebar stats a 140px (funziona bene)
- La colonna destra resta `flex-1`
