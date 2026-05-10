## La risposta in una riga
Hai ragione: il sistema AI per "leggere il DOM e dirci dove sono i bottoni" esiste già ed è collaudato (lo usiamo per `readInbox` e `extractProfile`). Lo abbiamo escluso a mano dal `sendMessage` per paura di doppi invii. Lo riattiviamo come **verificatore di selettori**, non come *clicker*.

## Verifica fatta (✅)
L'edge `supabase/functions/linkedin-ai-extract/index.ts` supporta già `pageType: "messaging"` e ritorna nello schema:
```
{ messageBoxSelector, threadHeader, threadUrl, lastMessageTime, sendButtonSelector }
```
→ **Nessuna modifica server richiesta.** Tutto si gioca nell'estensione.

## Pipeline 3.9.56 — "AI-Verified Click"
```
1. Apri composer            (invariato)
2. Scrivi testo             (invariato — single writer)
3. ── NUOVO: AI VERIFY ──
   schema = AILearn.getCached("messaging")
        || AILearn.learnFromAI(tabId, "messaging", url, key)
4. findSendBtn():
   PRIMA  → schema.sendButtonSelector (AI)
   POI    → regex attuale (msg-form__send-button / aria-label / text)
5. UN solo firePhysicalClick (invariato 3.9.54)
6. textboxCleared 1.5s → verified true / false
7. Se verified=false E lo schema veniva da cache:
      AILearn.clearCache() → relearn → UNA retry
      (protetto da anti-double-send 2s già esistente)
```

## File toccati
- **`public/linkedin-extension/hybrid-ops.js`** — ~30 righe nel solo blocco `sendMessage`. Nessun refactor.
  Nuovi campi nel result: `verifiedBy: "ai_schema" | "regex_fallback"`, `selectorUsed`, `schemaAgeMs`, `relearned: boolean`.
- **`public/linkedin-extension/manifest.json`** → version `3.9.56` + descrizione.
- **`public/chrome-extensions/catalog.json`** → 3.9.56 current, 3.9.55 storico.
- **`src/lib/whatsappExtensionZip.ts`** → bump 3.9.56.
- **Repackage** `linkedin-extension-3.9.56.zip` + `linkedin-extension.zip`.

## Cosa NON viene toccato (zero rischio regressione)
- `tab-manager.js` (la separazione read/send 3.9.55 resta)
- `actions.js` / `readInbox` / `check-inbox` / `email-imap-proxy`
- writer del testo nel composer
- anti-double-send 2s
- `linkedin-ai-extract` (già pronto)

## Garanzie di sicurezza
- AI **read-only**: estrae selettori, non clicca mai.
- Single writer: resta UN solo `firePhysicalClick`.
- Anti-double-send 2s: anche in caso di retry, il guard previene il doppio invio.
- Edge AI giù / cache vuota → fallback **immediato** alla regex 3.9.55. Zero blocco.
- Costo AI: ~1 chiamata ogni cache TTL (LinkedIn cambia DOM raramente), non per messaggio.

---

## Servono 2 decisioni prima di partire

**A. Retry dopo verified=false:**
1. **Auto** — relearn + 1 retry automatica (più "magico", rischio teorico edge-case di doppio invio coperto dal guard 2s)
2. **Manuale** — segnala "send non verificato, ritenta?" all'operatore (più safe, 1 click in più)

**B. Diagnostica in `LinkedInTest.tsx`:**
1. Sì, mostra `verifiedBy / selectorUsed / schemaAge / relearned` nel pannello test
2. No, basta il log console

Dimmi A1/A2 e B1/B2 e procedo con la 3.9.56.
