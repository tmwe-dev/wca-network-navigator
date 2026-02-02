
# Layout Immersivo "Space Station" per Campaigns

## Obiettivo
Trasformare la pagina Campaigns in un'esperienza immersiva dove il globo 3D è lo sfondo principale e tutti gli elementi UI fluttuano sopra con uno stile futuristico "stazione spaziale".

## Architettura del Layout

```text
+----------------------------------------------------------+
|  Header (semi-trasparente, backdrop blur)                |
+----------------------------------------------------------+
|                                                          |
|   +----------------+                    +--------------+ |
|   | Company List   |                    | Campaign     | |
|   | (floating      |    [GLOBE 3D]      | Summary      | |
|   |  glassmorphism)|    FULL SCREEN     | (floating)   | |
|   |                |                    |              | |
|   +----------------+                    +--------------+ |
|                                                          |
|   [Stats badges floating top-center]                     |
|   [Country selector floating]                            |
|                                                          |
+----------------------------------------------------------+
```

## Modifiche Dettagliate

### 1. AppLayout.tsx - Sidebar collassata di default
- Cambiare `useState(false)` a `useState(true)` per `sidebarCollapsed`
- L'utente puo' sempre espanderla cliccando

### 2. Campaigns.tsx - Layout immersivo
**Struttura completamente nuova:**
- Container principale con `position: relative` e altezza full-screen
- CampaignGlobe diventa lo sfondo assoluto (`absolute inset-0`)
- Rimuovere tutte le Card wrapper
- Pannelli flottanti con `position: absolute`

**Layout pannelli:**
```text
- Top center: Stats badges + Country selector (floating bar)
- Left: CompanyList (absolute left-4, top-24, bottom-4, width 380px)
- Right: CampaignSummary (absolute right-4, top-24, bottom-4, width 320px)
```

### 3. CompanyList.tsx - Stile Spaziale
**Rimozione sfondo solido, aggiunta glassmorphism:**
- Background: `bg-black/40 backdrop-blur-xl`
- Border: `border border-amber-500/30`
- Border radius: `rounded-2xl`
- Shadow: `shadow-2xl shadow-amber-500/10`

**Colori testi futuristici:**
- Titoli: `text-amber-400` (arancione luminoso)
- Testi secondari: `text-emerald-400` (verde)
- Labels/muted: `text-slate-300`
- Icone: `text-amber-500`

**Elementi UI:**
- Input search: `bg-black/50 border-amber-500/40 text-amber-100`
- Badges: bordi luminosi `border-emerald-500/50`
- Checkbox: stile amber
- Hover states: `hover:bg-amber-500/10`

### 4. CampaignSummary.tsx - Stile Spaziale
**Stesso trattamento glassmorphism:**
- `bg-black/40 backdrop-blur-xl border border-emerald-500/30 rounded-2xl`
- Titolo: `text-emerald-400`
- Stats cards: `bg-emerald-500/10 border border-emerald-500/30`
- Numeri: `text-amber-400 font-mono` (font monospace per effetto tech)
- Bottoni: gradient `bg-gradient-to-r from-amber-500 to-orange-500`

### 5. Header della pagina (floating bar)
**Stats e controlli flottanti al centro-top:**
```text
+--------------------------------------------------+
|  [Country Selector]  | 249 Paesi | 42 Attivi | 156 Partner |  [Reset]
+--------------------------------------------------+
```
- Background: `bg-black/60 backdrop-blur-md`
- Border: `border border-amber-500/20 rounded-full`
- Posizione: `absolute top-4 left-1/2 -translate-x-1/2`

### 6. Elementi di design aggiuntivi

**Effetti glow sui bordi:**
```css
.glow-amber {
  box-shadow: 0 0 20px rgba(245, 158, 11, 0.15),
              inset 0 0 20px rgba(245, 158, 11, 0.05);
}

.glow-emerald {
  box-shadow: 0 0 20px rgba(16, 185, 129, 0.15),
              inset 0 0 20px rgba(16, 185, 129, 0.05);
}
```

**Animazioni subtle:**
- Pulse leggero sui bordi attivi
- Fade-in sui pannelli al caricamento

### 7. CSS aggiuntivo in index.css

```css
/* Space Station Theme */
.space-panel {
  @apply bg-black/40 backdrop-blur-xl border rounded-2xl;
}

.space-text-primary {
  @apply text-amber-400;
}

.space-text-secondary {
  @apply text-emerald-400;
}

.space-glow {
  box-shadow: 
    0 0 30px rgba(245, 158, 11, 0.1),
    0 0 60px rgba(16, 185, 129, 0.05);
}
```

## File da Modificare

| File | Modifiche |
|------|-----------|
| `src/components/layout/AppLayout.tsx` | Sidebar collassata di default |
| `src/pages/Campaigns.tsx` | Layout immersivo con pannelli flottanti |
| `src/components/campaigns/CompanyList.tsx` | Stile glassmorphism spaziale |
| `src/components/campaigns/CampaignSummary.tsx` | Stile glassmorphism spaziale |
| `src/index.css` | Classi utility per tema spaziale |

## Risultato Visivo Atteso
- Globo 3D come protagonista assoluto, visibile ovunque
- Pannelli laterali semi-trasparenti che "galleggiano" sullo spazio
- Colori amber/emerald per un look "control room" spaziale
- Effetti glow sottili per profondita'
- Esperienza immersiva e moderna
