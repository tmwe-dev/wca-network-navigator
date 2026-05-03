## Verifica: Email Forge è il sistema corretto ✅

Confermato leggendo il codice:

| Aspetto | Email Forge (`/v2/email-forge`) | Cockpit (`/v2/cockpit`) | Composer (`/v2/communicate/compose`) |
|---|---|---|---|
| Hook AI | `useEmailForge` → edge `generate-email` | `useOutreachGenerator` → `generate-content?action=outreach` | `useEmailComposerState` → `generate-email` |
| Tipo email (oracle_type) | ✅ propagato | ❌ **non propagato** | ✅ propagato |
| Tono / KB / brief / quality | ✅ tutti propagati | ❌ **non propagati** (hardcoded) | ✅ tutti |
| `journalist_review` esposto | ✅ in `ForgeResult` | ❌ **non esiste** in `OutreachResult` | parziale |
| `type_resolution` (Detector) | ✅ | ❌ | ❌ |
| `_context_summary` (KB usate, history) | ✅ | ❌ | parziale |
| Badge "chi ha lavorato" | ✅ `ContextSummary` | ❌ niente | ❌ niente |
| Pannello config laterale | ✅ via `ContextFiltersRail` + `EmailComposeFiltersSection` (montato per `/v2/communicate/compose`) | ❌ non montato | ✅ |
| Bulk N contatti | N/A (singolo) | ❌ **prende solo `ids[0]`** → 1 sola email per N contatti | N/A |

→ **Email Forge è la pipeline canonica.** Cockpit e gli altri moduli devono allinearsi.

---

## Piano: unificazione su Email Forge

### Obiettivo
Un unico motore (`useEmailForge` + edge `generate-email`), un unico pannello config (linguetta laterale `ContextFiltersRail` con `EmailComposeFiltersSection` + `ComposeAiConfigContext`), un unico set di badge (`ContextSummary` di `email-forge/components`).

### Step 1 — Estendi il pannello laterale ai moduli email
File: `src/v2/ui/templates/ContextFiltersRail.tsx` (`getFilterContext`).

Aggiungere route mapping per:
- `/v2/cockpit` → `EmailComposeFiltersSection` (banner key `email-compose`)
- `/v2/email-forge` → `EmailComposeFiltersSection` (sostituisce/integra il drawer "Filtri globali" del header)
- (eventuali future pagine email)

Tutti useranno lo **stesso** `ComposeAiConfigContext` → tipo email, tono, brief, useKB, customGoal sono globali per la sessione utente.

### Step 2 — Wrap globale con `ComposeAiConfigProvider`
File: `src/App.tsx` (o layout authenticated).

Spostare il provider dal solo `EmailComposerPage` a un livello sopra (layout autenticato) così Cockpit/Forge/Composer **leggono lo stesso stato** dal pannello laterale.

### Step 3 — Cockpit usa `useEmailForge` + supporta bulk reale
File: `src/hooks/useCockpitLogic.ts` (`handleDrop`).

Sostituire `useOutreachGenerator.generate(...)` con un loop che usa `useEmailForge.run(...)`:

```ts
const cfg = useComposeAiConfig();        // tipo, tono, brief, useKB, goal
const lab = useForgeLab();               // quality (Scout/Detective/Sherlock)
const forge = useEmailForge();

const ids = getDraggedIds();
for (const id of ids) {                  // ❗ TUTTI gli id, non solo ids[0]
  if (signal.aborted) break;
  const c = contactsMap[id]; if (!c) continue;
  const result = await forge.run({
    partner_id: c.partnerId,
    contact_id: c.sourceType === "contact" ? c.sourceId : null,
    recipient_name: c.name,
    recipient_company: c.company,
    recipient_countries: c.country,
    oracle_type: cfg.selectedType?.id,
    oracle_tone: cfg.tone,
    use_kb: cfg.useKB,
    goal: [cfg.customGoal, cfg.selectedType?.prompt].filter(Boolean).join("\n\n"),
    base_proposal: serializeBrief(cfg.brief),
    quality: lab.quality,                // → Scout/Detective/Sherlock
    email_type_prompt: cfg.selectedType?.prompt ?? null,
    email_type_structure: cfg.selectedType?.structure ?? null,
    email_type_kb_categories: cfg.selectedType?.kb_categories,
  });
  if (signal.aborted) break;
  pushDraftToQueue(id, result);          // accumula i draft per ciascun contatto
}
```

