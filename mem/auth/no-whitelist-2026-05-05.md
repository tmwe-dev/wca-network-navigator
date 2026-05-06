---
name: Whitelist riattivata server-side (TMWE auth + authorized_users gate)
description: Dal 2026-05-06 il callback TMWE controlla l'email contro authorized_users prima di creare utente Lovable o salvare token.
type: feature
---
- Autenticazione = TMWE OAuth (sandbox.findair.net). Autorizzazione = whitelist `authorized_users`.
- `tmwe-oauth-callback` (intent=login): dopo `get_my_profile`, normalizza email (trim+lowercase), rifiuta alias `@tmwe.local`, chiama RPC `is_email_authorized`. Se false → redirect `/v2/login?tmwe=error&reason=not_whitelisted` SENZA creare utente né salvare token.
- Token TMWE mai esposto al client; tutte le chiamate runtime passano da `tmwe-proxy`.
- Sostituisce la memoria precedente "Whitelist disattivata".
