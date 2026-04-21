

# Completamento LOVABLE-71 — Tab restanti, Voice, Page shell, Routing

Continuo da dove eravamo: la base architetturale di Prompt Lab è pronta (DAL, types, hook, SplitBlockEditor, LabAgentChat, UploadButton, ExportButton, 3 tab + GenericRecordTab). Mancano i 4 tab generici, il tab Voice speciale, la page shell e il wiring rotta+nav.

---

## File da creare

```text
src/v2/ui/pages/prompt-lab/tabs/
  ├─ OperativePromptsTab.tsx       ← usa GenericRecordTab + DAL operativePrompts
  ├─ EmailPromptsTab.tsx           ← sub-tabs: Tipi, Global Prompts, Address Rules
  ├─ PlaybooksTab.tsx              ← usa GenericRecordTab + DAL commercialPlaybooks
  ├─ AgentPersonasTab.tsx          ← usa GenericRecordTab + DAL agentPersonas
  └─ VoiceElevenLabsTab.tsx        ← layout 3 colonne + coherence checker

src/v2/ui/pages/prompt-lab/hooks/
  └─ useVoiceCoherenceCheck.ts     ← confronta persona vs voice prompt

src/v2/ui/pages/PromptLabPage.tsx  ← shell con Tabs + ResizablePanelGroup verticale (chat in basso)
```

## File da modificare

- `src/v2/routes.tsx` — aggiunge rotta `/v2/prompt-lab` con lazy load + ErrorBoundary
- `src/v2/ui/templates/navConfig.tsx` — aggiunge voce "Prompt Lab" nella sezione Settings/Staff

**Nessuna migrazione DB. Nessuna nuova edge function.**

---

## Dettaglio per file

### Tab generici (Operative, Playbooks, Personas)

Usano `GenericRecordTab` già pronto. Per ogni record carico più blocchi (uno per campo). Esempio Playbooks:

```
loader = async () => {
  const list = await findCommercialPlaybooks(userId);
  return list.flatMap(p => [
    { id: `${p.id}::prompt_template`, label: `${p.name} — Prompt`, content: p.prompt_template ?? "", source: { kind: "playbook", id: p.id, field: "prompt_template" }, dirty: false },
    { id: `${p.id}::description`, label: `${p.name} — Descrizione`, content: p.description ?? "", source: { kind: "playbook", id: p.id, field: "description" }, dirty: false },
    { id: `${p.id}::trigger_conditions`, label: `${p.name} — Trigger (JSON)`, content: JSON.stringify(p.trigger_conditions ?? {}, null, 2), source: { kind: "playbook", id: p.id, field: "trigger_conditions" }, dirty: false },
  ]);
};

saver = async (block) => {
  if (block.source.kind !== "playbook") throw new Error("Source mismatch");
  const patch = block.source.field === "trigger_conditions"
    ? { trigger_conditions: JSON.parse(block.content) }
    : { [block.source.field]: block.content };
  await updateCommercialPlaybook(block.source.id, patch);
  return { table: "commercial_playbooks", id: block.source.id };
};
```

Stesso pattern per Operative (campi `objective`, `procedure`, `criteria`) e Personas (campi `custom_tone_prompt`, `signature_template`, `style_rules`, `vocabulary_do`, `vocabulary_dont`).

### EmailPromptsTab (sub-tabs interni)

Tre sotto-Tabs shadcn:
- **Tipi**: blocchi da `app_settings.email_oracle_types` (JSON) + `defaultEmailTypes.ts` come fallback. Save → `upsertAppSetting`.
- **Global**: blocchi da `findEmailPromptsByScope(userId, "global")`, save via `updateEmailPrompt`.
- **Address Rules**: blocchi da `findEmailAddressRules(userId)`, due campi per riga (`custom_prompt`, `notes`), save via `updateEmailAddressRule`.

### VoiceElevenLabsTab (layout 3 colonne)

```text
┌─────────────────┬──────────────┬────────────────────┐
│ PROMPT INTERNO  │ ALLINEAMENTO │ PROMPT ELEVENLABS  │
│ (agent_personas)│ Coerenza     │ (agents.system_pr.)│
│ tone, language, │ ✅/⚠️/❌      │ readonly + accept  │
│ style_rules,    │ tono/lingua/ │ button "Sync →"    │
│ vocabulary,     │ vocab        │ rigenera dx da sx  │
│ examples        │              │                    │
└─────────────────┴──────────────┴────────────────────┘
```

