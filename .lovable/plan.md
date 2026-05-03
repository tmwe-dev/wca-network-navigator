## Obiettivo
I bottoni con sfondo lilla pieno (`bg-primary`) hanno icone/testo invisibili a causa del basso contrasto. Sostituiamo lo stile con: **sfondo neutro scuro + bordo primary + icona/testo in primary** (o bianco su hover), mantenendo la riconoscibilità del CTA ma eliminando il "lilla pieno".

## Approccio: una sola modifica al design system

Invece di toccare decine di file, intervengo su **2 punti centrali**:

### 1. `src/components/ui/button.tsx` — variant `default`
Oggi: `bg-primary text-primary-foreground hover:bg-primary/90`
Nuovo: `bg-card/60 dark:bg-card/40 border border-primary/60 text-primary hover:bg-primary/15 hover:border-primary ring-0`

Effetto: tutti i `<Button>` (default) in tutta l'app passano automaticamente al nuovo stile, icone e testo diventano leggibili.

### 2. Bottoni icon-only custom (header viola in screenshot)
I quadratini lilla in alto a destra (`hamburger`, `share AI`, lente, target, telescopio, X) NON usano sempre `<Button variant="default">` — alcuni applicano `bg-primary` direttamente. Mappo e correggo:

- `src/v2/ui/templates/AuthenticatedLayout.tsx` — pulsante hamburger viola in alto-sx + AI sparkle in alto-dx
- `src/v2/ui/organisms/RecipientHeroCard.tsx` — toolbar lente/target/telescopio/X
- `src/v2/ui/templates/header/SectionRailTabs.tsx` + `StatusPill.tsx` — pillole header
- `src/v2/ui/templates/ContextFiltersRail.tsx` — handle laterale viola
- `src/v2/ui/templates/SectionTabs.tsx` / `LayoutSidebarNav.tsx` — tab attivi
- `src/v2/ui/atoms/Button.tsx` (atom v2) — eventuale variant locale

Per ognuno: sostituisco `bg-primary` (e gradient `from-primary to-...`) con la stessa formula:
`bg-card/60 border border-primary/60 text-primary hover:bg-primary/15`

### 3. Cosa NON tocco
- Stati `ring-primary`, `border-primary`, `text-primary` (sono già corretti)
- `bg-primary/10`, `bg-primary/20` (già trasparenti, leggibili)
- `bg-destructive`, `bg-success`, `bg-warning` (colori semantici diversi)
- Form controls (`switch`, `slider`, `sonner`) — usano `bg-primary` come thumb/track, è corretto e visibile
- CTA "Publish" / azioni primarie esplicite dell'app (es. "Genera", "Invia") → resteranno `bg-primary` con `text-white` esplicito SOLO se il testo è già garantito leggibile. Da decidere caso per caso durante l'implementazione.

## Verifica
1. Build typescript pulito.
2. Screenshot visuale di: header network, RecipientHeroCard, sidebar filters, EmailComposer toolbar.
3. Conferma che icone e label siano leggibili in dark mode (caso d'uso principale).

## File previsti (~6-8)
- `src/components/ui/button.tsx`
- `src/v2/ui/atoms/Button.tsx`
- `src/v2/ui/templates/AuthenticatedLayout.tsx`
- `src/v2/ui/templates/ContextFiltersRail.tsx`
- `src/v2/ui/templates/header/SectionRailTabs.tsx`
- `src/v2/ui/templates/header/StatusPill.tsx`
- `src/v2/ui/templates/SectionTabs.tsx`
- `src/v2/ui/organisms/RecipientHeroCard.tsx`