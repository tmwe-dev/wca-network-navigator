

# Piano: Sidebar Chiare, Dinamiche e Usabili — Redesign Completo

## Obiettivo

Ridisegnare entrambe le sidebar (Mission e Filtri) con un design **grande, chiaro, con icone evidenti**, dropdown per selezionare i preset di Goal/Proposta e la possibilità di registrare nuovi contenuti. Tutto deve essere comprensibile anche da un utente anziano: font grandi, icone esplicite, spaziatura generosa, zero ambiguità.

## Problemi Attuali

- **MissionDrawer**: Font 10-11px, emoji come icone (🎯📝), sezioni collapsibili che nascondono contenuti importanti, ContentPicker in un popover minuscolo con griglia 3 colonne illeggibile
- **FiltersDrawer**: Chip piccoli (text-xs), nessuna icona nei filtri, etichette in maiuscolo 11px poco leggibili
- **ContentPicker**: Popover 420px con card 10px — impossibile da usare su schermi piccoli o per utenti con problemi di vista

## Cosa Cambia

### 1. MissionDrawer — Redesign Completo

**Layout nuovo:**
```text
┌─────────────────────────────────┐
│ 🎯 MISSION CONTEXT             │
│ Configura obiettivo e materiali │
├─────────────────────────────────┤
│                                 │
│ ⭐ PRESET RAPIDO               │
│ [▼ Seleziona preset...      ]  │
│ [Nome]  [💾 Salva]  [🗑️]      │
│                                 │
│ ⚡ QUALITÀ AI                  │
│ [Rapida] [Standard] [Premium]  │
│                                 │
│ ─────────────────────────────── │
│                                 │
│ 🎯 OBIETTIVO                   │
│ [▼ Seleziona da libreria...  ] │  ← Select/dropdown grande
│ [+ Crea nuovo obiettivo]       │  ← Bottone per aggiungere
│ ┌─────────────────────────────┐│
│ │ Testo obiettivo editabile   ││  ← Textarea grande
│ └─────────────────────────────┘│
│                                 │
│ 📝 PROPOSTA                    │
│ [▼ Seleziona da libreria...  ] │
│ [+ Crea nuova proposta]        │
│ ┌─────────────────────────────┐│
│ │ Testo proposta editabile    ││
│ └─────────────────────────────┘│
│                                 │
│ 📧 DESTINATARI (3)             │
│ [🔍 Cerca azienda...        ] │
│ [chip] [chip] [chip] [Rimuovi] │
│                                 │
│ 📎 DOCUMENTI ▾                 │
│ 🔗 LINK ▾                      │
└─────────────────────────────────┘
```

**Cambiamenti chiave:**
- Font **14px** per titoli sezione, **13px** per contenuti (non più 10-11px)
- Icone Lucide reali (Target, FileText, Users, Paperclip, Link2) al posto delle emoji
- **Select/dropdown nativi** per Goal e Proposta: mostrano la lista dei default raggruppati per categoria, con opzione "Crea nuovo" in fondo
- Bottone **"+ Crea nuovo"** che apre un dialog inline per nome + testo + categoria
- Textarea con `min-h-[100px]` e font leggibile
- Sezioni Goal/Proposta/Destinatari **sempre aperte** (non collapsibili) — solo Documenti e Link collassabili
- Spaziatura `space-y-6` tra sezioni

### 2. Nuovo Componente `ContentSelect.tsx`

Sostituisce il ContentPicker con un **Select dropdown** chiaro:
- Opzioni raggruppate per categoria con icone Lucide
- Ogni opzione mostra nome + anteprima testo (troncata)
- In fondo: separator + "➕ Crea nuovo..." che apre Dialog
- Dialog per creare/modificare: Nome, Categoria (select), Testo (textarea)
- Salvataggio in app_settings come fa il ContentPicker attuale

### 3. FiltersDrawer — Miglioramenti

- Icone Lucide accanto a ogni titolo sezione (Search, ArrowUpDown, Database, Users, Shield)
- Font sezione **13px** bold (non 11px uppercase)
- Chip filtro più grandi: `py-2 px-4 text-sm` (non py-1.5 px-3 text-xs)
- Ogni chip con icona piccola a sinistra
- Bottone Reset e Applica più grandi (`h-10`)

### 4. Larghezza Sidebar

- MissionDrawer: da `w-[360px]` a `w-[400px] sm:max-w-[440px]`
- FiltersDrawer: da `w-[320px]` a `w-[360px] sm:max-w-[400px]`

## File Coinvolti

| File | Azione |
|------|--------|
| `src/components/shared/ContentSelect.tsx` | **Nuovo** — Select dropdown per Goal/Proposta con crea nuovo |
| `src/components/global/MissionDrawer.tsx` | Redesign completo: layout, font, icone, ContentSelect |
| `src/components/global/FiltersDrawer.tsx` | Font più grandi, icone sezione, chip più grandi |
| `src/components/shared/ContentPicker.tsx` | Mantenuto per retrocompatibilità ma non più usato nelle sidebar |

## Principi di Design

1. **Leggibilità**: Minimo 13px per testo, 14px per label sezioni
2. **Icone esplicite**: Lucide icons reali, colorate, 18-20px nelle sezioni
3. **Dropdown nativi**: Select standard per scegliere da libreria, non popover con griglia
4. **Crea + Modifica**: Ogni dropdown ha "Crea nuovo" e ogni item è modificabile
5. **Spaziatura**: gap-6 tra sezioni, padding generoso (p-5)
6. **Zero collapsible per le sezioni principali**: Goal, Proposta, Destinatari sempre visibili

