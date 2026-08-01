---
name: FireScrape Consent Auto-Accept
description: Estensione Partner Connect 3.4.5 — autoAcceptConsent() chiamato in BackgroundTab.navigate, handleScrape, withTab, handleCrawlStart, handleMap. Selettori CMP + fallback testuale multilingua con scoring, blocklist (reject/manage/subscribe/login/save choices), retry x3 con re-render, shadow DOM, allFrames:true.
type: feature
---
Senza auto-accept lo scraper restituiva solo il testo del banner: il contenuto reale era gated da overflow:hidden sul body o non renderizzato finché non davi consenso.

**Punto critico fix 2026-05-15:** prima il gate era SOLO in `withTab()`, ma il Deep Search Sherlock usa il flusso `fs.readUrl → navigateBackground → BackgroundTab.navigate → handleScrape`, che NON passa da withTab. Quindi i popup non venivano mai chiusi nel percorso reale. Ora il gate è in `BackgroundTab.navigate` (subito dopo waitForTabLoad) E in `handleScrape` come rete di sicurezza.

**Cascata:**
1. Selettori noti CMP (id/class deterministici): OneTrust, Cookiebot, Didomi, Iubenda, Quantcast, CookieYes, Usercentrics, Termly, Complianz, Axeptio, TrustArc, HubSpot, Funding Choices.
2. Fallback testuale con SCORING: scan light DOM + shadow DOM aperti, regex multilingua, +10 se contiene "all/tutti/tutto/tout/alle", +8 se contiene "accept/accetta/aceptar".
3. BLOCKLIST hard: reject/decline/deny, manage/preferences/settings, subscribe/login/buy/checkout, save choices/salva preferenze. Mai cliccati anche se matchano altri pattern.
4. Retry x3 con sleep 400ms (alcuni banner appaiono dopo il primo render).
5. Reset overflow + rimozione classi modal-open/no-scroll DOPO l'eventuale click (non prima: alcuni CMP usano overflow:hidden per renderizzarsi).
6. Settle 900ms post-click per re-render.
7. allFrames:true (alcuni CMP vivono in iframe).

**How to apply:** se aggiungi nuovi siti che non si sbloccano, estendi KNOWN_SELECTORS o TEXT_PATTERNS in `public/partner-connect-extension/background.js::autoAcceptConsent`. Per debug, controlla `RELAY.log` filtrando `kind:'consent'` (include `selector`, `text`, `frames`, `attempts`, eventuale `where:'BackgroundTab.navigate'|'handleScrape'`). Backup v3.4.3 in `archive/partner-connect-extension-v3.4.3-2026-05-15/`.
