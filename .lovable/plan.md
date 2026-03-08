

## Problema: Contrasto insufficiente nella pagina Cockpit

Ho analizzato tutti i 6 componenti del Cockpit e fatto uno screenshot. Il problema è sistematico: quasi tutti i testi secondari e le icone usano opacità troppo basse (`/30`, `/40`, `/50`, `/60`) che su sfondo scuro diventano quasi invisibili.

---

### Mappa completa dei problemi di contrasto

**1. CockpitContactCard.tsx** (card contatti)
- `text-muted-foreground/30` → grip handle quasi invisibile
- `text-muted-foreground` → company name troppo sbiadito
- `text-muted-foreground/70` → role quasi illeggibile
- `text-muted-foreground/60` → lingua e data contatto sbiaditi
- `text-muted-foreground/60` → icone canali troppo scure
- `text-muted-foreground/50` → action buttons invisibili
- `border-border/50` → bordo card quasi assente
- `bg-card/70` → sfondo card troppo trasparente

**2. CockpitContactListItem.tsx** (lista contatti)
- `text-muted-foreground/20` → grip handle invisibile
- `text-muted-foreground` → company troppo flebile
- `text-muted-foreground/60` → role quasi illeggibile
- `text-muted-foreground/50` → lastContact sbiadito
- `text-muted-foreground/40` → icone canali invisibili

**3. TopCommandBar.tsx** (barra comandi)
- `text-primary/60` → icona Sparkles poco visibile
- `placeholder:text-muted-foreground/50` → placeholder sbiadito
- `text-muted-foreground/40` → icona Search quasi invisibile
- `text-muted-foreground/30` → bordo mic button assente
- `text-muted-foreground/60` → MicOff invisibile
- `text-muted-foreground/50` → view toggle inattivo sbiadito

**4. ChannelDropZones.tsx** (zone centrali)
- `text-muted-foreground/50` → icone canali troppo scure
- `text-muted-foreground/60` → etichette canali sbiadite
- `text-muted-foreground/40` → "Rilascia qui" invisibile
- `border-border/30` → bordi zone quasi assenti
- `bg-card/30` → sfondo zone trasparente

**5. AIDraftStudio.tsx** (pannello destro)
- `text-foreground/60` → titolo "AI Draft Studio" sbiadito
- `text-muted-foreground/50` → descrizione illeggibile
- `text-muted-foreground/40` → labels "Oggetto"/"Messaggio"
- `text-muted-foreground/30` → placeholder "In generazione..."
- `text-muted-foreground/50` → meta info lingua/tono
- `text-muted-foreground/60` → tab "Prompt" content
- `text-muted-foreground/40` → "Nessuna generazione"

**6. ContactStream.tsx**
- `text-muted-foreground` → conteggio contatti poco visibile

---

### Correzioni pianificate

Regola generale: alzare tutte le opacità di almeno 2 livelli:
- `/20-30` → `/50-60`
- `/40` → `/70`  
- `/50` → `/80`
- `/60` → `/90`
- Testi importanti (nomi, etichette) → `text-foreground` pieno o `/90`
- Bordi card → da `/30-50` a `/60-80`
- Sfondi card → da `/30-70` a `/60-90`

### File da modificare (6 file)

1. **`CockpitContactCard.tsx`** — Alzare contrasto nomi, company, role, meta, icone, bordi
2. **`CockpitContactListItem.tsx`** — Stessi fix per la vista lista
3. **`TopCommandBar.tsx`** — Placeholder, icone, mic button, view toggle
4. **`ChannelDropZones.tsx`** — Icone, etichette, bordi, sfondi zone drop
5. **`AIDraftStudio.tsx`** — Titoli, labels, meta info, placeholder, tab content
6. **`ContactStream.tsx`** — Conteggio contatti

Nessuna modifica strutturale o logica — solo classi CSS di colore/opacità.

