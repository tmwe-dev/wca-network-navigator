

## Country Workbench — Filtri, Ordinamento e Pulizia Card

### Problemi dalla screenshot
1. **Filter chips illeggibili** — testo scuro su sfondo scuro, contatori quasi invisibili
2. **Nessun ordinamento** — non si può ordinare per nome, città, rating, anni WCA
3. **Nessuna ricerca interna** — con 500 partner in un paese, impossibile trovare quello che serve
4. **Card impastata** — stelle, trofeo, città, contatto, servizi, network tutto ammassato senza respiro visivo

### Piano

#### 1. Barra strumenti sotto l'header del paese
Sostituire i filter chips attuali con una toolbar compatta a due righe:

```text
┌─────────────────────────────────────────────┐
│ ← 🇨🇱 Chile                            2  │
│─────────────────────────────────────────────│
│ [🔍 Cerca partner...]   [↕ Nome ▾]         │
│─────────────────────────────────────────────│
│ 📞 0  ✉ 2  🔍 0  ⭐ 2  📦 2    [✕ Reset] │
│─────────────────────────────────────────────│
│ 2 partner                    Sel. tutti     │
└─────────────────────────────────────────────┘
```

- **Riga 1**: Search input per filtrare per nome azienda + dropdown ordinamento (Nome A-Z, Nome Z-A, Rating ↓, Anni WCA ↓, Città A-Z)
- **Riga 2**: Filter chips esistenti ma con colori ad alto contrasto (testo bianco su sfondo colorato quando attivi, bordo visibile quando inattivi)

#### 2. Migliorare contrasto filter chips
- **Inattivi**: `bg-muted/80 border-border/60 text-foreground/70` (non più `/50` e `/30`)
- **Attivi**: sfondo più saturo (`bg-emerald-500/25`, `bg-sky-500/25`, `bg-amber-500/25`) con testo pieno (`text-emerald-300`, `text-sky-300`, `text-amber-300`)
- **Contatori**: badge con `bg-white/15 text-foreground` invece di `bg-muted-foreground/10`

#### 3. Aggiungere ordinamento
Nuovo stato `sortBy` con opzioni:
- `name_asc` (default), `name_desc`, `rating_desc`, `years_desc`, `city_asc`
- Dropdown compatto a destra del search

#### 4. Aggiungere ricerca interna
- Input search che filtra `company_name` con `ilike` locale (già in memoria)
- Placeholder: "Cerca partner..."

#### 5. Pulizia card partner
Struttura più spaziata e gerarchica:

```text
┌──────────────────────────────────────────┐
│ 1 ☐ [Logo]  COMPANY NAME                │
│              ⭐⭐⭐⭐☆ 4.2               │
│              📍 Miami  ·  🏆 12 anni     │
│              ─────────────────────────── │
│              👤 Operations Manager  +2   │
│              ✉ email@company.com         │
│              📞 +1 234 567 890           │
│              ─────────────────────────── │
│              ✈ 🚛 📦 🏗 +2  · InterGlob │
└──────────────────────────────────────────┘
```

Modifiche specifiche:
- **Rating**: spostato su riga dedicata sotto il nome, con valore numerico visibile
- **Città + Anni WCA**: sulla stessa riga ma con separatore `·` chiaro
- **Separatore sottile** (`border-t border-border/20`) tra info azienda e contatti
- **Servizi + Network**: compattati in un'unica riga finale con separatore `·`
- **Spaziatura**: `py-3` invece di `py-2.5`, gap più ampi tra sezioni

#### File coinvolto
- `src/components/partners/CountryWorkbench.tsx` — unico file da modificare

