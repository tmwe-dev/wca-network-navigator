---
name: FireScrape Consent Auto-Accept
description: Estensione Partner Connect 3.4.4 — autoAcceptConsent() in background.js clicca i popup cookie/privacy (OneTrust, Cookiebot, Didomi, Iubenda, Quantcast, Cookieyes, Usercentrics, Termly, Complianz, Axeptio, IAB TCF) + fallback testuale multilingua + reset scroll-lock, prima di scrapeTab. Eseguito in withTab dopo waitForTabLoad.
type: feature
---
Senza auto-accept lo scraper restituiva solo il testo del banner: il contenuto reale era gated da overflow:hidden sul body o non renderizzato finché non davi consenso.

**Cascata:**
1. Selettori noti CMP (id/class deterministici).
2. Fallback testuale: scan di button/[role=button]/input con regex multilingua (accept all, accetta tutti, akzeptieren, aceptar, ecc.).
3. Reset overflow + rimozione classi modal-open/no-scroll su body+html.
4. Settle 800ms.

**How to apply:** se aggiungi nuovi siti che non si sbloccano, estendi KNOWN_SELECTORS in `public/partner-connect-extension/background.js::autoAcceptConsent`. Backup pre-modifica in `archive/partner-connect-extension-v3.4.3-2026-05-15/`.