- **Sx**: select agente (dropdown) → carica persona da `findAgentPersonas` filtrata per `agent_id`. Mostra campi modificabili.
- **Centro**: `useVoiceCoherenceCheck` esegue heuristic locale (lingua = match exact su `language`; tono = keywords nel prompt; vocab = presenza dei termini do/dont). Restituisce 3 indicatori colorati.
- **Dx**: legge `agents.system_prompt` dell'agente selezionato (DAL `findAgents` esistente). Bottone "Sync →" chiama Lab Agent con prompt: "Genera prompt ElevenLabs naturale e conversazionale (no markdown, no bullet) coerente con questa persona: {personaJson}". Risultato in colonna dx con accept → `updateAgent` (DAL esistente, oppure `supabase.from('agents').update({system_prompt})`).

### PromptLabPage.tsx (shell)

```tsx
<ResizablePanelGroup direction="vertical">
  <ResizablePanel defaultSize={75} minSize={40}>
    <div className="flex flex-col h-full">
      <header className="border-b px-4 py-2 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-semibold">Prompt Lab</h1>
          <p className="text-xs text-muted-foreground">{activeTab.description}</p>
        </div>
        <div className="flex items-center gap-2">
          <UploadButton onBlocksUploaded={...} />
          <ExportButton getSnapshot={...} />
        </div>
      </header>
      <Tabs value={activeTabId} onValueChange={setActiveTabId} className="flex-1 flex flex-col">
        <TabsList className="rounded-none border-b">
          {PROMPT_LAB_TABS.map(t => <TabsTrigger key={t.id} value={t.id}>{t.label}</TabsTrigger>)}
        </TabsList>
        <div className="flex-1 overflow-auto p-4">
          {activeTabId === "system_prompt" && <SystemPromptTab />}
          {activeTabId === "kb_doctrine" && <KBDoctrineTab />}
          {activeTabId === "operative" && <OperativePromptsTab />}
          {activeTabId === "email" && <EmailPromptsTab />}
          {activeTabId === "voice" && <VoiceElevenLabsTab />}
          {activeTabId === "playbooks" && <PlaybooksTab />}
          {activeTabId === "personas" && <AgentPersonasTab />}
          {activeTabId === "ai_profile" && <AIProfileTab />}
        </div>
      </Tabs>
    </div>
  </ResizablePanel>
  <ResizableHandle />
  <ResizablePanel defaultSize={25} minSize={10} maxSize={50}>
    <LabAgentChat ... />
  </ResizablePanel>
</ResizablePanelGroup>
```

`UploadButton`/`ExportButton` ricevono callback che operano sul tab attivo. Il chat ha `onSend` che usa `useLabAgent.sendChatMessage` con context dei blocchi del tab attivo. Quando il chat ritorna `{ targetBlockId, improvedText }`, popola `improved` del blocco corrispondente.

### Routing

`src/v2/routes.tsx`:
```ts
const PromptLabPage = lazy(() => import("./ui/pages/PromptLabPage").then(m => ({ default: m.PromptLabPage })));
// ...
{ path: "prompt-lab", element: <ErrorBoundary><Suspense fallback={<Loader />}><PromptLabPage /></Suspense></ErrorBoundary> }
```

`src/v2/ui/templates/navConfig.tsx`: aggiungo voce nella sezione "Staff" o "Settings" con label "Prompt Lab" e icona `FlaskConical` da lucide-react, route `/v2/prompt-lab`.

---

## Considerazioni tecniche

- **Type safety**: tutto tipizzato, niente `any`. JSON parse di `trigger_conditions` con try/catch e toast errore se invalido.
- **Layer rules**: tutti i tab usano DAL esistenti (creati nel batch precedente). Nessun `supabase.from()` diretto in UI tranne per tabelle non ancora coperte da DAL (`agents` per voice, ma esiste già `src/data/agents.ts`).
- **RLS**: `agent_personas` è user-scoped (esiste policy); `commercial_playbooks` user-scoped; `email_address_rules` user-scoped.
- **Audit**: ogni save chiama `logSupervisorAudit` (già pronto).
- **Performance**: tab caricati solo quando attivi (render condizionale). Nessuna query KB pesante in background.
- **Memoria**: rispetta vincoli "DAL access only", "no any", "soft-delete globale" (gli update non distruggono record).

---

## Cosa otterrai dopo questo step

1. Pagina `/v2/prompt-lab` accessibile dalla sidebar V2.
2. 8 tab funzionanti con split editor sinistra/destra.
3. Voice tab con coherence checker e sync persona → ElevenLabs.
4. Lab Agent in basso che migliora blocchi su comando naturale.
5. Upload/Export/Save/Accept tutti operativi.
6. Audit log su ogni modifica salvata.

