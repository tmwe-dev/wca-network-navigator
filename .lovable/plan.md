

# Goal e Proposte: Categorie Automatiche con AI

## Problema
Attualmente goal e proposte sono una griglia piatta senza organizzazione. L'utente non capisce a colpo d'occhio cosa serve per il primo contatto, cosa per il follow-up, cosa per le richieste informative. Serve raggruppamento per categoria, e AI deve assegnare automaticamente la categoria quando l'utente crea un nuovo elemento.

## Soluzione

### 1. Aggiungere campo `category` al modello `ContentItem`

Estendere l'interfaccia in `defaultContentPresets.ts`:

```typescript
export interface ContentItem {
  name: string;
  text: string;
  category?: string; // "primo_contatto" | "follow_up" | "richiesta" | "proposta_servizi" | "partnership" | "altro"
}
```

Categorie predefinite (con label e icona):
- **Primo contatto** — presentazioni, conoscenza iniziale
- **Follow-up** — secondo contatto, ripresa dialogo
- **Richiesta** — informazioni, tariffe, referenze
- **Proposta servizi** — offerte commerciali concrete
- **Partnership** — accordi, esclusività, network
- **Altro** — tutto il resto

I default esistenti vengono pre-assegnati alle categorie corrette direttamente nei dati.

### 2. UI raggruppata per categoria

Nel `ContentGridView`, gli item vengono raggruppati per `category`. Ogni gruppo ha:
- Header con icona + nome categoria + conteggio badge
- Sotto: griglia card come ora
- Sezioni collassabili con click sull'header

```text
▼ Primo contatto (3)
┌────────┐ ┌────────┐ ┌────────┐
│ 🎯     │ │ 🤝     │ │ 📧     │
│ Primo  │ │ Presen.│ │ Invito │
│ contatt│ │ servizi│ │ meeting│
└────────┘ └────────┘ └────────┘

▼ Richiesta (2)
┌────────┐ ┌────────┐
│ 🔍     │ │ 📋     │
│ Info   │ │ Tariffe│
└────────┘ └────────┘
```

### 3. AI auto-categorizzazione alla creazione

Quando l'utente salva un nuovo goal/proposta, il sistema chiama una edge function che usa Lovable AI per analizzare nome + testo e restituire la categoria corretta.

- Nuova edge function `categorize-content` che riceve `{ name, text, categories }` e ritorna `{ category }`
- Usa `google/gemini-3-flash-preview` (veloce e economico)
- Durante la categorizzazione, un piccolo spinner appare sulla card
- Se AI fallisce, default a "altro"

Nel dialog di creazione: l'utente scrive nome e testo, preme Salva, AI assegna la categoria automaticamente. L'utente puo' anche sovrascrivere manualmente la categoria con un select nel dialog.

### 4. Dialog aggiornato

Il dialog di modifica/creazione mostra:
- Input nome (come ora)
- Textarea testo (come ora)
- Select categoria (precompilato da AI per i nuovi, modificabile manualmente)
- Badge "Categorizzato da AI" quando assegnato automaticamente

## File coinvolti

| File | Azione |
|------|--------|
| `src/data/defaultContentPresets.ts` | Aggiungere `category` all'interfaccia + pre-assegnare categorie ai default |
| `src/components/settings/ContentManager.tsx` | Raggruppare card per categoria, aggiungere select categoria nel dialog, chiamata AI alla creazione |
| `supabase/functions/categorize-content/index.ts` | **Nuovo** — edge function che usa Lovable AI per categorizzare |

Nessuna modifica al database — i dati restano in `app_settings` come JSON, semplicemente ogni item ha un campo `category` in piu'.

