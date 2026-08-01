---
name: LinkedIn Bridge Hardening 2026-04-28
description: P1.5 plan refactoring - JWT/extensionAuth enforcement on linkedin-ai-extract and linkedin-profile-api
type: design
---
P1.5 del piano refactoring riconciliato.

**Stato pre-refactor**: 6 edge function LinkedIn (`save-linkedin-cookie`, `save-linkedin-credentials`, `get-linkedin-credentials`, `linkedin-ai-extract`, `linkedin-profile-api`, `send-linkedin`). 4/6 erano già hardened (JWT + CORS dinamico). Restavano 2 buchi:

**linkedin-ai-extract**:
- Prima: accettava qualsiasi richiesta con header `apikey` o `Authorization` (anche valori arbitrari), spendendo crediti AI Gateway.
- Ora: usa `requireExtensionAuth(req, dynCors)`. JWT validato via `getUser()`; anon-key accettata solo da origin in CORS whitelist.

**linkedin-profile-api**:
- Prima: pubblica → chiunque poteva chiamarla e bruciare crediti Proxycurl (a pagamento per profilo).
- Ora: stesso pattern `requireExtensionAuth`. Auth obbligatoria prima del fetch a Proxycurl.

Restano già OK:
- `save-linkedin-cookie`: requireExtensionAuth + payload limit 20KB.
- `save-linkedin-credentials`: JWT enforced + encryption server-side.
- `get-linkedin-credentials`: JWT enforced + rate limit 5/min/user + decrypt.
- `send-linkedin`: JWT enforced + daily limit per user.

Pattern comune adottato:
```ts
const auth = await requireExtensionAuth(req, dynCors);
if (isExtensionAuthError(auth)) return auth;
```
