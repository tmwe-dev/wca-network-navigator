## Piano definitivo: fix sistemico typing edge functions

### Diagnosi
Tutti gli errori derivano da **una sola causa**: `createClient()` chiamato senza il generic `<any>`. Senza generic, la libreria infera `data: never[]`, e ogni `.from().select()` propaga `never` fino a tutti i moduli che ricevono il client come parametro. Patchare file per file è un buco senza fondo perché ogni nuovo cast introduce mismatch a catena.

### Fix sistemica (1 modulo nuovo + sostituzione globale)

**STEP 1 — Crea `supabase/functions/_shared/supabaseClient.ts`** (nuovo file):
```ts
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
// deno-lint-ignore no-explicit-any
export type AnySupabaseClient = ReturnType<typeof createClient<any>>;

export function createServiceClient(): AnySupabaseClient {
  return createClient<any>(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}
```

**STEP 2 — Sostituisci in TUTTI i file con `ReturnType<typeof createClient>` o varianti** (~30 file):
- Rimpiazza ogni `type SupabaseClient = ReturnType<typeof createClient>` (e alias come `AgentExecuteSupabaseClient = any`) con import di `AnySupabaseClient` da `_shared/supabaseClient.ts`.
- Nessun cast `as Row[]`, nessun `Record<string, unknown>`, nessuna riga di logica toccata.
- `createClient<any>(...)` fa sì che `.from().select()` ritorni `any`, eliminando in cascata tutti i `TS2339`, `TS18046`, `TS2538`, `TS7053`, `TS2345`.

**STEP 3 — Fix puntuali in `ai-assistant/index.ts`** (errori indipendenti dal client):
1. `getClaims(token)` → non esiste → `auth.getUser(token)` e leggi `data.user.id`.
2. `endMetrics(metrics, 200)` → manca arg `success` → `endMetrics(metrics, true, 200)` (5 occorrenze).
3. `(...).catch(() => {})` su `PromiseLike` → wrappa con `Promise.resolve(...).catch(() => {})`.
4. `initialResult`/`fallbackResult` → tipa come `any` per accesso a `.choices[0].message`.
5. `TOOL_DEFINITIONS` → cast `as unknown as Record<string, unknown>[]` nelle 2 chiamate.
6. `finalMessage`/`responseContent` → cast `as string`.
7. `loopResult.state.assistantMessage` → guard prima di `push`.

**STEP 4 — Revert dei cast inutili introdotti nei tentativi precedenti**:
In questi file rimuovo i `Record<string, unknown>`, `as Row[]`, `as never`, non-null assertion superflui aggiunti nei giri scorsi. Ridiventano inutili perché il client ora ritorna `any`:
- `_shared/toolHandlersRead.ts`
- `_shared/toolHandlersEnterprise.ts`
- `_shared/scopeConfigs.ts`
- `_shared/platformTools/partnersSearchHandler.ts`
- `ai-assistant/contextAssembly.ts`
- `ai-assistant/contextLoaders.ts`
- `ai-assistant/memoryContextLoader.ts`
- `ai-assistant/emailContextLoader.ts`
- `ai-assistant/kbContextLoader.ts`
- `ai-assistant/aiProviderResolver.ts`
- `ai-assistant/toolExecutors.ts`
- `agent-execute/shared.ts`, `chatMode.ts`, `systemPrompt.ts`, `taskMode.ts`, `index.ts`, `toolHandlers/*.ts`

Mantengo solo le correzioni di **logica reale** già fatte (es. `partnersUpdateHandler.ts` che usa `!statusResult.applied` invece dell'inesistente `.error`).

### Risultato atteso
- ~150 errori TS chiusi in un colpo solo.
- Zero modifiche di logica funzionale.
- Nessuna nuova fragilità: `any` qui è esplicitamente accettato perché Deno non ha i tipi `Database` generati per le edge functions.
- Build verde, edge functions deployabili.

### Perché funziona
`createClient<any>()` istruisce il SDK Supabase a trattare lo schema come `any`, quindi:
- `.from("table").select()` → `data: any[]` (non più `never[]`)
- `.rpc("fn", args)` → `data: any` (non più richiede 0 args)
- Property access su risultati DB → permesso
- I cast manuali aggiunti nei giri precedenti diventano rumore da rimuovere

### Stima file toccati
- **Nuovo**: 1 file (`_shared/supabaseClient.ts`)
- **Sostituzione typing**: ~30 file (1-2 righe meccaniche ciascuno)
- **Fix puntuali**: 1 file (`ai-assistant/index.ts`, 7 micro-edit)
- **Pulizia cast**: ~15 file

Approvi e procedo end-to-end senza ulteriori conferme.