Mantenere intatto: `autoAssign`, branch LinkedIn lookup, abort, `mountedRef`, side-effect su `partners.enrichment_data`.

Per visualizzare i N draft generati: una lista verticale di mini-card draft (uno per contatto) nel pannello destro, con il primo già aperto in `AIDraftStudio`.

### Step 4 — Badge unificati ovunque
Componente: `src/v2/ui/pages/email-forge/components/ContextSummary.tsx` (esistente).

Montarlo dentro:
- `AIDraftStudio.tsx` (Cockpit) — sotto subject/body
- `EmailComposerPage` ResultPanel — già parziale
- ovunque ci sia un risultato di `generate-email`

Badge mostrati (già presenti nel componente):
- 🕵️ Detector tipo email + confidence
- 🔍 Livello Deep Search (Scout/Detective/Sherlock) ← `SherlockLevelBadge` esistente
- 📚 KB sezioni usate
- 🧠 Memorie / interaction history
- 📰 Editorial Review (giornalista + verdict + score + warnings)
- ⚠️ Contract warnings

### Step 5 — Deprecazione soft di `useOutreachGenerator`
- Marcare il file `@deprecated — use useEmailForge`.
- Rimuovere le call site Cockpit (Step 3).
- Le altre call site (LinkedIn flow, command tools) seguono in PR successive — fuori scope di questa.

### Step 6 — Header Email Forge
Sostituire il pulsante "Filtri globali" del header EmailForge con il toggle del nuovo pannello laterale (lo `ContextFiltersRail` lo gestisce già). Coerenza visiva con tutti gli altri moduli.

---

## Vincoli rispettati
- ✅ Editorial review (`journalistReview`) resta in `generate-email` (mai bypassato, mai duplicato).
- ✅ AI Invocation Charter: `useEmailForge` passa da `invokeEdge`/`invokeAi` con scope corretto (già conforme).
- ✅ DAL access only: nessuna `supabase.from()` aggiunta nei componenti UI.
- ✅ V2 logic-less UI: tutta la logica in hooks (`useCockpitLogic`, `useEmailForge`).
- ✅ Soft-delete, abort, mountedRef preservati.
- ✅ Nessun refactor opportunistico fuori scope.

## File toccati (riepilogo)
1. `src/v2/ui/templates/ContextFiltersRail.tsx` — aggiungi mapping route
2. `src/App.tsx` (o layout) — sposta `ComposeAiConfigProvider` a livello globale
3. `src/hooks/useCockpitLogic.ts` — bulk loop + `useEmailForge` + lettura config
4. `src/components/cockpit/AIDraftStudio.tsx` — monta `ContextSummary`
5. `src/v2/ui/pages/EmailForgePage.tsx` — pulsante header → toggle rail laterale
6. `src/hooks/useOutreachGenerator.ts` — `@deprecated`

## Note
- `useEmailForge` deve poter essere usato in loop: oggi imposta `result` singolo. Aggiungerò una variante `runMany(params[])` che restituisce array, oppure consumo i risultati progressivamente. Decidere in implementazione (no impatto API esterna).
- I contatti con email mancante: skip con warning nel toast finale (`X/N completate, Y senza email, Z errori`).
- `serializeBrief(brief)` esiste già lato Composer; riusare lo stesso helper.

Procedo con l'implementazione in questo ordine: 1 → 2 → 3 (con runMany) → 4 → 5 → 6.