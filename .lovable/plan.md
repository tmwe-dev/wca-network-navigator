

# Miglioramento Pannello Download: Chiarezza e Azioni Mirate

## Problemi Identificati dallo Screenshot

1. **"Solo nuovi" e' ambiguo**: l'utente non capisce che significa "partner presenti in directory WCA ma non ancora nel database". Il conteggio (1) non e' chiaro nel contesto di 2 paesi selezionati.

2. **"Scarica 1 partner" e' fuorviante**: con Afghanistan e Albania selezionati (15 nella directory, 14 scaricati, 4 senza profilo), il pulsante dice "Scarica 1 partner" perche' la modalita' e' "Solo nuovi" (1 mancante dal DB). Ma l'utente si aspetterebbe di poter agire sui 4 senza profilo, che sono il problema piu' urgente.

3. **I 4 "Senza profilo" sono visibili nel riepilogo ma non azionabili**: l'utente vede il dato arancione "Senza profilo: 4" ma non c'e' un modo diretto per scaricare SOLO quelli. Deve sapere di cambiare la modalita' nel dropdown, cosa non intuitiva.

## Soluzione

Ridisegnare il pannello download per rendere ogni riga del riepilogo direttamente azionabile e le etichette piu' chiare.

### Cambiamento 1 — Etichette modalita' piu' descrittive

| Prima | Dopo |
|---|---|
| Solo nuovi (1) | Mai scaricati (1) — partner non ancora nel database |
| Profili mancanti (5) | Senza profilo (4) — ri-scarica per acquisire descrizione e HTML |
| Aggiorna tutti (14) | Riscansiona tutti (15) — visita ogni profilo nella directory |

### Cambiamento 2 — Righe del riepilogo cliccabili

Ogni riga nel box informativo (Nella directory / Gia' scaricati / Senza profilo / Da scaricare) diventa un pulsante che imposta automaticamente la modalita' di download corrispondente:

- Click su "Senza profilo: 4" → imposta modalita' "no_profile" e il pulsante cambia in "Scarica 4 partner (profili)"
- Click su "Da scaricare: 1" → imposta modalita' "new" e il pulsante cambia in "Scarica 1 partner (nuovo)"
- Click su "Nella directory: 15" → imposta modalita' "all"

La riga attiva viene evidenziata con un bordo colorato per mostrare cosa verra' scaricato.

### Cambiamento 3 — Pulsante download con contesto

Il pulsante principale mostra il contesto della modalita' selezionata:

- "Scarica 1 partner (nuovi)" quando modalita' = new
- "Scarica 4 partner (profili)" quando modalita' = no_profile  
- "Riscansiona 15 partner" quando modalita' = all

### Cambiamento 4 — Selezione modalita' sempre visibile

Il dropdown "Modalita' download" viene mostrato SEMPRE (non solo quando downloadedCount > 0), cosi' l'utente vede subito le opzioni disponibili anche al primo accesso.

## Dettaglio Tecnico

### File da modificare

**`src/components/download/ActionPanel.tsx`**

1. Rinominare le label nel SelectItem delle modalita':
   - "new" → "Mai scaricati ({missingIds.length})"
   - "no_profile" → "Senza profilo ({noProfileInDirectoryCount})" (nota: solo quelli nel directory, non il totale)
   - "all" → "Riscansiona tutti ({totalCount})"

2. Rendere le righe del riepilogo (righe 422-446) cliccabili con `onClick` che chiama `setDownloadMode()`:
   - Riga "Senza profilo" → `setDownloadMode("no_profile")`
   - Riga "Da scaricare" → `setDownloadMode("new")`
   - Riga "Nella directory" → `setDownloadMode("all")`
   - La riga attiva riceve uno stile con bordo laterale colorato e sfondo leggero

3. Mostrare il dropdown modalita' sempre (rimuovere il condizionale `downloadedCount > 0` a riga 472)

4. Aggiornare il testo del pulsante di download (riga 522) per includere il contesto:
   - `downloadMode === "new"` → "Scarica {n} partner (nuovi)"
   - `downloadMode === "no_profile"` → "Scarica {n} partner (profili)"
   - `downloadMode === "all"` → "Riscansiona {n} partner"

5. Se `noProfileInDirectoryCount > 0` e `missingIds.length === 0`, impostare automaticamente `downloadMode` su "no_profile" (il problema piu' urgente)

