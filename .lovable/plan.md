

## Piano: KB Supervisor — Interfaccia Vocale + Canvas Documenti

Riallineato all'architettura V2 reale (la pagina vive in `/v2/kb-supervisor`, non `/kb-supervisor`).

### File da creare

**Pagina V2** (`src/v2/ui/pages/`)
- `KBSupervisorPage.tsx` — split-panel `ResizablePanelGroup` 40/60, header + footer

**Hook** (`src/v2/ui/pages/kb-supervisor/hooks/`)
- `useKBSupervisorState.ts` — stato chat, voce, canvas, audit, approvazioni. Riusa `useVoiceInput` (`src/v2/ui/pages/command/hooks/useVoiceInput.ts`), `invokeEdge` (`src/lib/api/invokeEdge.ts`), `supabase` client. **Usa DAL** (`src/data/kbEntries.ts`) per load/update/delete invece di `supabase.from()` diretto (rispetta layer rules).

**Componenti** (`src/components/kb-supervisor/`)
- `KBSupervisorChat.tsx` — messaggi + input testo + bottoni microfono/audio (sonner per toast)
- `KBSupervisorCanvas.tsx` — Tabs `[Documenti | Documento | Modifiche | Audit]` con diff side-by-side e bottoni Approva/Rifiuta
- `KBSupervisorHeader.tsx` — toggle Guidato/Autonomo + status audio/audit
- `KBSupervisorFooter.tsx` — last audit, totale documenti, totale issues

### File da modificare

**`src/v2/routes.tsx`** — aggiungere lazy import + route protetta:
```tsx
const KBSupervisorPage = lazy(() => import("./ui/pages/KBSupervisorPage").then(m => ({ default: m.KBSupervisorPage })));
// dentro <Route element={<AuthenticatedLayout/>}>:
<Route path="kb-supervisor" element={guardedPage(KBSupervisorPage, "KBSupervisor")} />
```

**`src/v2/ui/templates/LayoutSidebarNav.tsx`** — nel gruppo `nav.group_ai_agents` aggiungere voce con icona `Brain` (lucide):
```tsx
{ labelKey: "nav.kb_supervisor", path: "/v2/kb-supervisor", icon: <Brain className="h-4 w-4" /> },
```
Più chiave i18n `nav.kb_supervisor` nei file di traduzione (it/en) se presenti — fallback al label hardcoded altrimenti.

**`supabase/functions/_shared/scopeConfigs.ts`** — al case `"kb-supervisor"` (riga 308) appendere al `systemPrompt`:
- formato `structured` con campi `action`, `document_id`, `audit_request`, `canvas_content`
- distinzione modalità `guidato` vs `autonomo`
- istruzione "rispondi sempre in italiano"

**`supabase/functions/unified-assistant/index.ts`** — verificare che il `result` ritorni il campo `structured` dal modello (parse JSON dal contenuto se l'AI lo restituisce inline tra delimitatori, oppure usare tool-calling). Estensione minima: catturare blocco ` ```json ... ``` ` dalla risposta e includerlo nel payload di ritorno se non già presente.

### Architettura chat → canvas

```text
User msg → useKBSupervisorState.sendMessage()
  → invokeEdge('unified-assistant', {scope:'kb-supervisor', messages, extra_context})
  → response.content (testo per chat) + response.structured (azione canvas)
  → if structured.action → setProposedChanges(pending) + setCanvasTab('diff')
  → if structured.document_id → load doc → setCanvasTab('document')
  → if structured.audit_request → invokeEdge('kb-supervisor', {audit_level:'all'})
  → speakResponse(content) via elevenlabs-tts (se voiceEnabled)
```

Approve flow: `approveChange()` → DAL `upsertKbEntry`/`deleteKbEntry` → `loadDocuments()` → toast → notifica AI con messaggio sistema.

### Modalità voce

- **STT**: `useVoiceInput` esistente con `lang: "it-IT"`, auto-submit dopo 2s di silenzio
- **TTS**: `supabase.functions.invoke('elevenlabs-tts')` con voice ID da `app_settings`, fallback `JBFqnCBsd6RMkjVDRZzb`
- Toggle audio ON/OFF nel header chat; stop automatico dell'audio quando disattivato

### Sicurezza & layer rules

- Tutte le query KB passano da `src/data/kbEntries.ts` (DAL), nessun `supabase.from('kb_entries')` diretto in hook/componenti
- Soft-delete: `deleteKbEntry` già rispetta il trigger globale (UPDATE `is_active=false` invece di DELETE fisico)
- Solo admin/operator possono accedere — la route eredita il `V2AuthGate` esistente
- Toast: **sonner** (non `useToast` legacy), coerente con resto V2

### Verifica finale

```bash
ls src/v2/ui/pages/KBSupervisorPage.tsx \
   src/v2/ui/pages/kb-supervisor/hooks/useKBSupervisorState.ts \
   src/components/kb-supervisor/{Chat,Canvas,Header,Footer}.tsx
grep "kb-supervisor" src/v2/routes.tsx src/v2/ui/templates/LayoutSidebarNav.tsx
grep -A3 "FORMATO RISPOSTA\|structured" supabase/functions/_shared/scopeConfigs.ts
```

### Note critiche

- **Niente `/kb-supervisor` root**: il prompt originale assumeva routing legacy V1. La rotta corretta è `/v2/kb-supervisor` dentro `AuthenticatedLayout`
- **DAL obbligatorio**: il prompt originale fa `supabase.from()` diretto nell'hook → riallineato a `src/data/kbEntries.ts`
- **No physical delete**: `delete` action → soft delete via `is_active=false`
- **i18n**: chiave `nav.kb_supervisor` da aggiungere ai locale files se esistenti
- **Edge function `kb-supervisor` e scope già esistono** dalla sessione precedente — solo arricchire il system prompt con il formato structured

