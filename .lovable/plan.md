

## Analisi rapida

Verifico stato file e versioni correnti prima di confermare il piano.
<lov-tool-use id="toolu_vrtx_01MEdJDTQ4uMBVxggxREQYu7" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/manifest.json\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01WZKwgYqqS7mtr4sXRK2mc6" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/actions.js\", \"lines\": \"260-320\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01Y2Lno2NTEjmAmzkrRUK2dN" name="code--view" integration-id="code" data="{\"file_path\": \"public/whatsapp-extension/tab-manager.js\", \"lines\": \"70-110\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_01KQ3LedcK1uK7HC6ArAQ6zr" name="code--view" integration-id="code" data="{\"file_path\": \"public/linkedin-extension/actions.js\", \"lines\": \"380-450\"}">
</lov-tool-use>

<lov-tool-use id="toolu_vrtx_011ZfKhFH4D1C3R7nub9nHzs" name="code--search_files" integration-id="code" data="{\"query\": \"WHATSAPP_EXTENSION_REQUIRED_VERSION|LINKEDIN_EXTENSION_REQUIRED_VERSION\", \"include_patterns\": \"*.ts,*.tsx\"}">
</lov-tool-use>
Ho tutto quello che serve. Verifico solo che il manifest LinkedIn e WhatsApp e il ping background dichiarino le versioni che dovrò bumpare, e i catalog/ZIP physical paths.
<lov-tool-use id="toolu_vrtx_01SaXTAq5hG2LM2Ggi29E5uh" name="code--exec" integration-id="code" data="{\"command\": \"grep -rn \\\"5.7.0\\\\|3.6.0\\\" public/whatsapp-extension/manifest.json public/linkedin-extension/manifest.json public/whatsapp-extension/background.js 2>&1 | head -30; echo \\\"---\\\"; ls public/chrome-extensions/whatsapp/ public/chrome-extensions/linkedin/ 2>&1; echo \\\"---\\\"; find public -name \\\"extensions-catalog*.json\\\" 2>&1; echo \\\"---\\\"; grep -rn \\\"version\\\" src/lib/embeddedWhatsAppExtensionZip.ts | head -5\", \"user_facing_description\": \"Verifico versioni e cataloghi attuali\"}">
</lov-tool-use>
Ho tutto. Il LinkedIn background.js potrebbe avere ping con versione hardcoded — verifico.
<lov-tool-use id="toolu_vrtx_01YL96iTPPfHmv8ojLBanD9C" name="code--exec" integration-id="code" data="{\"command\": \"grep -n \\\"version\\\\|3.6.0\\\\|3.5.0\\\" public/linkedin-extension/background.js 2>&1 | head -20\", \"user_facing_description\": \"Cerco versione hardcoded nel background LI\"}">
</lov-tool-use>
Trovato anche l'inghippo LI: ping LinkedIn risponde sempre `3.4.0` hardcoded. Spiega anche perché il log utente diceva `v3.4.0` mentre il manifest era 3.6.0. Da bumpare insieme a M1-M7.

<lov-plan>

## Obiettivo

Applicare i 7 fix M1–M7 alle estensioni Chrome WhatsApp e LinkedIn per:
- M1 fermare l'apertura di 5+ tab LinkedIn (rischio ban)
- M2 deduplicare LI inbox e filtrare notification badge
- M3 ripristinare badge detection WA senza `data-testid` (DOM nuovo)
- M4/M5 sbloccare il rendering DOM dei tab background con attivazione breve non invasiva
- M6 allineare lo shim `withTemporarilyVisibleTab`
- M7 rinforzare i fallback strutturali per nome contatto e ultimo messaggio WA

In più sistemo due bug collaterali emersi dal codice:
- `public/linkedin-extension/background.js` riga 28 risponde al ping con `version: "3.4.0"` hardcoded → spiega perché il log utente vedeva sempre 3.4.0 anche con manifest 3.6.0. Va sincronizzato col manifest.
- I bump versione richiesti dal prompt M (WA 5.8.0 / LI 3.7.0) richiedono allineamento di manifest, ping background, ZIP versionati, alias root, embedded base64 WA, costanti TS e test.

## File toccati

Estensioni — codice runtime
1. `public/linkedin-extension/tab-manager.js` (M1, M5)
2. `public/linkedin-extension/actions.js` (M2)
3. `public/whatsapp-extension/tab-manager.js` (M4, M6)
4. `public/whatsapp-extension/actions.js` (M3, M7)

Versioning
5. `public/whatsapp-extension/manifest.json` → `5.8.0` + descrizione aggiornata
6. `public/whatsapp-extension/background.js` → `version: "5.8.0"` + log
7. `public/linkedin-extension/manifest.json` → `3.7.0` + descrizione
8. `public/linkedin-extension/background.js` → ping risponde `version: "3.7.0"` (oggi è `3.4.0` hardcoded, bug)

Pacchettizzazione
9. Generare `public/chrome-extensions/whatsapp/whatsapp-extension-5.8.0.zip`
10. Generare `public/chrome-extensions/linkedin/linkedin-extension-3.7.0.zip`
11. Aggiornare alias `public/whatsapp-extension.zip` e `public/linkedin-extension.zip`

Embedded fallback + costanti TS
12. `src/lib/embeddedWhatsAppExtensionZip.ts` rigenerato dal nuovo ZIP 5.8.0, `EMBEDDED_WHATSAPP_EXTENSION_ZIP_VERSION = "5.8.0"`
13. `src/lib/whatsappExtensionZip.ts`: `WHATSAPP_EXTENSION_REQUIRED_VERSION = "5.8.0"`, `LINKEDIN_EXTENSION_REQUIRED_VERSION = "3.7.0"`
14. `src/test/misc-modules.test.ts`: aggiornare assert a `5.8.0`

## Ordine di applicazione

Come da prompt: M1 → M4 → M5 → M6 → M3 → M7 → M2, poi bump versioni, poi rigenero ZIP, poi rigenero embedded base64, poi aggiorno costanti e test.

## Verifiche post-fix

- `grep` sulle stringhe sentinella richieste dal prompt (`M1: Service worker MV3`, `STEALTH MODE v2 (M4)`, `M3-S3: Badge numerica`, `isBadgeShaped`, `M3-S4`, `M2: dedup anche per nome`, `notifPattern`, `seenNames[nameKey]`, `M7: Priorità a selettori strutturali`, `STEALTH MODE v2 (M5)`).
- Estrazione `manifest.json` dai due nuovi ZIP per confermare `5.8.0` / `3.7.0`.
- Estrazione `manifest.json` dal nuovo embedded base64 WA per confermare `5.8.0`.
- Build TS verde (test `WHATSAPP_EXTENSION_REQUIRED_VERSION === "5.8.0"`).

## Note operative per l'utente dopo il deploy

Dovrai, in `chrome://extensions`:
1. Rimuovere (non solo disattivare) sia "WCA WhatsApp Bridge v5.7" sia "LinkedIn Cookie Sync 3.6.0/3.4.0".
2. Scaricare i nuovi ZIP dal pulsante in app (filename ora con hash di integrità).
3. Estrarli in due cartelle nuove vuote.
4. "Carica estensione non pacchettizzata" su entrambe.
5. Fare il ping: WA deve rispondere `5.8.0`, LI deve rispondere `3.7.0`.

