

## Audit Auth, Google OAuth, Ruoli e Accessi

### STATO ATTUALE — Cosa funziona e cosa no

| Area | Stato | Dettaglio |
|------|-------|-----------|
| Login email/password (V1 `/auth`) | ✅ Funziona | Whitelist + login + redirect a `/v1` |
| Login email/password (V2 `/v2/login`) | ✅ Funziona | Stessa logica tramite `useAuthV2` |
| Google OAuth | ✅ Codice corretto | Usa `lovable.auth.signInWithOAuth("google")` sia in V1 che V2 |
| Whitelist (`authorized_users`) | ✅ Funziona | 4 utenti autorizzati, RPC `is_email_authorized` ok |
| Profilo di Luca (`lucaarcana@gmail.com`) | ❌ **MANCANTE** | auth.users ID `1d51961d...` NON ha riga in `profiles` |
| Ruoli di TUTTI gli utenti | ❌ **VUOTO** | Tabella `user_roles` ha 0 righe. Nessuno è admin. |
| Pagine admin (Telemetria, Diagnostica) | ❌ **Bloccate** | `useRequireRole("admin")` fallisce sempre → redirect |
| Trigger `handle_new_user` | ⚠️ Parziale | Creato DOPO l'utente Luca → non ha generato il suo profilo |
| Trigger `handle_new_user_role` | ⚠️ Parziale | Stesso problema: assegna ruolo solo ai NUOVI utenti |

### UTENTI NEL SISTEMA

| Email | auth.users | Profilo | Ruolo |
|-------|-----------|---------|-------|
| lucaarcana@gmail.com | `1d51961d...` | ❌ MANCANTE | ❌ NESSUNO |
| luigi@tmwe.it | `fe1db58a...` | ✅ "Luigi" | ❌ NESSUNO |
| alexander.bittermann.88@gmail.com | `c8aadbed...` | ✅ "Alexander" | ❌ NESSUNO |
| luca@tmwe.it | `ae35ad39...` | ✅ "Luca Arcanà" | ❌ NESSUNO |
| imane@tmwe.it | `27b60e53...` | ✅ "imane" | ❌ NESSUNO |

**Problema chiave**: i trigger sono stati creati dopo la registrazione degli utenti. Quindi nessuno ha mai ricevuto un ruolo, e Luca (il primo utente) non ha nemmeno il profilo.

---

### PIANO DI FIX

#### Fix 1 — Migration SQL: backfill profilo + ruoli

Una migration che:
1. **Crea il profilo mancante** per `lucaarcana@gmail.com` (ID `1d51961d-da81-4914-b229-511cdce43e55`) con display_name "Luca"
2. **Assegna ruolo `admin`** a Luca (lucaarcana@gmail.com)
3. **Assegna ruolo `user`** a tutti gli altri utenti esistenti che non hanno ancora un ruolo
4. Tutto con `ON CONFLICT DO NOTHING` per essere idempotente

#### Fix 2 — useAuthV2: auto-creazione profilo se mancante

Nella funzione `loadProfile`, se la query ritorna `null`, creare automaticamente il profilo usando i dati da `user.user_metadata` (display_name, avatar_url). Così qualsiasi utente futuro che "sfugge" al trigger viene recuperato al primo login.

#### Fix 3 — Verifica accesso admin dopo i fix

Dopo la migration, le pagine Telemetria e Diagnostica saranno accessibili a Luca perché `useRequireRole("admin")` troverà il suo ruolo nella tabella `user_roles`.

---

### File modificati

1. **Nuova migration SQL** — backfill profilo Luca + ruoli per tutti
2. **`src/v2/hooks/useAuthV2.ts`** — `loadProfile` con fallback auto-create (~15 righe)

### Nessuna modifica necessaria a

- Google OAuth (codice già corretto)
- Pagina Auth V1 (funziona)
- Trigger esistenti (funzionano per i nuovi utenti)
- RLS policies (già corrette)

