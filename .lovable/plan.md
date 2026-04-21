

# Ristrutturazione Prompt Lab — Navigazione a 3 livelli

## Problema attuale
8 tab top-level affiancati su una sola riga (System Prompt, KB Doctrine, Operative, Email, Voice, Playbooks, Personas, AI Profile) + sotto-tab nascosti dentro Email (3) e Voice (layout a 3 colonne). L'utente non capisce cosa va dove e deve scorrere orizzontalmente.

## Nuova architettura — 3 livelli gerarchici

### Livello 1 — Tabs orizzontali in alto (3 macroaree)
Riducono il rumore raggruppando per dominio funzionale:

| Tab | Cosa contiene | Icona |
|---|---|---|
| **Core AI** | System Prompt · KB Doctrine · AI Profile | `Brain` |
| **Comunicazione** | Email · Voice / 11Labs · Operative | `MessageSquare` |
| **Strategia** | Playbooks · Agent Personas | `Target` |

### Livello 2 — Menu verticale a sinistra (sotto-aree della macroarea)
Riusa il componente esistente `VerticalTabNav` (già usato in altre parti del progetto). Mostra le voci della macroarea attiva con icona + label, larghezza 160px.

Esempio per **Core AI**:
```
┌─────────────────┐
│ ◉ System Prompt │  ← attivo
│ ○ KB Doctrine   │
│ ○ AI Profile    │
└─────────────────┘
```

### Livello 3 — Tab orizzontali interni (solo dove servono)
Restano dentro le pagine che hanno già viste multiple:
- **Email** → Tipi · Global Prompts · Address Rules (già esiste)
- **Voice** → Persona · Coerenza · Voice Prompt (già a 3 colonne, OK così)
- Le altre (System Prompt, KB Doctrine, ecc.) NON hanno sotto-tab → vista diretta

## Layout finale

```text
┌─────────────────────────────────────────────────────────────────┐
│ 🧪 Prompt Lab          [Upload] [Export]                        │
├─────────────────────────────────────────────────────────────────┤
│  [Core AI]  [Comunicazione]  [Strategia]   ← Livello 1         │
├──────────┬──────────────────────────────────────────────────────┤
│ ◉ System │  ┌──────────────────────────────────────────────┐   │
│   Prompt │  │ Tipi | Global | Rules   ← Livello 3 (se c'è) │   │
│ ○ KB     │  ├──────────────────────────────────────────────┤   │
│   Doctrine│ │                                              │   │
│ ○ AI     │  │   Contenuto del tab attivo                   │   │
│   Profile│  │                                              │   │
│   ↑      │  │                                              │   │
│ Livello 2│  │                                              │   │
└──────────┴──┴──────────────────────────────────────────────┴───┤
│ Lab Agent Chat (resizable, bottom panel)                        │
└─────────────────────────────────────────────────────────────────┘
```

## File da modificare
- `src/v2/ui/pages/PromptLabPage.tsx` — sostituire layout tabs piatti con struttura a 3 livelli
- `src/v2/ui/pages/prompt-lab/types.ts` — aggiungere `PROMPT_LAB_GROUPS` (raggruppamento macroarea → tab interni)

## File NON toccati
- Tutti i tab interni (`SystemPromptTab`, `EmailPromptsTab`, `VoiceElevenLabsTab`, ecc.) — restano invariati
- `LabAgentChat`, `UploadButton`, `ExportButton`, `SplitBlockEditor` — invariati
- `VerticalTabNav` (riusato)

## Modifiche tecniche
1. In `types.ts`: definire `PROMPT_LAB_GROUPS: Array<{ id, label, icon, tabs: PromptLabTabId[] }>` con i 3 raggruppamenti.
2. In `PromptLabPage.tsx`:
   - Stato `[activeGroupId, activeTabId]` invece del solo `activeTabId`
   - Top: `<Tabs>` orizzontali per i 3 gruppi
   - Layout interno: `flex` con `<VerticalTabNav>` a sinistra (160px) e contenuto a destra
   - Quando si cambia gruppo, attiva automaticamente il primo tab del gruppo
   - Mantiene `ResizablePanelGroup` verticale con LabAgentChat in basso

## Verifica end-to-end
1. Aprire `/v2/prompt-lab` → 3 tab in alto chiari (Core AI / Comunicazione / Strategia)
2. Click su "Comunicazione" → menu sinistro mostra Email/Voice/Operative
3. Click su "Email" → vista carica con i suoi 3 sub-tab orizzontali (Tipi/Global/Rules)
4. Click su "Voice" → vista a 3 colonne resta intatta
5. Cambio gruppo → primo tab del nuovo gruppo viene auto-selezionato
6. Lab Agent Chat in basso continua a funzionare con il context del tab attivo

## Cosa otterrai
- Da **8 tab piatti + sotto-tab nascosti** a **3 macroaree → menu laterale → vista**
- Navigazione prevedibile: l'utente sa sempre dove sta (gruppo > sezione > sub-vista)
- Spazio orizzontale liberato (niente più scroll dei tab top)
- Stesso pattern visivo già usato altrove nel progetto (VerticalTabNav)

