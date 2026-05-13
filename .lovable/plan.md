## Obiettivo

Aggiungere un controllo globale che permette all'utente di regolare l'**intensità del colore del testo** in tutta la piattaforma:
- in tema chiaro → quanto "nero" è il testo (dal grigio al nero pieno)
- in tema scuro → quanto "bianco" è il testo (dal grigio al bianco pieno)

## Cosa farò

### 1. Provider globale `TextIntensityProvider`
Nuovo file `src/providers/TextIntensityProvider.tsx`:
- legge/salva il valore in `localStorage` (chiave `text-intensity`)
- valori discreti: `soft` · `normal` · `strong` · `max` (4 step)
- applica una CSS variable `--text-intensity` sul `<html>` che modula la luminosità di `--foreground`, `--card-foreground`, `--popover-foreground`, `--accent-foreground`
- montato in `App.tsx` come singleton

### 2. Token CSS dinamici (`src/index.css`)
- aggiungo `--fg-l` (lightness target) override per ciascuno step:
  - light theme: `max=0%`, `strong=8%`, `normal=15%` (default attuale), `soft=28%`
  - dark theme: `max=100%`, `strong=96%`, `normal=88%`, `soft=72%`
- ridefinisco `--foreground` (e i fg correlati) per usare la lightness pilotata dallo step, lasciando invariato hue/saturation di ciascun tema (default, ocean, sunset, ecc.)
- nessuna modifica al colore di sfondo, primary, badge, link

### 3. UI di controllo
Aggiungo un piccolo **toggle a 4 step** (Aa▁ · Aa▂ · Aa▃ · Aa▄) in due punti:
- nel **menu utente in topbar** (accesso rapido da ovunque)
- nella **pagina Impostazioni → Aspetto** (`src/v2/ui/pages/SettingsPage.tsx`), come riga dedicata "Intensità testo" con anteprima live

Componente unico riutilizzabile: `src/v2/ui/molecules/TextIntensityToggle.tsx`.

### 4. Persistenza e applicazione iniziale
- inline script in `index.html` che legge `localStorage` e applica subito `data-text-intensity` su `<html>` per evitare flash
- il provider sincronizza eventuali cambi in altre tab via `storage` event

## Dettagli tecnici

- nessun "any": tipo `TextIntensity = "soft" | "normal" | "strong" | "max"`
- nessuna nuova dipendenza
- nessuna modifica a logica di business, edge function, DB
- compatibile con tutti i temi esistenti (light, dark, ocean, sunset, ecc.) perché agisce solo sulla `lightness` HSL del foreground
- default = `normal` (= comportamento attuale, zero regressione visiva)

## File toccati

- nuovo: `src/providers/TextIntensityProvider.tsx`
- nuovo: `src/v2/ui/molecules/TextIntensityToggle.tsx`
- modificato: `src/index.css` (variabili lightness per step, override `--foreground` derivato)
- modificato: `src/App.tsx` (montaggio provider)
- modificato: `index.html` (script anti-flash)
- modificato: `src/v2/ui/pages/SettingsPage.tsx` (riga "Intensità testo")
- modificato: topbar utente (aggiunta del toggle compatto)
