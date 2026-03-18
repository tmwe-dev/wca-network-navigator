

## Card Partner — Riposizionamento Rating e Logo

### Modifiche in `src/components/partners/CountryWorkbench.tsx`

#### 1. Rating spostato in basso a destra
- **Rimuovere** il blocco rating dalla Row 2 (righe 464-469)
- **Aggiungere** il rating nella colonna destra, sotto Trophy/Years e Networks count
- Layout colonna destra diventa: `Trophy + anni` → `Networks count` → `Star + valore rating`

#### 2. Logo più grande e centrato a sinistra
- Aumentare dimensioni da `w-9 h-9` a `w-12 h-12`
- Centrarlo verticalmente nella card (`self-center` o `mt-auto mb-auto`)

#### 3. Flag in alto a sinistra
- Spostare il flag del paese sopra il logo o nell'angolo in alto a sinistra del blocco card, prima del logo
- Piccolo flag emoji posizionato come badge nell'angolo

#### Layout risultante
```text
┌──────────────────────────────────────────────┐
│ # ☐ 🇦🇱                                     │
│      [LOGO]   COMPANY NAME      🏆 12       │
│      (big)    👤 Mario Rossi +2  👥 3        │
│               ──────────────     ⭐ 4.2      │
│               ✈ 🚢 📦 🚛                     │
│               🇮🇹 🇲🇪 🇩🇪                      │
└──────────────────────────────────────────────┘
```

Colonna destra allineata: Trophy anni → Networks count → Rating (impilati verticalmente).

#### File: `src/components/partners/CountryWorkbench.tsx` — righe 408-523

