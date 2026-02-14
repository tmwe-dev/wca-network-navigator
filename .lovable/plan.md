

# Evidenza Directory nelle Card Paese

## Cosa cambia

Aggiungere nelle card paese (pannello sinistro) un indicatore chiaro del numero di aziende trovate nella directory WCA, visibile sempre quando la directory e' stata scaricata.

## Dettaglio

Nella riga sotto il nome paese (righe 309-327 di `CountryGrid.tsx`), aggiungere un badge con icona `FolderDown` che mostra il totale directory, ad esempio:

- **Directory scaricata**: badge con `📁 42 in directory` (colore sky/blu)
- **Directory non scaricata**: nessun badge (resta "Non esplorato")
- **Download completo**: il badge directory resta visibile accanto al check "Completo", cosi' si vede sempre il totale di riferimento

Attualmente il conteggio directory (`cCount`) e' mostrato solo come rapporto `pCount/cCount` ed e' poco leggibile. La modifica lo rende un dato autonomo e sempre visibile.

## Modifiche tecniche

### `src/components/download/CountryGrid.tsx`

1. Importare `FolderDown` da lucide-react (riga 6)
2. Nella sezione status sotto il nome paese (righe 309-327), aggiungere in tutti i casi in cui `hasDirectoryScan && cCount > 0` un badge:
   ```
   <span className="text-[9px] font-mono text-sky-400">
     📁 {cCount} in directory
   </span>
   ```
3. Per il caso `isComplete`, mostrare sia "Completo" che il totale directory
4. Per il caso `hasDirectoryScan && !isComplete`, mostrare il badge directory + il progresso download separatamente

Nessun altro file viene modificato.

