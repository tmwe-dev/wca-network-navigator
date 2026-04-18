

# PROMPT-REPAIR-I — Optimus Auto-Learn (WhatsApp + LinkedIn)

## Stato attuale (verifica reale del codice)

WhatsApp (I1-I6): **già implementati** nel ciclo precedente (v5.6.0). Verificherò solo che siano davvero presenti come da spec, e applicherò ritocchi se manca qualcosa.

LinkedIn (I7-I9): **da fare ora**. Il modulo `ai-learn.js` esiste già con cache 3h e snapshot DOM, ma `actions.js` non lo invoca mai nel flusso Optimus, e `ai-learn.js` muore se manca `AiBridge`.

## Cosa farò

### Parte 1 — Verifica WhatsApp (I1-I6)
Apro `public/whatsapp-extension/actions.js`, `ai-extract.js` e `supabase/functions/whatsapp-ai-extract/index.ts` per confermare che il ciclo precedente abbia davvero applicato I1-I6. Se trovo gap, li chiudo. Niente bump di versione se è già tutto a posto.

### Parte 2 — LinkedIn auto-relearn (I7-I9)

**I7 — `public/linkedin-extension/actions.js`**
- In `tryOptimusInbox`: quando `getPlan` fallisce, chiamo `AILearn.learnFromAI(tabId, "messaging", url, key)`, converto lo schema con `convertLinkedInSchemaToOptimusPlan(..., "messaging")` e ritento `Optimus.executePlanInTab`.
- In `tryOptimusThread`: stessa logica con `pageType: "thread"`.
- Rimuovo la condizione `&& optimus.cached` sul ramo "0 items" così il relearn parte sempre quando l'inbox torna vuota.

**I8 — `public/linkedin-extension/actions.js`**
- Aggiungo `convertLinkedInSchemaToOptimusPlan(schema, pageType)` con due key map (messaging vs thread) e helper `buildPlanFromKeyMap` condiviso. Ritorna `null` se mancano i campi minimi (`container` + `contact_name`/`sender_name`).

**I9 — `public/linkedin-extension/ai-learn.js`**
- In `learnFromAI`: provo prima `AiBridge.aiExtractRequest` se disponibile; se fallisce o `AiBridge` è undefined, faccio fetch diretto a `whatsapp-ai-extract` (edge function condivisa, già abilitata a `channel: "linkedin"` + `pageType`).
- Garantisco reset di `_learning` su tutti i percorsi di errore.

### Parte 3 — Packaging e versioning
- Bump `public/linkedin-extension/manifest.json` a **3.5.0**.
- Aggiorno `DEFAULT_EXTENSION_CATALOG` in `src/lib/whatsappExtensionZip.ts` e `public/chrome-extensions/catalog.json` con LinkedIn `3.5.0` (corrente) e archivio `3.4.0`.
- Rigenero `public/chrome-extensions/linkedin/linkedin-extension-3.5.0.zip` e l'alias root `public/linkedin-extension.zip` direttamente da `public/linkedin-extension/`.
- Verifica finale: lettura del `manifest.json` dentro lo zip per confermare `3.5.0`.

### Parte 4 — Test
- Aggiorno eventuali test che referenziano la versione LinkedIn corrente.
- Eseguo `vitest` per non lasciare regressioni.

## File coinvolti

- `public/linkedin-extension/actions.js` (I7 + I8)
- `public/linkedin-extension/ai-learn.js` (I9)
- `public/linkedin-extension/manifest.json` (bump 3.5.0)
- `public/whatsapp-extension/actions.js`, `ai-extract.js` (solo se la verifica trova gap su I1-I6)
- `supabase/functions/whatsapp-ai-extract/index.ts` (verifica I6, ritocco se serve sul ramo `channel: "linkedin"`)
- `src/lib/whatsappExtensionZip.ts`
- `public/chrome-extensions/catalog.json`
- `public/chrome-extensions/linkedin/linkedin-extension-3.5.0.zip` (nuovo)
- `public/linkedin-extension.zip` (rigenerato)
- `src/test/misc-modules.test.ts` se referenzia LinkedIn 3.4.0

## Risultato atteso

Quando clicchi "Leggi" su LinkedIn:
1. Optimus prova il piano cached / via bridge.
2. Se fallisce → `AILearn.learnFromAI` parte automaticamente (anche senza tab webapp aperto, grazie al fallback diretto).
3. Lo schema appreso viene convertito nel formato che `Optimus.executePlanInTab` capisce.
4. Retry → estrazione messaggi, niente più "0 estratti, serve intervento".
5. Tutto in background, niente nuove finestre, coerente con la regola stealth-sync.

