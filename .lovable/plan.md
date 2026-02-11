

## Redesign Completo dello Stile - Pulizia Colori e Layout

### Problema
La pagina e' un arcobaleno: KPI badges in 5 colori diversi, servizi in 14 colori, badge di stato in 3 colori, tutto disallineato. Dove manca il logo appare una bandiera gigante invece di uno spazio pulito.

### Palette ridotta: solo 2 colori

Tutto il sistema di badge e KPI passa a usare **solo primary (sky) e muted (grigio)**:
- **Primary/sky**: per dati numerici importanti (anni WCA, filiali, paesi, certificazioni, Gold)
- **Muted/grigio**: per informazioni secondarie (tipo partner, office type, servizi, WCA ID)

### Modifiche specifiche

**1. KpiBadges (`src/components/agents/KpiBadges.tsx`)**
- Tutti i badge usano lo stesso stile: `bg-primary/10 text-primary border border-primary/20`
- Ogni badge mantiene la sua icona (Calendar, Building2, Globe, ShieldCheck, Award) per distinguere il tipo
- Layout: riga singola, gap uniforme, allineamento orizzontale perfetto
- Compact: stesso approccio, mini-pill tutte uniformi in primary

**2. Service badges (`src/lib/countries.ts` - `getServiceColor`)**
- Tutti i servizi diventano `bg-muted text-foreground` con un'icona specifica per categoria davanti al testo
- Niente piu' 14 colori diversi, solo grigio neutro con icone chiare

**3. Badge di stato nel dettaglio (`PartnerHub.tsx`)**
- "Primo contatto" / "In conoscenza" / "Attivo": tutti `bg-muted text-muted-foreground` con un'icona diversa (Circle, ArrowUpRight, CheckCircle)
- Badge partner type: `bg-muted text-foreground`
- Badge office type (HQ/Branch): `bg-muted text-foreground`  
- Badge WCA ID: `variant="outline"` (resta com'e', pulito)
- Badge "Primary" nei contatti: `bg-primary/10 text-primary`

**4. Badge nella lista partner (colonna sinistra)**
- Status contatti (OK/Parziale/No contatti): tutti in `text-muted-foreground` con icone diverse (check, alert, x)
- KpiBadges compact: uniformati in primary come sopra

**5. Logo mancante**
- Dove non c'e' `logo_url`: spazio vuoto con bordo leggero (`w-14 h-14 rounded-xl border bg-muted`) - nessuna bandiera gigante
- La bandiera piccola resta come badge overlay solo quando c'e' il logo
- Nella lista: stesso approccio, box vuoto con bordo al posto della bandiera gigante

**6. Allineamento e organizzazione**
- Header del dettaglio: badge organizzati in una riga orizzontale ordinata
- KPI badges: tutti sulla stessa riga con flex-wrap, gap-2 uniforme
- Servizi: griglia ordinata, tutti stessi colori, icone per distinguerli
- Contatti: layout tabellare pulito

### Icone per servizi (sostituzione dei colori)
Ogni servizio avra' una micro-icona accanto al nome al posto del colore:
- Air freight: Plane
- Ocean FCL/LCL: Ship  
- Road freight: Truck
- Rail freight: Train (o TrainFront)
- Project cargo: Package
- Dangerous goods: AlertTriangle
- Perishables: Snowflake
- Pharma: Pill
- Ecommerce: ShoppingCart
- Relocations: Home
- Customs broker: FileCheck
- Warehousing: Warehouse
- NVOCC: Anchor

### File modificati

| File | Modifica |
|------|----------|
| `src/components/agents/KpiBadges.tsx` | Palette uniforme primary, layout allineato |
| `src/lib/countries.ts` | `getServiceColor()` ritorna sempre muted + aggiunta `getServiceIcon()` |
| `src/pages/PartnerHub.tsx` | Badge uniformati, logo vuoto al posto di bandiera, allineamenti |

### Risultato atteso
Una pagina elegante con massimo 2 tonalita' (sky e grigio), dove le icone fanno il lavoro di distinguere i contenuti invece dei colori. Tutto allineato, ordinato, professionale.
