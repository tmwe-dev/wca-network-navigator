

## Piano: Ricostruzione ContactListPanel con gruppi collassabili e azioni complete

### Cosa cambia

**1. Gruppi collassabili (accordion) nel pannello sinistro**

Attualmente i gruppi mostrano tutti i contatti aperti. Il nuovo comportamento:
- Ogni gruppo appare come una **striscia cliccabile** (es. "🇮🇹 Italy — 42 contatti") con contatori inline (email, telefono, deep search)
- Cliccando la striscia si **espande/collassa** il gruppo mostrando i contatti al suo interno
- Di default tutti i gruppi sono collassati — l'utente vede solo le strisce
- Funziona per qualsiasi raggruppamento (Paese, Origine, Status, Data)

**2. Card contatto con distinzione chiara azienda/contatto**

Ogni card mostra:
- **Riga 1**: Nome azienda in grassetto (o "Senza nome" in corsivo)
- **Riga 2**: Icona persona + nome contatto + posizione
- **Riga 3**: Icone rapide inline — ✉ email (link mailto), 📱 WhatsApp (link wa.me), ☎ telefono (link tel)
- Holding pattern compatto a destra

**3. Azioni sul gruppo nella striscia**

Nella striscia del gruppo, accanto al contatore:
- **Deep Search** sul gruppo intero (seleziona tutti i contatti del gruppo)
- **Alias Azienda** (genera alias per tutti i contatti del gruppo)
- Contatori: totale, con email, con telefono, con deep search, con alias

**4. Bulk actions funzionanti**

Le azioni bulk esistenti (Deep Search, Campagna, Status) vengono collegate alle funzionalità reali — in particolare Deep Search chiamerà l'edge function `deep-search-partner` adattata per i contatti (o un equivalente).

### File da modificare

| File | Modifica |
|------|----------|
| `src/components/contacts/ContactListPanel.tsx` | Riscrittura completa: gruppi accordion collassabili, card riprogettate, contatori per gruppo, azioni gruppo (Deep Search, Alias), link WhatsApp/email/telefono inline |
| `src/components/contacts/ContactDetailPanel.tsx` | Migliorare distinzione azienda vs contatto nel header, assicurare WhatsApp punti al mobile prima del telefono |

### Dettaglio tecnico

**Striscia gruppo** — usa stato locale `Set<string>` per i gruppi aperti. Struttura:
```text
┌─────────────────────────────────────────────┐
│ 🇮🇹 Italy                    ✉12 ☎8 🔍3  42 │  ← cliccabile
├─────────────────────────────────────────────┤
│  [card] Acme Logistics                      │  ← visibile solo se espanso
│         Mario Rossi • Sales Manager         │
│         ✉ mario@acme.it  📱 WhatsApp        │
│  [card] Beta Transport ...                  │
└─────────────────────────────────────────────┘
```

**Contatori gruppo** — calcolati con un `useMemo` sugli items del gruppo:
- `withEmail`: contatti con email non-null
- `withPhone`: contatti con phone/mobile non-null  
- `withDeepSearch`: contatti con deep_search_at non-null
- `withAlias`: contatti con company_alias non-null

**Deep Search su gruppo** — seleziona tutti gli ID del gruppo e li passa alla bulk action esistente. Per ora i contatti non hanno la stessa infrastruttura dei partner, quindi la Deep Search sarà un placeholder che aggiorna `deep_search_at` e registra un'interazione.

