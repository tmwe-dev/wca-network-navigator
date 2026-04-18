

## Analisi rapida

L'utente propone una riarchitettura completa del sistema di estrazione DOM (Optimus V2). Verifico lo stato attuale dei file chiave per dimensionare correttamente l'intervento.
<lov-tool-use id="toolu_vrtx_01GVCTe4h7WjrtB1JoPr5PdC" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"public/whatsapp-extension\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Nhdf3D1diZCovSzT3oEP2b" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"public/linkedin-extension\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01AJFrWt7GCZHBsTsZQNfSU7" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/whatsapp-ai-extract\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01R38sNFFwKbZedSqgkdsmqj" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"public/whatsapp-extension\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_017u96MoUpkgPgnK4XUN39ui" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"public/linkedin-extension\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011Rbx8qY9dRopMn2pcJNKDg" name="code--list_dir" integration-id="code" data="{\"dir_path\": \"supabase/functions/whatsapp-ai-extract\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01EJukpLxzkmZ5GxgQ8ptYfy" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/ai-extract.js\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01SXPzbd8E4FExbZc41ZqdYH" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/config.js\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01E7gRjBYUStAjo8KeesXy4d" name="code--view" integration-id="code" data="{\"file_path\": \"supabase/functions/whatsapp-ai-extract/index.ts\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Qicvgh8i3XtU1RKbgi3ueZ" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/actions.js\", \"lines\": \"1-80\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KfYBWbbH2kbAsSgtZGN3kG" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/tab-manager.js\"}">
</lov-tool-use>
Ho abbastanza contesto. Le modifiche sono ampie ma chirurgiche su file esistenti. Presento il piano.

<lov-plan>

## Optimus V2 — Piano di ricostruzione

### Obiettivo
Sostituire l'attuale flusso "Optimus bridge → legacy fallback → patch" con un flusso unico **Stabilize → UnifiedExtract → AI Relearn (in-context validation)**, applicato sia a WhatsApp che a LinkedIn. Direct-first sulle edge function, bridge come bonus opzionale.

### Cambi per file

**WhatsApp**
1. `public/whatsapp-extension/tab-manager.js`
   - Aggiungere `activateAndStabilize(tabId, maxWaitMs)` che salva il tab attivo precedente, attiva il tab WA, attende DOM stabile (readyState complete + visibilityState visible + presenza `[role="row"]`/`#pane-side`/`[role="grid"]` + assenza loading screen), e ritorna una `restore()` per ripristinare il tab originale.
   - Mantenere come deprecato `ensureTabVisibleAndWait` e `withTemporarilyVisibleTab` per backward compat.
2. `public/whatsapp-extension/actions.js`
   - Riscrivere `readUnreadMessages()` con il flusso V2: stabilize → unified extract → relearn (se 0 contatti) → restore.
   - Nuova `_pageUnifiedExtract()` con multi-strategia + scoring per: chat items, contactName, lastMessage, timestamp, unreadBadge (6 strategie ordinate per score). Output include `itemsTotal`, `itemsWithContact`, `itemsWithUnread`, `strategy`, `scores`, `diagnosticInfo`.
   - Nuova `aiRelearnAndExtract(tabId, diagnosticInfo)` che cattura rich snapshot, chiama AI direct-first, valida in-context, cache solo selettori validati con TTL 12h.
   - Nuova `_pageValidateAndExtract(selectors)` iniettata che testa ogni selettore AI sul DOM vivo e usa solo quelli con match > 0, con fallback strutturali multi-segnale.
3. `public/whatsapp-extension/ai-extract.js`
   - Invertire ordine: `callAiExtract` prima fetch diretto, poi bridge come fallback.
   - Riscrivere `learnDomSelectors` con il **rich snapshot** (ancestors 3 livelli, prev/next sibling, span con dimensioni/colore/border-radius del parent, attributi stabili di tutti gli elementi figli, sample outerHTML completo fino a 3000 char).
4. `public/whatsapp-extension/optimus-client.js`
   - Marcare `getPlan/executePlanInTab/handlePlanResponse` come deprecati (no-op preservati per backward compat). Mantenere `simplifyDom` e `computeHash` come utility.

**LinkedIn (stesso pattern)**
5. `public/linkedin-extension/tab-manager.js` — `activateAndStabilize` analogo (ricerca tab esistenti già presente da M1).
6. `public/linkedin-extension/actions.js` — Unified extract con scoring, dedup per nome + URL, filtro notification badge (già presente da M2, da estendere a multi-segnale).
7. `public/linkedin-extension/ai-learn.js` — direct-first, bridge fallback.
8. `public/linkedin-extension/optimus-client.js` — deprecazione path bridge.

**Edge function**
9. `supabase/functions/whatsapp-ai-extract/index.ts`
   - Aggiornare prompt `learnDom` per gestire il nuovo snapshot ricco e accettare un campo opzionale `failedSelectors` con feedback ("non rigenerare gli stessi").

**Versioning + ZIP**
10. WA → `5.9.0`, LI → `3.8.0` in: manifest, background ping, `WHATSAPP_EXTENSION_REQUIRED_VERSION`/`LINKEDIN_EXTENSION_REQUIRED_VERSION`, embedded base64 WA, test, ZIP fisici (`/public/chrome-extensions/...` e alias root), catalog.json.

### Ordine di applicazione
N1 Tab stability (WA+LI) → N2 Direct-first AI → N3 Unified extract WA → N4 AI relearn + validate → N5 Edge function prompt → N6 Unified extract LI → N7 Deprecate bridge path → N8 Bump + regen ZIP.

### Verifiche post-fix
- `grep` sentinelle: `activateAndStabilize`, `unifiedExtract`, `_pageValidateAndExtract`, `aiRelearnAndExtract`, `optimus_v2_plan`, `direct-first`.
- Nessun `chrome.windows.update({focused:true})` introdotto.
- Estrazione manifest dai nuovi ZIP → `5.9.0`/`3.8.0`.
- TS build verde su `WHATSAPP_EXTENSION_REQUIRED_VERSION === "5.9.0"`.
- Test manuale: ping risponde nuova versione, `readUnread` ritorna `meta.itemsWithContact > 0` su sidebar reale, log mostra `method: "unified-v2"` (cache hit) o `method: "ai-relearn-v2"` (relearn).

### Note operative per te dopo deploy
1. `chrome://extensions` → **Rimuovi** WA 5.8 e LI 3.7.
2. Scarica i nuovi ZIP.
3. Estrai in cartelle vuote nuove e "Carica estensione non pacchettizzata".
4. Verifica ping: WA `5.9.0`, LI `3.8.0`.

### Fuori scope
- Niente refactor dei moduli `discovery.js`, `auth.js`, `ax-tree.js`, `hybrid-ops.js` (restano invariati).
- Niente modifiche all'UI cockpit/test page se non aggiornamento stringhe versione.
- L'unfocus della finestra Cockpit resta garantito: solo `chrome.tabs.update({active})`, mai `chrome.windows.update({focused:true})`.

