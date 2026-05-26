# Threat Model

## Asset critici
- Credenziali utente (auth.users, sessione JWT).
- Dati partner/contatti (CRM, PII commerciali).
- Cookie WCA/RA/LinkedIn (extension credentials).
- Email inbound/outbound (mailbox IMAP, SMTP queue).
- Prompt operativi e KB (governance AI).

## Attaccanti modellati
1. **Esterno opportunista** — scanner web, credential stuffing.
2. **Utente autenticato malicious** — escalation RLS, accesso a dati altrui.
3. **Operator compromesso** — esfiltrazione massiva via tooling AI.
4. **Supply chain** — dipendenza npm compromessa.

## Mitigazioni in essere
- RLS su ogni tabella business + `has_role()` SECURITY DEFINER.
- Edge functions: `verify_jwt=true` default, allowlist `verify_jwt=false` enforced (`scripts/audit-function-auth.mjs`).
- Hard guards AI: no DELETE, bulk cap, risk gate 7 livelli su `ai_pending_actions`.
- CORS whitelist (no wildcard), CSP serializzata, security headers su edge.
- Soft-delete trigger globale (15 tabelle): nessun DELETE fisico business.
- Prompt sanitizer + injection guard HIGH-block con review owner.
- Editorial review obbligatorio su email/WA/LI.
- Mailbox access guard server-side in `send-email`.

## Risk accettati
- LinkedIn dispatch queue orfana (vedi `docs/debt/linkedin-dispatch-queue-orphan.md`): 0 record, debito conceptual.
- CSP con `unsafe-inline` (script/style): richiesto da shadcn/Radix per ora.
- Public edge functions by-design (allowlisted, vedi `scripts/audit-function-auth.mjs`).
