

## Fix Card Layout — Flag sotto checkbox, Logo allineato

### Problema
Il flag è posizionato in una colonna separata che disallinea il logo e crea disordine visivo. Flag e logo sono impilati verticalmente in un wrapper che sposta tutto.

### Soluzione
Riorganizzare la struttura della card in modo che:
- **Flag**: piccolo, posizionato sotto il numero progressivo e la checkbox (stessa colonna sinistra), non in una colonna separata
- **Logo**: sempre nella stessa posizione fissa, centrato verticalmente, indipendente dal flag
- Il flag non deve influenzare il posizionamento del logo

### Layout risultante
```text
│ 1 ☐  [LOGO]   COMPANY NAME         🏆 12  │
│   🇹🇭  (w-12)  👤 Mario +2           👥 3   │
│                ─────────             ⭐ 4.2  │
│                ✈ 🚢 📦 🚛                    │
│                🇮🇹 🇲🇪 🇩🇪                     │
```

### Modifiche in `src/components/partners/CountryWorkbench.tsx` (righe 416-436)

1. **Rimuovere** il wrapper `flex-col` che contiene flag + logo (righe 427-436)
2. **Spostare il flag** sotto la checkbox, nella stessa colonna del numero e checkbox — aggiungere il flag come piccolo elemento sotto il checkbox
3. **Logo** diventa elemento indipendente, `shrink-0 self-center`, con `w-12 h-12` centrato

Struttura nuova:
```tsx
{/* Left: number + checkbox + flag stacked */}
<div className="flex flex-col items-center shrink-0 gap-0.5">
  <span className="text-[10px] ...">{index + 1}</span>
  <Checkbox ... />
  <span className="text-xs">{flag}</span>
</div>

{/* Logo standalone */}
<div className="w-12 h-12 rounded-lg ... self-center shrink-0">
  {logo || fallback}
</div>

{/* Content */}
<div className="flex-1 min-w-0 space-y-1">...</div>

{/* Right metrics */}
<div className="flex flex-col items-end ...">...</div>
```

Questo elimina il disallineamento e mantiene il logo sempre nella stessa posizione.

