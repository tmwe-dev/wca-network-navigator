

## Fix Pulsanti Brutti - JobMonitor e ActionPanel

### Problema
I pulsanti Pausa, Stop, Annulla, Dati e Settings usano `variant="outline"` del componente Button di shadcn, che forza `bg-background` (bianco in light mode). Le classi del tema (`th.btnStop`, `th.btnPause`, ecc.) vengono sovrascritte dalla specificita' del variant.

### Soluzione
Cambiare tutti i pulsanti di azione da `variant="outline"` a `variant="ghost"` (che non forza uno sfondo bianco) in modo che le classi del tema si applichino correttamente. In alternativa, usare il prop `className` con `!important` overrides, ma la soluzione piu' pulita e' passare a `variant="ghost"` dato che il tema gia' definisce sfondo, bordo e colori.

### File da modificare

**1. `src/components/download/JobMonitor.tsx`**
- Riga ~116: Pulsante "Dati" — da `variant="outline"` a `variant="ghost"`
- Riga ~120: Pulsante Settings — da `variant="outline"` a `variant="ghost"`
- Riga ~122: Pulsante "Pausa" — da `variant="outline"` a `variant="ghost"`
- Riga ~125: Pulsante "Stop" — da `variant="outline"` a `variant="ghost"`
- Riga ~133: Pulsante "Annulla" — da `variant="outline"` a `variant="ghost"`

**2. `src/components/download/ActionPanel.tsx`**
- Riga ~303: Pulsante "Interrompi" — da `variant="outline"` a `variant="ghost"`
- Riga ~408: Pulsante rescan — da `variant="outline"` a `variant="ghost"`

**3. `src/components/download/ActiveJobBar.tsx`**
- Tutti i pulsanti di azione — da `variant="outline"` a `variant="ghost"`

Tutti i pulsanti mantengono le classi tema gia' definite (`th.btnStop`, `th.btnPause`, `th.btnTest`) che includono sfondo con trasparenza, backdrop-blur e colori morbidi. Rimuovendo il variant "outline" che forza il bianco, il look moderno glassmorphism si applica immediatamente.

### Nessuna modifica alla logica
Solo cambi di prop `variant` sui componenti Button. Zero impatto funzionale.

