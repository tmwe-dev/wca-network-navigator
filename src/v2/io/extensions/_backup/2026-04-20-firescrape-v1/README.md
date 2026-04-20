# Backup FireScrape v1 — 2026-04-20

Snapshot della prima versione operativa di **FireScrape Canvas** (deep search webapp ↔ Partner Connect Extension v3.4.0).

## Cosa contiene

| File | Origine |
|------|---------|
| `bridge.ts.bak.txt` | `src/v2/io/extensions/bridge.ts` |
| `deep-search-pipelines.ts.bak.txt` | `src/v2/io/extensions/deep-search-pipelines.ts` |
| `DeepSearchCanvas.tsx.bak.txt` | `src/v2/ui/pages/email-forge/DeepSearchCanvas.tsx` |

I file sono salvati come `.bak.txt` per evitare conflitti TypeScript (import paths) ma il contenuto è 1:1 con la versione originale.

## Contratto API estensione (v3.4.0) — fast-path verificato

```
webapp → ext   :  postMessage({ direction: "from-webapp-fs", action, requestId, ...payload })
ext    → webapp:  postMessage({ direction: "from-extension-fs", requestId, response: {...} })
```

Sequenza che funziona (validata dall'utente il 2026-04-20):

1. `agent-action` con `step: { action: "navigate", url, background: true, reuseTab: true }`
2. attesa client-side di `settleMs` (≥ 2500 ms; 3000 ms per Maps)
3. `scrape` con `skipCache: true` → ritorna `{ markdown, content, ... }`

## UI testata

- Split layout 340px sinistra / flex destra
- Pipeline rapide: Google Maps, sito multi-pagina, reputation, Google generale
- Live feed pagine con stato pending/running/done/error
- Render markdown con `prose` + accent `primary` su h1/h2/h3, strong, code, blockquote, links
- Auto-highlight email / telefoni / P.IVA
- Persistenza automatica in `scrape_cache` (TTL 7gg)
- Stop interrompibile a metà sequenza

## Quando ripristinare

Se Sherlock dovesse rompersi e servisse tornare a questo baseline:
1. Rinominare `*.bak.txt` → `*.ts` / `*.tsx`
2. Ripristinare gli import originali
3. Ripuntare `LabBottomTabs.tsx` a `DeepSearchCanvas` invece di `SherlockCanvas`
