

# Goal e Proposte: Card Griglia con Icone + Dialog di Modifica

## Cosa cambia

I tab "Goal" e "Proposte" nel ContentManager attualmente mostrano una lista verticale di card con editing inline. Vanno trasformati in una **griglia di card compatte** (4-5 per riga) con icona descrittiva, titolo breve. Click sulla card apre un **Dialog** per modificare nome e testo.

## Design

```text
┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐
│  🎯      │ │  📋      │ │  🤝      │ │  📧      │ │  🔍      │
│ Primo    │ │ Richiesta│ │ Present. │ │ Invito   │ │ Ricerca  │
│ contatto │ │ info     │ │ servizi  │ │ meeting  │ │ partner  │
│          │ │          │ │          │ │          │ │          │
│ [Edit] [X]│ │          │ │          │ │          │ │          │
└──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────┘
```

- Griglia responsive: `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5`
- Ogni card: icona (assegnata ciclicamente da un set di icone Lucide), nome troncato, hover per edit/delete
- Click sulla card → Dialog con Input per nome + Textarea per testo + Salva/Annulla
- Pulsante "+" come ultima card per aggiungere nuovo elemento
- Icone assegnate ciclicamente da set predefinito (Target, Handshake, Mail, Search, Globe, Briefcase, TrendingUp, Users, Package, FileCheck)

## File

| File | Azione |
|------|--------|
| `src/components/settings/ContentManager.tsx` | Sostituire `ContentItemCard` e `ContentListView` con griglia card + Dialog |

Nessun nuovo file necessario — tutto contenuto nel ContentManager esistente.

