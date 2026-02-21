
# Miglioramento Contrasto e Leggibilita - Enrichment Card e Social Links

## Problema
La scheda di arricchimento AI e i badge social hanno problemi di leggibilita:
- Il testo nella EnrichmentCard e troppo chiaro/sbiadito
- I badge (specialties, languages, interests, seniority) hanno scarso contrasto
- Il badge LinkedIn non e visibile (icona blu su sfondo scuro)

## Modifiche

### 1. EnrichmentCard.tsx - Testo e badge ad alto contrasto

**Testo principale**: cambiare da `text-muted-foreground` a `text-foreground` per tutto il contenuto informativo (date, awards, news, background contatti).

**Badge specialties**: da `bg-violet-500/10 text-violet-600 dark:text-violet-400` a `bg-violet-100 text-violet-900 dark:bg-violet-500/20 dark:text-violet-200 border-violet-300 dark:border-violet-500/30` -- sfondo chiaro con testo scuro in light mode, testo chiaro in dark mode.

**Badge seniority**: aumentare opacita sfondo e scurire testo:
- senior: `bg-amber-100 text-amber-900 border-amber-300 dark:bg-amber-500/20 dark:text-amber-200 dark:border-amber-500/30`
- mid: `bg-sky-100 text-sky-900 border-sky-300 dark:bg-sky-500/20 dark:text-sky-200 dark:border-sky-500/30`
- junior: `bg-emerald-100 text-emerald-900 border-emerald-300 dark:bg-emerald-500/20 dark:text-emerald-200 dark:border-emerald-500/30`

**Badge languages/interests**: stessa logica, sfondo pieno chiaro + testo scuro in light, invertito in dark.

**Badge outline (Fondata, Dipendenti)**: aggiungere `text-foreground font-medium` per renderli ben leggibili.

### 2. SocialLinks.tsx - Badge LinkedIn visibile

Cambiare lo sfondo dei pulsanti social da `bg-secondary/30` a `bg-white dark:bg-white/10 border-gray-200 dark:border-white/15`. In questo modo:
- **LinkedIn**: icona blu `#0A66C2` su sfondo bianco = perfettamente visibile
- Tutti gli altri social: icona colorata su sfondo bianco/chiaro

### 3. CardSocialIcons.tsx - Stesso fix

Assicurare che anche le icone social nelle card partner abbiano contrasto sufficiente (attualmente usano solo il colore fill senza sfondo esplicito).

## Dettagli tecnici

File da modificare:
- `src/components/partners/EnrichmentCard.tsx` -- classi CSS per testo e badge
- `src/components/partners/SocialLinks.tsx` -- sfondo pulsanti social
- `src/components/partners/shared/CardSocialIcons.tsx` -- sfondo icone social

Nessuna modifica alla logica, solo classi Tailwind.
