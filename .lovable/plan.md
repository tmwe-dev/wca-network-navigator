
# Rifattorizzazione Filtri, Card e Controllo Download

## 1. Toolbar Filtri e Ordinamenti (CountryGrid.tsx)

**Problema attuale**: I filtri e gli ordinamenti sono nascosti dentro un popover (icona ingranaggio) — poco intuitivo, difficile da scoprire.

**Soluzione**: Sostituire il popover con controlli visibili direttamente nella toolbar:

- **Ordinamento**: Una riga di bottoni segmentati sempre visibili: `Nome A-Z | N. Partner | Directory | Completamento`
  - "Directory" e' il nuovo ordinamento richiesto: ordina per `cCount` (numero di aziende nella directory WCA)
- **Filtri**: Una riga di chip cliccabili sotto la ricerca: `Tutti (247) | Scansionati (85) | Parziali (12) | Mai esplorati (150)`
  - Il chip attivo ha sfondo colorato, gli altri sono ghost
- Rimuovere completamente il `Popover` con `SlidersHorizontal` — tutto visibile a colpo d'occhio
- I toggle "Solo Dir" e "Tutti" restano come switch compatti a destra

**Risultato**: Un bambino vede subito come filtrare (clicca il chip) e come ordinare (clicca il bottone).

---

## 2. Redesign Card Paese (CountryGrid.tsx)

**Problema attuale**: Le icone delle statistiche (Mail, Phone, Users) sono `w-3 h-3` con testo `text-[11px]` — troppo piccole su un monitor grande. La card ha dimensioni compatte (`p-3.5`) che non sfruttano lo spazio disponibile.

**Soluzione**:
- Aumentare padding card da `p-3.5 pl-5` a `p-4 pl-6`
- Bandiera paese da `text-2xl` a `text-3xl`
- Nome paese da `text-sm` a `text-base`
- Sezione statistiche (destra) riorganizzata in blocchetti leggibili:
  - Directory badge: icona `w-5 h-5`, numero `text-lg font-bold`
  - Partner/Email/Phone: icone `w-4 h-4`, numeri `text-sm font-bold` (da 11px a 14px)
  - Ogni stat in un mini-badge con sfondo per separazione visiva
- Percentuale e barra di progresso: testo da `text-[9px]` a `text-xs`
- Status label ("Completo", "Non esplorato"): da `text-[9px]` a `text-xs`

---

## 3. Pausa tra Paesi nel Download (ActionPanel.tsx)

**Situazione attuale**: 
- **Scansione directory**: C'e' una pausa di 10 secondi tra un paese e l'altro (riga 229)
- **Download profili**: I job vengono creati tutti immediatamente (`executeDownload` righe 288-296), e il processore li esegue in sequenza. Ma tra la fine del job di un paese e l'inizio del successivo **non c'e' alcuna pausa** — il polling trova il prossimo job `pending` e lo avvia subito

**Soluzione**: Aggiungere nel `useDownloadProcessor.ts`, dopo il completamento di un job e prima di prendere il successivo nel polling loop, una pausa di 30 secondi:
```
// Dopo il completamento, pausa inter-job
await new Promise(r => setTimeout(r, 30000));
```
Questo garantisce un intervallo di 30 secondi tra un paese e l'altro, simulando un comportamento umano che controlla i risultati prima di proseguire.

---

## 4. Rimozione Retry dalla Scansione Directory (ActionPanel.tsx)

**Problema**: Le righe 188-199 contengono un loop `for (let attempt = 1; attempt <= 3; attempt++)` per la scansione directory Firecrawl. Questo viola la politica "Zero Retry" approvata in precedenza.

**Soluzione**: Rimuovere il loop di retry. Una sola chiamata a `scrapeWcaDirectory`: se fallisce, il paese viene segnato come "scansione incompleta" e si procede al successivo senza tentativi aggiuntivi.

---

## 5. Esclusione Download ID gia' Presenti (ActionPanel.tsx)

**Situazione attuale**: Il sistema gia' esclude gli ID presenti nel database per default. La variabile `missingIds` (riga 119) filtra via tutti i `wca_id` gia' nella tabella `partners`. Il checkbox "Ri-scarica anche i N esistenti" (riga 432-435) permette di forzare il re-download.

**Nessuna modifica necessaria**: Il comportamento e' gia' corretto. Per default, solo gli ID mancanti vengono scaricati. Il flag esiste per chi vuole aggiornare i dati esistenti.

---

## File modificati

1. **`src/components/download/CountryGrid.tsx`** — Toolbar con filtri/ordinamenti visibili, nuovo sort "Directory", card ridisegnata con dimensioni maggiori
2. **`src/components/download/ActionPanel.tsx`** — Rimozione loop retry 3-tentativi dalla scansione directory
3. **`src/hooks/useDownloadProcessor.ts`** — Aggiunta pausa 30s tra job di paesi diversi nel polling loop
