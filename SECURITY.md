# Security Audit — Secret Hygiene

## Git History Scan (2026-04-14)

### `.env` file in history

The `.env` file was committed in git history. The following commits touched it:

| Commit SHA | Date | Description |
|---|---|---|
| `675c8393` | 2026-02-01 | Initial Lovable Cloud connection |
| `3a085b08` | 2026-02-01 | Changes (auto-generated) |
| `8f578f7a` | 2026-03-29 | fix: update Supabase to correct project |
| `a773ae3c` | 2026-03-29 | fix: use correct Supabase project + native Google OAuth |
| `d8ead526` | 2026-04-01 | Automated agent presets |

### Keys found in history

| Key prefix | Type | Risk | Action required |
|---|---|---|---|
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Supabase anon key | **Low** — publishable by design | No rotation needed |
| `VITE_SUPABASE_URL` | Supabase project URL | **None** — public endpoint | No action |
| `VITE_SUPABASE_PROJECT_ID` | Project identifier | **None** — public metadata | No action |
| `SUPABASE_PUBLISHABLE_KEY` | Supabase anon key (duplicate) | **Low** | No rotation needed |
| `SUPABASE_URL` | Supabase URL (duplicate) | **None** | No action |
| `VITE_SENTRY_DSN=` (empty) | Sentry DSN placeholder | **None** — value was empty | No action |

### Keys NOT found in history

The following sensitive prefixes were **not** found in any committed file:

- `OPENAI_` — ✅ clean
- `STRIPE_` — ✅ clean
- `AWS_` — ✅ clean
- `RESEND_` — ✅ clean
- `TWILIO_` — ✅ clean
- `ELEVENLABS_` — ✅ clean
- `SERVICE_ROLE` / `service_role` — ✅ clean

### Legacy Supabase project in history

Commit `8f578f7a` contains anon key for a **different** Supabase project (`dlldkrzoxvjxpgkkttxu`).
This is a publishable anon key and poses no security risk, but the project may be decommissioned.

### Recommendations

1. **No key rotation needed** — only publishable (anon) keys were ever committed.
2. **History rewriting NOT recommended** — the exposed values are public by design.
3. `.env` is now listed in `.gitignore` to prevent future commits.
4. `.env.example` created with placeholder values only.

---

*Scanned by: automated audit, 2026-04-14*
