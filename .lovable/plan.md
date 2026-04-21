

# LOVABLE-71 — Prompt Lab Page (`/v2/prompt-lab`)

Nuova pagina centralizzata per ispezionare, modificare, migliorare con AI ed esportare **tutti i prompt e la knowledge base** del sistema. Layout split (sinistra editabile / destra migliorato AI), 8 tab, chat agent dedicato in footer, upload file, save su DB, export JSON.

---

## Struttura

### Route
- `/v2/prompt-lab` aggiunta a `src/constants/routes.ts` (`ROUTE_PROMPT_LAB`) e registrata in `src/v2/ui/AppV2.tsx` (lazy load + ErrorBoundary).
- Voce nel menu sidebar V2 (Settings → "Prompt Lab" oppure root nav).

### File nuovi
```text
src/v2/ui/pages/PromptLabPage.tsx                  ← shell con Tabs + ResizablePanelGroup verticale (chat in basso)
src/v2/ui/pages/prompt-lab/
  ├─ SplitBlockEditor.tsx                          ← componente core riusabile
  ├─ LabAgentChat.tsx                              ← chat footer collapsible 120px
  ├─ UploadButton.tsx                              ← .txt/.md/.json/.csv parser
  ├─ ExportButton.tsx                              ← download .json snapshot completo
  ├─ types.ts                                      ← Block, BlockSource, TabContext
  ├─ tabs/SystemPromptTab.tsx
  ├─ tabs/KBDoctrineTab.tsx
  ├─ tabs/OperativePromptsTab.tsx
  ├─ tabs/EmailPromptsTab.tsx
  ├─ tabs/VoiceElevenLabsTab.tsx                   ← layout 3 colonne speciale
  ├─ tabs/PlaybooksTab.tsx
  ├─ tabs/AgentPersonasTab.tsx
  ├─ tabs/AIProfileTab.tsx
  └─ hooks/
      ├─ useLabAgent.ts                            ← wrapper unified-assistant scope kb-supervisor
      ├─ usePromptLabBlocks.ts                     ← state manager (left/right/improved/accepted) per tab
      ├─ useSystemPromptBlocks.ts                  ← carica/salva app_settings.system_prompt_blocks
      ├─ useVoiceCoherenceCheck.ts                 ← confronta persona vs voice agent prompt
      └─ useUpload.ts                              ← parser txt/json/csv
```

### File modificati
- `src/constants/routes.ts` — aggiunge `ROUTE_PROMPT_LAB = "prompt-lab"`.
- `src/v2/ui/AppV2.tsx` — registra route lazy.
- `src/v2/ui/components/SidebarV2` (file di navigazione esistente) — aggiunge link "Prompt Lab".

**Nessuna migrazione DB. Nessuna nuova edge function.**

---

## Componente core: `SplitBlockEditor`

Una griglia 2 colonne allineata per blocco, con accept/discard inline. Riusato da tutti i tab tranne Voice (3 colonne).

```tsx
<div className="grid grid-cols-2 gap-3 border-b py-3">
  <div>
    <label className="text-xs font-medium">{block.label}</label>
    <Textarea value={block.content} onChange={...} className="font-mono text-xs min-h-[80px]" />
  </div>
  <div className="bg-green-50 dark:bg-green-950/20 rounded-md p-2 relative">
    <label className="text-xs font-medium text-green-700">{block.label} — migliorato</label>
    <div className="font-mono text-xs whitespace-pre-wrap">{block.improved ?? "Nessun miglioramento — usa la chat o Rerun AI"}</div>
    {block.improved && <div className="absolute top-2 right-2"><Accept/Discard/></div>}
  </div>
</div>
```

`Block` type:
```ts
{
  id: string;          // stabile, usato per allineare left/right
  label: string;
  content: string;     // editabile (sinistra)
  improved?: string;   // proposta AI (destra)
  source: BlockSource; // dove va salvato (tabella, colonna, id record)
  dirty: boolean;
}
```

---

## Contenuto dei tab

| Tab | Sorgente | Note |
|---|---|---|
| **System Prompt** | `app_settings.system_prompt_blocks` (JSON). Default da `supabase/functions/ai-assistant/systemPrompt.ts` | 7 blocchi: IDENTITY, REASONING, INFO_SEARCH, GOLDEN_RULES, COMMERCIAL_DOCTRINE, ENGAGEMENT, KB_LOADING |
| **KB Doctrine** | `kb_entries` filtrato `category IN ('system_doctrine','system_core','memory_protocol','learning_protocol','workflow_gate')` via DAL `findKbEntries` | Un blocco split per entry (title editabile, content split) |
| **Operative Prompts** | `operative_prompts` via DAL `findOperativePrompts` | Card espandibile con split su `objective`, `procedure`, `criteria` |
| **Email Prompts** | 3 sezioni: `app_settings.email_oracle_types` + `defaultEmailTypes.ts`, `email_prompts` scope=global, `email_address_rules` | Sub-tabs interni |
| **Voice & ElevenLabs** | Sx: `agent_personas`. Centro: coherence checker. Dx: `agents.system_prompt` (voice agent) | Layout 3 colonne, "Sync →" rigenera prompt destra dal sx |
| **Playbooks** | `commercial_playbooks` | Split su `prompt_template` + `trigger_conditions` (JSON pretty) |
| **Agent Personas** | `agent_personas` | Split per `tone`, `style_rules`, `vocabulary_do`, `vocabulary_dont`, `example_messages`, `signature` |
| **AI Profile** | `app_settings` chiavi `ai_*` | Tutti i campi in split |

