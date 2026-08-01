---
name: SSRF Guard & JWT Hardening 2026-04-28
description: P1.2-P1.4 plan refactoring - SSRF assertSafePublicUrl + JWT enforcement on save-wca-cookie/analyze-import-structure/elevenlabs-conversation-token
type: design
---
P1.2-P1.4 del piano refactoring riconciliato.

**P1.2 save-wca-cookie**: ora usa `requireExtensionAuth` da `_shared/extensionAuth.ts`. JWT preferito; anon-key accettata solo da origin in CORS whitelist. Aggiunto limite payload 20KB.

**P1.3 JWT enforcement**:
- `analyze-import-structure`: era pubblica → ora richiede JWT valido (rifiuta anon-key e token mancante con 401). Protegge spesa AI Gateway.
- `elevenlabs-conversation-token`: era soft-auth (best-effort) → ora richiede JWT valido (401 se assente/scaduto). Lega bridge_token a user reale.

**P1.4 SSRF Guard**: nuova funzione `assertSafePublicUrl(url, opts?)` in `_shared/inputValidator.ts`:
- Blocca: protocolli non http(s), credentials in URL, hostname `localhost`, TLD `.local/.internal`, IPv4 privati (10/8, 127/8, 169.254/16 incluso AWS metadata, 172.16/12, 192.168/16, 192.0/24, 198.18/15, 0/8, 100.64/10), IPv6 loopback/ULA/link-local/IPv4-mapped.
- Opzionale: `allowHostSuffixes` per allowlist hostname.
- Variante non-throwing: `safePublicUrlOrNull`.
- Applicata in: `scrape-website/index.ts` (sostituisce check protocollo manuale), `enrich-partner-website/index.ts` (prima del fetch fallback).
- 14 test Deno verdi in `_shared/inputValidator.test.ts`.

Pattern d'uso:
```ts
import { assertSafePublicUrl } from "../_shared/inputValidator.ts";
try {
  const safe = assertSafePublicUrl(userUrl);
  await fetch(safe.toString(), { ... });
} catch (e) {
  return new Response(JSON.stringify({ error: e.message }), { status: 400 });
}
```
