

## Icona Cervello Dorato per Deep Search

Aggiungere un indicatore visivo (icona Brain dorata) ai partner che hanno ricevuto la Deep Search, visibile sia nella card lista (sinistra) sia nel dettaglio (destra).

### Logica di rilevamento

Il campo `partner.enrichment_data?.deep_search_at` indica che la Deep Search e stata completata. Se presente, mostrare l'icona.

### Modifiche

#### 1. `src/components/partners/PartnerListItem.tsx`
- Importare `Brain` da lucide-react
- Aggiungere un'icona Brain dorata posizionata nell'angolo in alto a destra della card, con tooltip che mostra la data della Deep Search
- Stile: `text-amber-400` con leggero glow/shadow dorato

#### 2. `src/components/partners/PartnerDetailFull.tsx`
- Importare `Brain` da lucide-react
- Nell'header compatto, accanto al nome azienda o nell'angolo del box header, aggiungere la stessa icona Brain dorata con tooltip data

### Stile dell'icona

```tsx
<Tooltip>
  <TooltipTrigger>
    <Brain className="w-4 h-4 text-amber-400 drop-shadow-[0_0_3px_rgba(251,191,36,0.4)]" />
  </TooltipTrigger>
  <TooltipContent>
    Deep Search — {date}
  </TooltipContent>
</Tooltip>
```

### File coinvolti
- `src/components/partners/PartnerListItem.tsx`
- `src/components/partners/PartnerDetailFull.tsx`