Tutti i tab usano `usePromptLabBlocks` per state uniforme e `useLabAgent` per "migliora questo blocco".

---

## Lab Agent (footer chat)

`LabAgentChat.tsx` — pannello collapsible 120px in basso (resizable). Usa `unified-assistant` con scope `kb-supervisor`, iniettando come `operatorBriefing` il prompt fornito (Prompt Lab Architect, max chars per tipo, regole di miglioramento).

Comportamento:
- Input libero: "migliora il blocco Identity rendendolo più conciso"
- Hook parsa il riferimento al blocco (match per label/id) e popola `block.improved` solo per quel blocco specifico
- Comando "migliora tutti" → batch su tutti i blocchi del tab attivo
- Risposte chat mostrate in cronologia (markdown via `react-markdown`)
- Niente persistenza messaggi (volatile, riparte ad ogni session)

---

## Upload / Save / Export / Accept

- **Upload** (`UploadButton`): accetta `.txt/.md` (nuovo blocco singolo), `.json` (struttura batch), `.csv` (KB entries con columns `category,title,content,priority`). Inserito come nuovo blocco a sinistra, marcato `dirty: true`.
- **Save** (per blocco o "Save all"): UPSERT nella tabella di origine secondo `block.source`. Log in `supervisor_audit_log` (action=`prompt_lab_save`, target table+id, diff prima/dopo).
- **Export**: download `.json` con snapshot di tutti i tab (timestamp, version) in `prompt-lab-export-{date}.json`.
- **Accept**: copia `improved` → `content`, marca dirty (richiede Save per persistere).
- **Accept All**: accept di tutti i blocchi del tab attivo con `improved !== null`.
- **Rerun AI**: ri-esegue `useLabAgent` su tutti i blocchi senza `improved`.

---

## Voice & ElevenLabs — checker coerenza

`useVoiceCoherenceCheck` confronta:
- Tono persona vs tono percepito nel voice prompt (chiamata AI rapida per estrarre)
- Lingua dichiarata vs lingua del voice prompt
- Vocabolario do/dont vs presenza nel voice prompt
- Restituisce array `{ field, status: 'ok'|'warn'|'fail', message }` mostrato al centro

Pulsante "Sync →" invoca Lab Agent con prompt: "Genera prompt ElevenLabs naturale e conversazionale (no markdown, no bullet) coerente con questa persona: {personaJson}". Risultato → colonna destra (voice agent prompt), accept → UPDATE `agents.system_prompt`.

---

## Considerazioni tecniche

- Pagina riusa pattern di `KBSupervisorPage` (Resizable + chat) e `AIDraftStudio` (tabs + debug); nessuna nuova architettura.
- Type safety: `Block`, `BlockSource` come union discriminata; nessun `any`.
- Layer rules: tab caricano dati via DAL esistenti (`src/data/`); UPSERT via DAL o nuovi metodi `upsert*` aggiunti ai DAL esistenti (no `supabase.from()` diretto in UI).
- `system_prompt_blocks`: nuova chiave `app_settings` (key/value), niente schema change.
- RLS: `app_settings` è già scoped per user_id; KB/personas/playbooks già visibili agli operator autenticati.
- Audit: ogni save crea row in `supervisor_audit_log` (tabella esistente).
- Performance: tab caricati lazy (un tab attivo per volta carica i suoi dati).
- Memoria: rispetta vincolo "DAL access only" — nuovi metodi `upsertKbEntry`, `upsertOperativePrompt`, `upsertAgentPersona`, `upsertPlaybook`, `upsertAppSetting` se non esistono già.

---

## Cosa otterrai

1. Una pagina unica per vedere e modificare **tutti** i prompt del sistema (system, KB, operative, email, voice, playbooks, personas, profilo AI).
2. Per ogni blocco vedi a sinistra il testo attuale e a destra la versione migliorata dall'AI, con bottoni Accept/Discard.
3. Un agente chat in basso che migliora blocchi su richiesta naturale ("migliora il blocco golden rules").
4. Upload di file txt/json/csv per importare batch nuovi.
5. Export JSON di tutto come backup.
6. Tab Voice dedicato con coherence check tra persona interna e prompt ElevenLabs, con sync automatico.
7. Tutto auditato in `supervisor_audit_log`.

