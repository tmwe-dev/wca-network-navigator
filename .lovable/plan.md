

## Piano: AI Architettura Parte 1 — Tool Filtering + Partner Isolation

Tutti i bug confermati sui file reali. Il piano richiede **un riallineamento chirurgico** rispetto al prompt originale per via dell'architettura singleton di `writeH`.

### Fix #1 — Tool filtering per scope in `ai-assistant/index.ts`

**Riga 19** → aggiungere import:
```ts
import { getScopeConfig } from "../_shared/scopeConfigs.ts";
```

**Riga 512** → sostituire l'assegnazione monolitica di `activeTools` con la logica scope-aware proposta:
- `partner_hub` (default) e scope sconosciuti → tutti i 60 tool (comportamento attuale preservato)
- `cockpit` / `extension` → `PLATFORM_TOOLS` (sottoinsieme curato)
- `contacts` / `import` → `PLATFORM_TOOLS` + tool extra dedicati
- `strategic` → 0 tool (modalità consulenza pura)

Log diagnostico: `[AI] Scope "X" → N tools`.

### Fix #2 — Modello scope-specific (`strategic` → `gemini-2.5-flash`)

**Riga 513-517** → introdurre `scopeModel` letto da `getScopeConfig(scope).model` e premettilo alla cascade dei fallback (solo se non si usa user-key e lo scope ne definisce uno). Solo `strategic` ha attualmente un model override; altri scope continuano col `provider.model` standard.

### Fix #3 — User isolation su `update_partner` e `bulk_update_partners`

**Riallineamento necessario**: il prompt originale assume che `userId` sia disponibile nella closure di `createWriteHandlers`. **Non lo è**: la factory è chiamata una sola volta a livello modulo (riga 44 di `index.ts`) come singleton condiviso. Soluzione corretta — passare `userId` come parametro alle 2 funzioni vulnerabili (stesso pattern già usato per `executeCreateReminder`, `executeDeleteRecords`, `executeSendEmail`).

**Modifiche in `_shared/toolHandlersWrite.ts`:**

1. **Riga 25** — firma `executeUpdatePartner(args: Record<string, unknown>, userId: string)`
2. **Riga 36** — query update:
   ```ts
   .from("partners").update(updates).eq("user_id", userId).eq("id", partner.id)
   ```
3. **Riga 91** — firma `executeBulkUpdatePartners(args: Record<string, unknown>, userId: string)`
4. **Riga 98** — countQuery: aggiungere `.eq("user_id", userId)` prima di `.in("id", ...)` o `.eq("country_code", ...)` (per non dare conferme su partner di altri utenti)
5. **Riga 105** — updateQuery: aggiungere `.eq("user_id", userId)` prima dei filtri

**Modifiche in `ai-assistant/toolExecutors.ts`:**

6. **Righe 261, 264** — spostare `update_partner` e `bulk_update_partners` dal `writeMap` (no auth) al `writeAuthMap` (richiede userId), oppure passare `userId!` direttamente:
   ```ts
   update_partner: () => writeH.executeUpdatePartner(args, userId!),
   bulk_update_partners: () => writeH.executeBulkUpdatePartners(args, userId!),
   ```
   E aggiungere il guard `if (!userId) return { error: "Auth required" }` per queste righe (oppure spostarle nel `writeAuthMap` esistente che già fa il check a riga 285).

**Scelta**: spostarle in `writeAuthMap` (più pulito, riusa il check `userId` esistente).

7. **Riga 14** — aggiornare l'interfaccia `WriteHandlers` solo se TypeScript stretto si lamenta delle nuove firme; usa `Function` generico quindi probabilmente non serve modifica.

### Fix #4 — Break euristico nel tool loop

**Riga 558** → introdurre `lastToolSignature` + `repeatedToolCount` prima del `while`. Detection: stessa stringa `name:args` ripetuta 2 volte consecutive → break con warning. Limite hard `iterations < 8` resta invariato.

### File modificati (3)

1. `supabase/functions/ai-assistant/index.ts` — import + tool filter + scope model + repetition break
2. `supabase/functions/_shared/toolHandlersWrite.ts` — aggiunta param `userId` su 2 funzioni + guard `.eq("user_id", userId)` sulle 3 query partner
3. `supabase/functions/ai-assistant/toolExecutors.ts` — spostare 2 entry da `writeMap` a `writeAuthMap` con `userId!`

### Verifica post-fix

```bash
grep "getScopeConfig" supabase/functions/ai-assistant/index.ts
grep "scopeModel\|scopeConfig" supabase/functions/ai-assistant/index.ts
grep -A1 'from("partners").update' supabase/functions/_shared/toolHandlersWrite.ts | grep "user_id"
grep "repeatedToolCount\|lastToolSignature" supabase/functions/ai-assistant/index.ts
npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

### Note critiche

- **Backward compat**: `partner_hub` (scope di default usato da `useGlobalChat`) continua a ricevere tutti i 60 tool — zero regressione funzionale per la chat principale.
- **Sicurezza**: Le RLS sulle policy `partners` esistono già, ma proteggono solo `service_role`-bypass parziale; aggiungere `.eq("user_id", userId)` lato applicazione è **defense-in-depth**, non sostituzione delle RLS.
- **Strategic = 0 tool**: corretto da design. Se un giorno servisse search_kb in modalità strategica, basterà aggiungerlo a `tools: []` in scopeConfigs.
- **Non tocchiamo `executeAddPartnerNote`, `executeUpdateActivity`, ecc.**: il prompt richiede solo i 2 endpoint partner — gli altri usano già `partner_id` risolto da `resolvePartnerId` o operano su entità con RLS solide. Estensioni successive in fase separata se necessario.

