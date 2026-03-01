

## Diagnosi: Tutte le estensioni non trovano le credenziali

### Il problema esatto

Tutte e tre le Edge Functions per le credenziali (`get-wca-credentials`, `get-linkedin-credentials`, `get-ra-credentials`) hanno un auth check che **blocca le chiamate delle estensioni Chrome**.

Le estensioni non hanno accesso al JWT dell'utente. Inviano solo l'anon key come Bearer token:
```
Authorization: Bearer <SUPABASE_ANON_KEY>
```

Ma le Edge Functions tentano di validare quel token come JWT utente:
- `get-wca-credentials` → `authClient.auth.getUser(token)` — anon key non è un JWT utente → **401 Unauthorized**
- `get-linkedin-credentials` → `authClient.auth.getClaims(token)` — metodo inesistente → **errore interno → 401**
- `get-ra-credentials` → `authClient.auth.getClaims(token)` — stessa cosa → **401**

Le funzioni ritornano 401 **prima** di arrivare al fallback `app_settings`, dove le credenziali esistono effettivamente (confermato dai dati di rete: `wca_username: "tmsrlmin"`, `linkedin_email: "luca@tmwe.it"`, `ra_username: "simone@tmwe.it"`).

### Fix

**Per tutte e tre le Edge Functions**, cambiare la logica di autenticazione:

1. Se il token è un JWT utente valido → cercare prima in `user_wca_credentials` (solo per WCA), poi fallback su `app_settings`
2. Se `getUser` fallisce (= il token è l'anon key, come quando chiama l'estensione) → andare direttamente su `app_settings` invece di tornare 401

Concretamente, in ogni funzione, sostituire il blocco auth rigido:
```typescript
const { data: { user }, error } = await authClient.auth.getUser(token)
if (error || !user) {
  return Response 401  // ← QUESTO BLOCCA LE ESTENSIONI
}
```

Con una logica soft che permette il fallthrough:
```typescript
const { data: { user }, error } = await authClient.auth.getUser(token)
// Se user è valido → cerca credenziali per-user (solo WCA)
// Se user non è valido → salta a app_settings (le estensioni passano di qui)
```

### File da modificare

1. **`supabase/functions/get-wca-credentials/index.ts`** — Rendere il getUser soft, permettendo fallback ad app_settings quando chiamato dall'estensione
2. **`supabase/functions/get-linkedin-credentials/index.ts`** — Sostituire `getClaims` con `getUser` soft + fallback diretto ad app_settings
3. **`supabase/functions/get-ra-credentials/index.ts`** — Stessa correzione: `getClaims` → `getUser` soft + fallback

Nessuna modifica necessaria alle estensioni Chrome.

