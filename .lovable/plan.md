

# Piano: Fix LinkedIn Extension `ERR_NO_CONFIG` — Inviare `setConfig` all'estensione

## Problema

Il syncCookie fallisce con `ERR_NO_CONFIG` perché il bridge LinkedIn (`useLinkedInExtensionBridge.ts`) **non invia mai** l'azione `setConfig` con le credenziali Supabase all'estensione. Il bridge WhatsApp lo fa correttamente (righe 55-78 di `useWhatsAppExtensionBridge.ts`), quello LinkedIn no.

L'estensione supporta `setConfig` — è già gestita in `background.js` (riga 30) e listata nelle azioni valide in `content.js` (riga 19). Manca solo il lato webapp.

## Intervento

**File: `src/hooks/useLinkedInExtensionBridge.ts`**

1. Aggiungere un `configSentRef` come nel bridge WhatsApp
2. Creare una funzione `sendConfig()` che invia `setConfig` con `supabaseUrl` e `supabaseAnonKey` via `postMessage` con direction `from-webapp-li`
3. Chiamare `sendConfig()` non appena l'estensione viene rilevata come disponibile (nel listener del ping o nel `contentScriptReady`)
4. Pattern identico a quello già funzionante in `useWhatsAppExtensionBridge.ts` righe 50-78

## Dettaglio tecnico

```
// Quando isAvailable diventa true → invia config
window.postMessage({
  direction: "from-webapp-li",
  action: "setConfig",
  requestId: `li_setConfig_${Date.now()}`,
  supabaseUrl: import.meta.env.VITE_SUPABASE_URL,
  supabaseAnonKey: import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
}, window.location.origin);
```

## File coinvolti

| File | Modifica |
|------|----------|
| `src/hooks/useLinkedInExtensionBridge.ts` | Aggiungere invio `setConfig` su detection estensione |

## Risultato

- syncCookie non restituirà più `ERR_NO_CONFIG`
- L'estensione avrà le credenziali per salvare il cookie `li_at` nel database

