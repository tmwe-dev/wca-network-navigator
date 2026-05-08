## Problema

`Sync cookie li_at` torna `success:false / "Apri il Cockpit (lovable.app) per autorizzare le chiamate AI"`.

Due cause concorrenti:

1. **Estensione stale**: il ping risponde `v3.9.0`. La zip aggiornata `3.9.1` non è ancora installata sul tuo Chrome (il messaggio mostrato è quello vecchio, oggi nei sorgenti dice "Assicurati che il Cockpit sia aperto…").
2. **Bug architetturale**: `AiBridge.findWebappTab()` chiama `chrome.tabs.query({})` e filtra per `tab.url`. Dentro l'editor Lovable la webapp vive in un **iframe** (`id-preview--*.lovable.app`) il cui parent è `lovable.dev/projects/...`. `tabs.query` espone solo l'URL top-level → la webapp è lì ma non viene trovata. Stesso problema potenzialmente in qualunque host che embedda la preview.

Il content script invece **viene** iniettato nell'iframe (manifest ha `all_frames:true` + `match_origin_as_fallback:true`), quindi il bridge funziona — basta scoprirlo via frame, non via tab URL.

## Fix mirato

### A. `public/linkedin-extension/ai-bridge.js` — `findWebappTab` → `findWebappTarget`

Cambia la lookup per supportare iframe:

```text
1. Lista tutti i tab (no filtro URL).
2. Per ciascun tab → chrome.webNavigation.getAllFrames({tabId}).
3. Trova il primo frame con URL matchante lovable.app / lovableproject.com / localhost / 127.0.0.1.
4. Ritorna { tabId, frameId }.
5. Preferisci il tab attivo a parità di match.
```

Sostituisci la chiamata `chrome.tabs.sendMessage(tab.id, msg)` con `chrome.tabs.sendMessage(tabId, msg, { frameId })` così il messaggio arriva esattamente all'iframe giusto e non a content script estranei.

Aggiorna anche `manifest.json` aggiungendo `"webNavigation"` ai `permissions` (oggi non c'è).

### B. Messaggio errore più chiaro

Quando davvero nessun tab/iframe corrisponde, ritorna:
`"Nessuna scheda Cockpit trovata. Apri https://*.lovable.app o l'editor Lovable in un tab e riprova."` con `code: "NO_WEBAPP_TAB"`.

### C. Bump versione + ri-zip

- `public/linkedin-extension/manifest.json`: `3.9.1` → `3.9.2`.
- `public/linkedin-extension/background.js`: ping → `"3.9.2"`.
- Rigenera `public/linkedin-extension.zip`.
- Salva copia versionata in `public/chrome-extensions/linkedin/linkedin-extension-3.9.2.zip`.

### D. Allineamento WhatsApp (stesso bug)

`public/whatsapp-extension/ai-bridge.js` ha **identica** logica `findWebappTab`. Stesso fix lì, bump WA `5.10.0` → `5.10.1`, ri-zip. Senza questo, appena testerai sync WA dall'editor avrai lo stesso errore.

## QA dopo l'implementazione

Reinstalla entrambe le estensioni in `chrome://extensions` (Carica decompresso o Aggiorna), poi sul pannello Test:

1. **LinkedIn → Ping** → deve rispondere `v3.9.2`.
2. **LinkedIn → Sync Cookie** → atteso `success:true, saved:true`. Verifica in DB che `app_settings.linkedin_li_at` sia stato aggiornato (timestamp recente).
3. **WhatsApp → Ping** → `v5.10.1`. Sync analogo se applicabile.
4. **Sequenza completa LI** ping → session → cookie → autoLogin → inbox: nessun errore "NO_WEBAPP_TAB".

## NON in scope

- Nessuna modifica a `useLinkedInSync`, parser profilo, edge function `save-linkedin-cookie`, RLS o auth.
- Nessun refactor di `syncGuard` o `useAiExtractBridgeListener` (la logica lato webapp resta identica, il bridge consegna il messaggio nello stesso modo, solo a un frame invece che a un tab).
- Bug parser profilo "0 notifiche" e dropdown contatti senza URL → restano fuori (li hai esclusi).

## Rischio

Basso. La modifica è tutta dentro `ai-bridge.js`. Aggiungere `webNavigation` ai permission richiede reinstall esplicito ma è già scontato (stiamo bumpando la versione).
