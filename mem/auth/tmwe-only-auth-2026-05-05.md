---
name: TMWE-only auth con whitelist
description: Login esclusivamente via TMWE OAuth; gate authorized_users nel callback; nessun form email/password
type: feature
---
Dal 2026-05-05 l'unica porta d'ingresso è TMWE OAuth.

- `/v2/login` mostra solo il bottone "Entra con TMWE". Niente form email/password, signup, reset.
- `tmwe-oauth-callback` (intent=login): subito dopo aver ricavato `authEmail` dal profilo TMWE, controlla `authorized_users` (case-insensitive, `is_active=true`). Se assente → redirect `/v2/login?tmwe=error&reason=not_whitelisted` SENZA creare l'utente Lovable.
- Se whitelisted: resolve o auto-crea l'utente Lovable (admin.createUser) e apre la sessione via magic link → `/v2`.
- L'admin gestisce gli accessi solo dalla pagina operatori (whitelist `authorized_users`).
- `useAuthV2` mantiene `signInWithEmail/signUp/resetPassword/updatePassword` per compatibilità ma non vengono più chiamate dalla LoginPage.
- Memoria precedente "Whitelist Standard email+password" è SUPERATA da questa.
