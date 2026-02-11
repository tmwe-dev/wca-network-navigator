

# Fix Uniformita' Colore, Responsive e Contrasto

## Problemi dallo screenshot

1. **Due colori diversi**: pannello sinistro bianco, pannello destro scuro -- deve essere uniforme
2. **Coppe verticali**: le coppe si impilano in colonna singola, devono stare su griglia 2-4 colonne quando lo spazio e' poco
3. **Contrasto bottoni/badge**: testi neri su sfondo scuro (es. Social LinkedIn), illeggibili
4. **Non responsive**: quando si riduce la pagina il layout non si adatta

## Correzioni

### 1. Uniformita' colore
Il pannello destro usa `glass-surface` (sfondo scuro con gradiente). Il pannello sinistro usa `bg-card` (bianco in light mode). La soluzione:
- Rimuovere `glass-surface` dal pannello destro
- Usare `bg-card` per entrambi i pannelli
- Tutte le `glass-section`, `glass-card`, `glass-badge` nel dettaglio vengono sostituite con card standard: `bg-muted/50 border rounded-xl`
- I testi `text-white/*` vengono sostituiti con `text-foreground`, `text-muted-foreground` ecc.
- Questo rende la pagina uniforme in light mode (bianca) e in dark mode (scura), senza mai mischiare

### 2. Coppe responsive
- La `TrophyRow` usa `flex-wrap` ma e' una sola riga. Cambiare a `grid` con `grid-cols-4` (o `grid-cols-5`) cosi' le coppe si distribuiscono su piu' righe compatte senza andare in verticale

### 3. Contrasto bottoni e badge
Revisione sistematica di tutti gli elementi nel pannello destro:
- Badge HQ/Branch: `bg-secondary text-secondary-foreground` (non `bg-white/10 text-white/60`)
- Collapsible triggers: `bg-muted text-foreground` con hover `bg-accent`
- Testi dentro sezioni: `text-foreground` per titoli, `text-muted-foreground` per secondari
- Social Links button: verificare che il bottone abbia `bg-secondary text-secondary-foreground` (non sfondo scuro con testo scuro)
- Deep Search button: `bg-primary text-primary-foreground`
- Icone servizi: mantengono i colori specifici (sky, blue, amber ecc.) che funzionano su entrambi gli sfondi
- Empty state testo: `text-muted-foreground` invece di `text-white/40`

### 4. Responsive
- Il container principale: `flex flex-col md:flex-row` -- su mobile la lista sta sopra, il dettaglio sotto
- Lista partner: `w-full md:w-[400px]`
- Grid 2 colonne nel dettaglio: `grid-cols-1 lg:grid-cols-[3fr_2fr]` (gia' presente, OK)
- Servizi di trasporto: `grid-cols-1 sm:grid-cols-2`

### File modificato

`src/pages/PartnerHub.tsx` -- tutte le correzioni in un unico file:

| Zona | Modifica |
|------|----------|
| Riga 271 | Container: aggiungere `flex-col md:flex-row` |
| Riga 273 | Lista: `w-full md:w-[400px]` |
| Riga 456 | Pannello destro: rimuovere `glass-surface`, usare `bg-card` |
| Riga 458 | Empty state: `text-muted-foreground` |
| Righe 526-608 | Header card: sostituire `glass-card` con `bg-muted/50 border rounded-xl`, tutti i `text-white` con `text-foreground` |
| Riga 148-158 | TrophyRow: cambiare a `grid grid-cols-5 gap-0.5` |
| Righe 616-648 | Servizi: `glass-section` diventa `bg-muted/50 border rounded-xl p-4`, `glass-badge` diventa `bg-secondary/50 border rounded-lg px-3 py-2` |
| Righe 651-773 | Collapsible: trigger con `bg-muted hover:bg-accent text-foreground`, contenuti con `bg-muted/30 border` |
| Righe 782-837 | Timeline/Reminders: card interne con `bg-muted/50 border` |
| Righe 841-964 | Colonna destra: stesse sostituzioni glass -> standard |
| Riga 560 | Badge HQ: `bg-secondary text-secondary-foreground` |
| Riga 574 | "High Quality": `text-muted-foreground` |
| Riga 599 | Deep Search: `bg-primary text-primary-foreground` |

### Risultato atteso
Pagina completamente uniforme: bianca in light mode, scura in dark mode. Nessun elemento con contrasto insufficiente. Layout responsive che si adatta su mobile. Coppe distribuite su griglia compatta.

