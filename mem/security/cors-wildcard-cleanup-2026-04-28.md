---
name: CORS Wildcard Cleanup 2026-04-28
description: 8 edge functions migrate from wildcard "*" to dynamic getCorsHeaders(req.origin) with whitelist
type: design
---
P1.1 del piano refactoring riconciliato (chiude C6 audit Aprile 2026).

Funzioni migrate da `Access-Control-Allow-Origin: "*"` a `getCorsHeaders(req.headers.get("origin"))` con whitelist da `_shared/cors.ts`:
- browser-action
- agentic-decide
- agent-loop
- sherlock-extract
- ai-query-planner
- tts
- ai-monitor (refactor: jsonResponse(data, corsHeaders, status?))
- scrape-website

Pattern standard: `const corsHeaders = getCorsHeaders(req.headers.get("origin"))` come PRIMA riga del handler. Tutti i restanti riferimenti a `corsHeaders` invariati.

Rimane 0 wildcard CORS in tutte le edge functions del progetto.
