# RBAC Matrix

## Ruoli (`public.app_role`)
- `admin` — accesso completo, può swap operator, gestire prompt/KB.
- `tutor` — supervisione operator assegnati, lettura globale.
- `operator` — accesso ai propri contatti + condivisi (BCA).
- `viewer` — sola lettura selettiva.

## Funzione check
`public.has_role(_user_id uuid, _role app_role)` — SECURITY DEFINER, usata in ogni RLS policy.

## Matrice riassuntiva

| Azione | admin | tutor | operator | viewer |
|--------|-------|-------|----------|--------|
| Lettura propri contatti | ✓ | ✓ | ✓ | ✓ |
| Lettura contatti BCA condivisi | ✓ | ✓ | ✓ | ✓ |
| Lettura contatti altri operator | ✓ | ✓ (assigned) | ✗ | ✗ |
| Scrittura contatti | ✓ | ✓ (assigned) | ✓ (propri) | ✗ |
| Soft-delete | ✓ | ✗ | ✓ (propri) | ✗ |
| DELETE fisico | ✗ (trigger blocca) | ✗ | ✗ | ✗ |
| Prompt Lab edit | ✓ | ✗ | ✗ | ✗ |
| KB write | ✓ | ✓ | ✗ | ✗ |
| Operator swap | ✓ | ✗ | ✗ | ✗ |
| Send email | ✓ | ✓ | ✓ (proprie mailbox) | ✗ |
| AI invoke | ✓ | ✓ | ✓ | ✗ |
| Approve AI pending actions | risk-gated | risk-gated | ✗ | ✗ |

## Vincoli
- `user_roles` tabella separata (no role su profiles → no privilege escalation).
- Mailbox access guard server-side: `send-email` verifica ownership prima di inviare.
