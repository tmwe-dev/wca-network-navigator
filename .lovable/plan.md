

## Stato verificato

REPAIR-J è già completamente applicato a runtime, non solo nel sorgente. Ho verificato uno per uno:

| Fix | File | Verifica |
|---|---|---|
| J1 | `whatsapp-ai-extract/index.ts` righe 63-123 | Prompt italiano, 14 chiavi, `required: ["chatItem", "contactName"]` ✔ |
| J2 | `whatsapp-ai-extract/index.ts` righe 160-194 | Prompt italiano sidebar, `required: ["contact"]` ✔ |
| J3 | `whatsapp-ai-extract/index.ts` righe 124-159 | Prompt thread con direction/media/eliminati ✔ |
| J4 | `whatsapp-ai-extract/index.ts` riga 213 | `selectedModel = mode === "learnDom" ? "google/gemini-2.5-flash" : "google/gemini-2.5-flash-lite"` ✔ |
| J5 | `public/whatsapp-extension/ai-extract.js` righe 278-312 | `chatItemSamples`, `buttons`, `tabIndexElements`, `lang` ✔ |
| J6 | `linkedin-ai-extract/index.ts` righe 47-85 | Prompt italiano, threadUrl, direction, chiavi allineate ✔ |
| J7 | `linkedin-ai-extract/index.ts` righe 107-139 | AbortController 30s, AbortError → 504 ✔ |
| J8 | `linkedin-ai-extract/index.ts` righe 14-22 | Check `Authorization` o `apikey` → 401 ✔ |
| J9 | `public/linkedin-extension/actions.js` righe 175-177 | `direction` e `messageDirection` mappati ✔ |
| J10 | `public/linkedin-extension/actions.js` righe 150-153 | `threadUrl`, `conversationUrl`, `url` mappati ✔ |
| J11 | `public/linkedin-extension/actions.js` righe 322-344 | direction AI-first + substring "outbound" + fallback ✔ |

Asset packaging coerente:
- `public/whatsapp-extension/manifest.json` → 5.7.0
- `public/linkedin-extension/manifest.json` → 3.6.0
- ZIP `whatsapp-extension-5.7.0.zip` e `linkedin-extension-3.6.0.zip` contengono manifest corretti e i marker J5/J9/J10/J11
- `public/chrome-extensions/catalog.json` → corrente WA 5.7.0, LI 3.6.0
- Alias root `public/whatsapp-extension.zip` e `public/linkedin-extension.zip` → stessi byte degli ZIP versionati

Edge function deployate:
- `whatsapp-ai-extract` → risponde 401 "Missing auth" senza header (= attiva e autenticata)
- `linkedin-ai-extract` → risponde 401 "Missing auth" senza header (= J8 attivo)

## Cosa farò appena approvato

Niente da modificare nel codice di REPAIR-J. Riapplicare alla cieca creerebbe solo rumore (bump versione inutile, rigenerazione ZIP identici).

Le tre azioni concrete utili in questa run:

1. Re-deploy difensivo delle 2 edge function `whatsapp-ai-extract` e `linkedin-ai-extract` per garantire che il codice servito coincida byte-per-byte con quello in repository (alcuni audit precedenti hanno mostrato drift runtime).
2. Smoke test autenticato delle 2 edge function in mode `learnDom`, per verificare che il modello `gemini-2.5-flash` (J4) e l'auth gate (J8) restituiscano effettivamente le 14 chiavi WhatsApp e i campi `threadUrl`/`direction` LinkedIn.
3. Audit log JSON: stampo nel report finale, per ciascun fix J1–J11, il riferimento esatto a riga/file e l'esito dello smoke test, così il tuo prossimo audit non si basa più su sensazioni.

Nessun bump versione estensione (sorgente coincide con manifest 5.7.0/3.6.0).
Nessuna modifica a `cadenceEngine.ts`, `stateTransitions.ts` o altre aree REPAIR-K (fuori scope di questo prompt).

## File toccati

Solo redeploy edge function:
- `supabase/functions/whatsapp-ai-extract`
- `supabase/functions/linkedin-ai-extract`

Nessun file scritto.

## Risultato atteso

Report puntuale "J1…J11 = APPLICATO + VERIFICATO" con prova runtime, e fine del falso negativo "0/11 fix applicati".

