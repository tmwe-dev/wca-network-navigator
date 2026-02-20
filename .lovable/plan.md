
# Wizard Guidato Multi-Step per l'Importazione Prospect

## Obiettivo

Creare un componente **wizard** (procedura guidata) a 4 step che guidi l'utente passo-passo fino all'avvio del download, sostituendo la schermata "idle" del tab Importa con un'interfaccia molto più chiara e intuitiva.

---

## I 4 Step del Wizard

```text
Step 1 → Step 2 → Step 3 → Step 4
SETTORE   ZONA    PROFILO  AVVIA
ATECO    GEO     AZIENDA  DOWNLOAD
```

### Step 1 — Settore ATECO
- Mostra le **Sezioni ATECO** (A, B, C, D…) come grandi card cliccabili con nome e icona
- Sotto ogni sezione, quando cliccata, si espandono i **Gruppi** (es. 13.10, 13.20…)
- Badge con il numero di prospect già nel DB per ogni gruppo
- Multi-selezione: si possono scegliere più codici
- Pulsante "Avanti →" abilitato appena si seleziona almeno 1 codice (o si salta)

### Step 2 — Zona Geografica
- **Regioni italiane** come chip selezionabili (multi-select)
- Se si seleziona una regione, appaiono le **Province** relative da affinare
- Oppure: "Tutta Italia" per non filtrare geograficamente
- Pulsante "← Indietro" e "Avanti →"

### Step 3 — Profilo Aziendale (opzionale)
- **Fatturato min/max** con un semplice slider visivo (0 → 50M, 50M → 500M, 500M+)
- **Dipendenti min/max** con range preimpostati (Micro <10, Piccola 10-50, Media 50-250, Grande 250+)
- Toggle **"Ha telefono"** / **"Ha email"** / **"Entrambi"**
- Pulsante "Salta questo step" per passare direttamente all'avvio
- Pulsante "← Indietro" e "Avanti →"

### Step 4 — Riepilogo e Avvio
- Mostra un **riepilogo** di tutte le scelte fatte (ATECO selezionati, zona, filtri)
- Mostra lo **stato dell'estensione RA** (connessa/non connessa)
- Pulsante grande "🚀 Cerca Aziende" per avviare la ricerca
- Torna al flusso normale (`phase = "searching"`) dopo il click

---

## Architettura Tecnica

### Nuovo componente: `src/components/prospects/ImportWizard.tsx`

Il wizard è un componente autonomo che:
- Gestisce internamente il proprio `step` (1-4) con navigazione avanti/indietro
- Raccoglie le scelte in uno stato locale `wizardState`
- Al completamento (Step 4 → Avvia), chiama la funzione `onStart(atecoCodes, regions, provinces, filters)` passata come prop dal `ProspectImporter`

```typescript
interface WizardState {
  atecoCodes: string[];
  regions: string[];
  provinces: string[];
  filters: Partial<ProspectFilters>;
}

interface ImportWizardProps {
  isDark: boolean;
  onStart: (state: WizardState) => void;
  initialAtecoCodes?: string[];   // pre-popolati dall'albero ATECO a sinistra
  initialRegions?: string[];
  initialProvinces?: string[];
}
```

### Modifica: `ProspectImporter.tsx`

- Quando `phase === "idle"`, invece dello schermo attuale, renderizza `<ImportWizard>` 
- Quando il wizard chiama `onStart(...)`, il `ProspectImporter` fa partire la ricerca con i parametri ricevuti
- I parametri dall'albero ATECO (già selezionati) vengono passati come valori iniziali pre-compilati al wizard

### Barra di progresso visiva

In cima al wizard, una barra con i 4 step e indicatori di stato:

```
[●──────────────────────]  Step 1 di 4
  Settore  Zona  Profilo  Avvia
```

---

## UX e Visual Design

### Step 1 — Selezione Settore
- Griglia di card 2×N con le sezioni ATECO (Sezione A: Agricoltura, Sezione B: Estrazione, …)
- Colore di sfondo diverso per le sezioni già selezionate
- Badge azzurro "X nel DB" se ci sono prospect già importati per quel settore

### Step 2 — Zona Geografica
- Chip grandi per le 20 regioni italiane
- Quando una regione è selezionata, appaiono le province sotto (chip più piccoli)
- Chip speciale "🇮🇹 Tutta Italia" che deseleziona tutto

### Step 3 — Profilo Aziendale
- 3 range preimpostati per fatturato: **Micro** (< 500K), **Piccola** (500K–5M), **Media** (5M–50M), **Grande** (> 50M) — cliccabili come chip
- 4 range preimpostati per dipendenti: **Micro** (< 10), **Piccola** (10–50), **Media** (50–250), **Grande** (250+)
- 3 toggle: telefono, email, entrambi

### Step 4 — Avvio
- Card di riepilogo con le scelte fatte in formato leggibile
- Indicatore estensione RA (verde/rosso)
- Pulsante "Cerca Aziende" grande e prominente

---

## File da creare/modificare

| File | Operazione |
|---|---|
| `src/components/prospects/ImportWizard.tsx` | **Crea** — wizard a 4 step |
| `src/components/prospects/ProspectImporter.tsx` | **Modifica** — usa `ImportWizard` quando `phase === "idle"` |

---

## Nessuna modifica al DB o backend necessaria

Il wizard è puramente client-side: raccoglie i parametri e li passa al flusso di importazione già esistente.
