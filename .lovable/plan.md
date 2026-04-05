

# L'Oracolo — Laboratorio AI per Email Composer

## Concetto

Pannello verticale sul lato destro dell'Email Composer che funge da "laboratorio" per configurare la generazione e il miglioramento AI delle email. Sostituisce i bottoni "Genera AI" e "Migliora" dalla toolbar con un pannello strutturato e sempre visibile.

## Layout

```text
┌─────────────────────────────────────────────────────────┐
│  [Destinatari]  [Oggetto]                               │
│  [Toolbar: {x} Link Attach Preview]                     │
├──────────────────────────────┬──────────────────────────┤
│                              │  🔮 ORACOLO              │
│                              │  ┌────────────────────┐  │
│   [Corpo email]              │  │ Tab: Tipi │ Templ. │  │
│                              │  ├────────────────────┤  │
│                              │  │ 🤝 Primo contatto  │  │
│                              │  │ 🔄 Follow-up       │  │
│                              │  │ 📋 Richiesta info  │  │
│                              │  │ 💼 Proposta        │  │
│                              │  │ 🌐 Partnership     │  │
│                              │  │ + Crea nuovo...     │  │
│                              │  ├────────────────────┤  │
│                              │  │ ⚙ Opzioni AI       │  │
│                              │  │ □ Deep Search live  │  │
│                              │  │ □ Usa Knowledge Base│  │
│                              │  │ Tono: [Formale ▾]  │  │
│                              │  ├────────────────────┤  │
│                              │  │ [🔮 Genera]        │  │
│                              │  │ [🪄 Migliora]      │  │
│                              │  └────────────────────┘  │
├──────────────────────────────┴──────────────────────────┤
│  [Bozza]            [Invia a N destinatari]             │
└─────────────────────────────────────────────────────────┘
```

## Struttura del Pannello Oracolo (colonna destra, ~260px)

### Due Tab in alto
1. **Tipi Email** — Card con icone per selezionare il tipo/tono della mail (primo contatto, follow-up, richiesta, proposta, partnership, altro). Ogni card mostra icona + nome. Hover → popover con descrizione completa del prompt. Click → seleziona come preset attivo per la generazione.
2. **Template** — Template email salvati (da `email_templates` o `email_drafts`). Click → carica subject + body. Hover → preview del contenuto.

### Sezione "Opzioni AI" (sotto i tab, sempre visibile)
- **Toggle Deep Search**: esegui ricerca approfondita sul destinatario prima di generare
- **Toggle Knowledge Base**: includi SKB e tecniche di vendita (Chris Voss, etc.)
- **Selettore Tono**: Formale / Professionale / Amichevole / Diretto
- **Link "Gestisci KB"**: apre dialog per visualizzare/editare le sezioni della Knowledge Base utilizzate

### Bottoni azione (in fondo al pannello)
- **🔮 Genera con Oracolo** — genera usando il tipo selezionato + opzioni AI
- **🪄 Migliora** — migliora il testo esistente con le stesse impostazioni

### Gestione Prompt
- Bottone "+ Crea tipo" per aggiungere un nuovo tipo di email con nome, icona, prompt personalizzato
- Ogni tipo è editabile (modifica prompt, icona, categoria)
- Salvato in `app_settings` con chiave `email_oracle_types` (stesso pattern di ContentPicker)

## Dettagli Tecnici

### Nuovo componente: `src/components/email/OraclePanel.tsx`
- Pannello verticale con tab (Tipi / Template)
- Gestisce stato locale per: tipo selezionato, opzioni AI (deep search, KB, tono)
- Espone callback `onGenerate(config)` e `onImprove(config)` al parent

### Modifiche a `src/pages/EmailComposer.tsx`
- Layout da singola colonna a `grid grid-cols-[1fr_260px]`
- Rimuove bottoni "Genera AI" e "Migliora" dalla toolbar (spostati nell'Oracolo)
- Passa config dall'Oracolo alle funzioni `handleAIGenerate` e `handleAIImprove`

### Dati tipo email (preset)
- Riutilizza il pattern `app_settings` + `CONTENT_CATEGORIES` già esistente
- Struttura: `{ name, icon, prompt, category, tone }`
- Default precompilati basati sui goal/proposte già definiti in `defaultContentPresets.ts`

### Integrazione Deep Search
- Quando attivo, prima della generazione chiama l'edge function di deep search sul destinatario corrente
- Risultato iniettato nel context della generazione email

### Knowledge Base
- Toggle per includere le sezioni SKB nel prompt di generazione
- Dialog "Gestisci KB" per vedere/editare il contenuto (lettura da `app_settings` chiave `sales_knowledge_base`)

### Edge Functions
- `generate-email`: riceve parametri aggiuntivi `oracle_type`, `tone`, `use_kb`, `deep_search_data`
- `improve-email`: riceve `tone` e `use_kb` per rispettare le impostazioni dell'Oracolo

## File coinvolti

| File | Azione |
|------|--------|
| `src/components/email/OraclePanel.tsx` | **Nuovo** — Pannello Oracolo con tab, tipi, opzioni |
| `src/data/defaultEmailTypes.ts` | **Nuovo** — Preset tipi email con icone e prompt |
| `src/pages/EmailComposer.tsx` | Layout a 2 colonne, integrazione Oracolo |
| `supabase/functions/generate-email/index.ts` | Parametri oracle estesi |
| `supabase/functions/improve-email/index.ts` | Parametri tono e KB |

