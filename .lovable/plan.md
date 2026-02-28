

## Piano: Workspace Avanzato — Preset, Layout Ottimizzato, Thumbnails, WhatsApp

### 1. Nuova tabella `workspace_presets`

Tabella per salvare combinazioni riutilizzabili di goal + proposta + documenti + link:

```sql
CREATE TABLE workspace_presets (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  name text NOT NULL,
  goal text DEFAULT '',
  base_proposal text DEFAULT '',
  document_ids jsonb DEFAULT '[]',
  reference_links jsonb DEFAULT '[]',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
-- RLS: utente vede solo i propri
```

### 2. Layout ristrutturato — full height

Attualmente: header + GoalBar tabs + split panel (sprecando spazio verticale).

Nuovo layout:
```text
┌──────────────────────────────────────────────────────┐
│ Header compatto (titolo + search + azioni)            │
├───────────┬──────────────────────────────────────────┤
│           │  GoalBar (tabs Goal/Proposta/Docs/Links) │
│           │  + dropdown preset + salva/carica        │
│  Contact  │  + thumbnails documenti + link previews  │
│  List     ├──────────────────────────────────────────┤
│  (full    │                                          │
│  height)  │  Email Canvas                            │
│           │  (anteprima email selezionata)            │
│           │                                          │
├───────────┴──────────────────────────────────────────┤
```

- Lista contatti a sinistra a **tutta altezza** (dal header fino al fondo)
- Destra divisa: config bar in alto (GoalBar + preset + thumbnails) e canvas email sotto

### 3. GoalBar con dropdown preset

- Aggiungere un `Select` dropdown accanto alle tabs: "Carica preset..."
- Opzioni: preset salvati dall'utente + "Salva come nuovo preset"
- Al caricamento: popola goal, proposta, documenti, link
- Bottone piccolo "Salva" per aggiornare/creare preset corrente

### 4. Thumbnails documenti e link

Nella sezione Documenti del GoalBar (o in un pannello dedicato sotto le tabs):
- Mostrare miniature dei PDF/documenti (icona tipo file + nome + dimensione)
- Per i link: mostrare favicon + hostname + titolo della pagina (recuperato client-side via unfurl o semplicemente hostname)
- Layout a griglia compatta con card piccole

### 5. WhatsApp quick link nella lista contatti

Per ogni contatto che ha `mobile` o `direct_phone`:
- Icona WhatsApp verde cliccabile
- Link: `https://wa.me/{numero}` (pulito da spazi e caratteri speciali)
- Posizionato accanto alle icone email/phone esistenti

### 6. Hook `useWorkspacePresets`

- `fetchPresets()`: lista preset dell'utente
- `savePreset(name, goal, proposal, docIds, links)`: insert/upsert
- `deletePreset(id)`
- `loadPreset(id)`: ritorna i dati per popolare il form

### File da creare/modificare

| File | Azione |
|------|--------|
| Migrazione SQL | Creare tabella `workspace_presets` con RLS |
| `src/hooks/useWorkspacePresets.ts` | Nuovo hook CRUD preset |
| `src/components/workspace/GoalBar.tsx` | Aggiungere dropdown preset, salva, thumbnails docs/links |
| `src/pages/Workspace.tsx` | Ristrutturare layout full-height, integrare preset |
| `src/components/workspace/ContactListPanel.tsx` | Aggiungere icona WhatsApp per contatti con telefono |
| `src/components/workspace/EmailCanvas.tsx` | Nessuna modifica strutturale, solo adattamento al nuovo layout |

