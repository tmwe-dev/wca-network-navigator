---
name: Whitelist disattivata - TMWE-only auth
description: Dal 2026-05-05 nessuna whitelist; chiunque autenticato via TMWE OAuth entra. Auto-create utente Lovable.
type: feature
---
- `tmwe-oauth-callback` NON controlla più `authorized_users`. La tabella resta in DB ma è ignorata dal gate di login.
- Chiunque completi OAuth TMWE viene auto-creato come utente Lovable (admin.createUser) e riceve sessione via magic link.
- Memorie precedenti "Whitelist Standard" e "TMWE-only auth con whitelist" sono SUPERATE.
