

## Spostare Filtri Regione/Provincia a Sinistra e Rimuovere ATECO dall'Importer

### Cosa cambia

Il pannello sinistro diventa il **centro di configurazione completo** per lo scraping: in alto i filtri Regione e Provincia (sempre visibili, non nascosti nel dropdown), sotto l'albero ATECO. Il pannello destro (tab "Importa") usa direttamente i codici ATECO selezionati a sinistra, senza duplicare il selettore.

### Layout risultante

```text
+-------------------------------------------+----------------------------------------+
|  35% PANNELLO SINISTRO                    | 65% PANNELLO DESTRO                    |
|                                           |                                        |
|  [Regione v] (multi-select, sempre vis.)  | [Prospect] [Importa]                   |
|  chips: Lombardia, Veneto                 |                                        |
|                                           | Tab Prospect: lista prospect filtrati  |
|  [Provincia v] (filtrata per regione)     |                                        |
|  chips: MI, BG                            | Tab Importa: status estensione,        |
|                                           |   pulsante Avvia/Ferma, progresso,     |
|  [Cerca ATECO...]                         |   log — USA i codici ATECO + filtri    |
|  v A - AGRICOLTURA                        |   dal pannello sinistro                |
|    v 01 - Produzioni veg...               |                                        |
|      > 01.1 ...                           |                                        |
|  > B - ATTIVITA ESTRATTIVE               |                                        |
|  ...                                      |                                        |
+-------------------------------------------+----------------------------------------+
```

### Dettaglio tecnico

#### 1. `src/components/prospects/AtecoGrid.tsx`

- Spostare i `FilterMultiSelect` per Regione e Provincia **fuori dal Popover dei filtri**, rendendoli sempre visibili in cima al pannello, prima della barra di ricerca ATECO
- Rimuovere il pulsante con icona filtro (SlidersHorizontal) e il relativo Popover, dato che i filtri sono ora inline
- Ordine verticale: Regione multi-select, Province multi-select, barra ricerca ATECO, albero ATECO

#### 2. `src/components/prospects/ProspectImporter.tsx`

- Rimuovere completamente il `MultiSelectPopover` per ATECO (righe 292-301), il selettore Regioni (302-311) e Province (312-321)
- Rimuovere gli state locali `selectedAteco`, `selectedRegions`, `selectedProvinces` e la relativa logica
- Ricevere via props i codici ATECO selezionati + filtri regione/provincia dal componente padre (`ProspectCenter`)
- Nuova interfaccia props: `{ isDark: boolean; atecoCodes: string[]; regions: string[]; provinces: string[] }`
- Il pulsante "Avvia Scraping" e' disabilitato se `atecoCodes.length === 0`, con messaggio "Seleziona almeno un codice ATECO dal pannello a sinistra"

#### 3. `src/pages/ProspectCenter.tsx`

- Passare `selectedAteco`, `regionFilter` e `provinceFilter` come props al `ProspectImporter`:
  ```
  <ProspectImporter isDark={isDark} atecoCodes={selectedAteco} regions={regionFilter} provinces={provinceFilter} />
  ```

### File da modificare

1. **`src/components/prospects/AtecoGrid.tsx`** — Filtri regione/provincia inline (sempre visibili), rimuovere Popover filtri
2. **`src/components/prospects/ProspectImporter.tsx`** — Rimuovere selettori ATECO/regione/provincia, ricevere dati via props
3. **`src/pages/ProspectCenter.tsx`** — Passare le props aggiuntive al ProspectImporter

