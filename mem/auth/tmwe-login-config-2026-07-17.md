---
name: TMWE Login Config 2026-07-17
description: Config login TMWE definitiva — base URL sandbox.findair.net, ritorno nel pannello destro (iframe same-origin /v2/tmwe-login-popup), NO popup window, NO nuova tab
type: feature
---
Configurazione approvata dall'utente il 2026-07-17. Non regredire.

- Base URL OAuth TMWE: `https://sandbox.findair.net/`
- Client ID / Secret: gestiti come secrets edge (non hardcoded).
- Comportamento login button "Entra con TMWE" in `src/v2/ui/pages/LoginPage.tsx`:
  - Sempre `<a href="/v2/tmwe-login-popup" target="_self">` — apre nello STESSO pannello (iframe same-origin quando embedded in preview).
  - NIENTE `window.open()` popup, NIENTE `target="_blank"`.
  - La pagina `/v2/tmwe-login-popup` gestisce `tmweLoginStart` + redirect verso sandbox.findair.net e ritorno.
- Redirect post-login: via postMessage/BroadcastChannel al parent (`main` LoginPage) che completa la sessione.
- Motivo: l'utente vuole l'esperienza intera dentro il pannello destro dell'app; nuove tab/popup vengono considerate regressione.