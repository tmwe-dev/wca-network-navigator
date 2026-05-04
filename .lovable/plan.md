# Integración TMWE API — Plan actualizado (proxy server-side, sin JWT en cliente)

## Decisiones clave (cambios respecto al plan anterior)

1. **Sandbox-only** en esta iteración (`TMWE_BASE_URL = https://sandbox.findair.net`).
2. **Cero JWT/tokens en el cliente**. Todo el tráfico TMWE pasa por una edge function proxy. El frontend nunca ve `access_token` ni `refresh_token`.
3. **Identidad operador**: cada usuario Lovable se vincula a un `tmwe_user_id` (bigint) mediante un flujo OAuth Authorization Code que se completa **íntegramente server-side**.
4. **Mapeo identidad**: `auth.users.id` (UUID Lovable) ⇄ `tmwe_user_id` (bigint TMWE), con UNIQUE en ambos lados.

---

## Arquitectura

```text
[ UI React ]
    │  invokeEdgeV2('tmwe-proxy', { op, params })
    ▼
[ tmwe-proxy edge function ]   ← única que conoce tokens
    │  1. requireAuth() → auth.uid()
    │  2. resolve identity (system | user)
    │     - system: token cacheado en tmwe_system_tokens
    │     - user:   token de tmwe_user_tokens WHERE user_id = auth.uid()
    │  3. refresh si expires_at < now()+60s
    │  4. fetch TMWE con Bearer (server-side)
    │  5. log → edge_metrics + ai_interaction_log
    ▼
[ TMWE Sandbox API ]

[ tmwe-oauth-start ]    → genera state CSRF, redirige al /authorization de TMWE
[ tmwe-oauth-callback ] → recibe code, llama exchange_code_for_jwt, llama get_my_profile,
                          guarda tokens + tmwe_user_id en tmwe_user_tokens, redirige a UI
```

**Regla**: ningún `access_token` TMWE sale nunca del backend. La UI sólo recibe `{ data, error }` del recurso pedido más metadatos (`tmwe_user_id`, `tmwe_email`, `connected`, `expires_at`).

---

## Secrets (Lovable Cloud)

| Nombre | Uso |
|---|---|
| `TMWE_BASE_URL` | `https://sandbox.findair.net` |
| `TMWE_SYSTEM_CLIENT_ID` | client_credentials (S2S, llamadas background) |
| `TMWE_SYSTEM_CLIENT_SECRET` | idem |
| `TMWE_OAUTH_CLIENT_ID` | Authorization Code (login operador) |
| `TMWE_OAUTH_CLIENT_SECRET` | idem |
| `TMWE_OAUTH_REDIRECT_URI` | `https://<project>.supabase.co/functions/v1/tmwe-oauth-callback` |

---

## Migración DB

### `tmwe_system_tokens` (singleton, service-role only)
- `id` (uuid pk), `access_token` (text), `expires_at` (timestamptz), `scopes` (text[]), `updated_at`.
- RLS: deny all a `authenticated`/`anon`. Sólo edge functions con service role.

### `tmwe_user_tokens`
| Columna | Tipo | Nota |
|---|---|---|
| `user_id` | uuid PK | FK → `auth.users(id)` ON DELETE CASCADE |
| `tmwe_user_id` | bigint UNIQUE NOT NULL | id interno TMWE |
| `tmwe_email` | text | display |
| `tmwe_company` | text | display |
| `tmwe_vat_number` | text | display |
| `access_token` | text | nunca expuesto |
| `refresh_token` | text | nunca expuesto |
| `expires_at` | timestamptz | |
| `scopes` | text[] | |
| `connected_at` | timestamptz default now() | |
| `last_used_at` | timestamptz | |

- **RLS**: SELECT permitido al propio `user_id` **pero excluyendo columnas de tokens** vía vista `tmwe_user_connections_v` (sólo metadatos). INSERT/UPDATE/DELETE: solo service role.
- Vista pública para UI:
  ```sql
  create view public.tmwe_user_connections_v as
    select user_id, tmwe_user_id, tmwe_email, tmwe_company,
           tmwe_vat_number, scopes, connected_at, last_used_at,
           (expires_at > now()) as token_valid
    from public.tmwe_user_tokens;
  ```

### `tmwe_oauth_state` (CSRF)
- `state` (text pk), `user_id` (uuid), `created_at`, `expires_at` (5 min). Service role only.

### `tmwe_proxy_audit` (opcional, ligero)
- `id`, `user_id`, `tmwe_user_id`, `op`, `path`, `status`, `latency_ms`, `created_at`. Para auditoría rápida sin saturar `edge_metrics`.

---

## Edge Functions

### 1. `tmwe-oauth-start` (verify_jwt en code)
- Input: ninguno.
- Lógica: requireAuth → genera `state` random → guarda en `tmwe_oauth_state` → responde `{ redirect_url }` con `client_id`, `redirect_uri`, `scope`, `state`, `response_type=code`.
- UI hace `window.location.assign(redirect_url)`.

### 2. `tmwe-oauth-callback` (verify_jwt = false, público)
- Input: query `?code=...&state=...`.
- Lógica: valida `state` (existe, no expirado, lo borra) → llama `POST /erp/tmwe_json/exchange_code_for_jwt` con system client_id/secret + code → recibe `access_token`, `refresh_token`, `expires_in`, `scope` → llama `GET /erp/tmwe_json/get_my_profile` con Bearer → upsert en `tmwe_user_tokens` por `user_id` (state contiene user_id) → redirige a `/v2/settings/connections?tmwe=ok` (o `?tmwe=error&reason=...`).

### 3. `tmwe-proxy` (verify_jwt en code) — **único punto de salida**
- Input: `{ op: string, params?, identity?: "user" | "system" }`.
- `op` se mapea contra **whitelist** (no se acepta `path` arbitrario):
  ```ts
  const OPS = {
    "profile.me":          { method: "GET",  path: "/erp/tmwe_json/get_my_profile",   identity: "user",   scope: "profile:read" },
    "tracking.byAwb":      { method: "POST", path: "/erp/tmwe_json/shipment_tracking", identity: "user",   scope: "tracking:read" },
    "shipment.list":       { method: "GET",  path: "/erp/tmwe_json/ext_my_shipments",  identity: "user",   scope: "shipment:read" },
    "shipment.unified":    { method: "POST", path: "/erp/tmwe_json/unified_shipment",  identity: "user",   scope: "shipment:read" },
    "rubrica.search":      { method: "POST", path: "/erp/tmwe_json/rubrica_search",    identity: "user",   scope: "profile:read" },
    "system.health":       { method: "GET",  path: "/erp/tmwe_json/health",            identity: "system", scope: "admin" },
  } as const;
  ```
- Flujo:
  1. `requireAuth()` → `userId`.
  2. Resuelve token según `identity`:
     - `system`: lee/refresca `tmwe_system_tokens` (client_credentials).
     - `user`: lee `tmwe_user_tokens` por `user_id`. Si no existe → `412 { error: "TMWE_NOT_CONNECTED" }`. Si `expires_at < now()+60s` → refresh con `refresh_token` y actualiza fila.
  3. Fetch TMWE con `AbortController` (15 s timeout).
  4. Devuelve `{ data, tmwe_user_id }` o `{ error, code }` con CORS + securityHeaders.
  5. Log: `edge_metrics` + (opcional) `tmwe_proxy_audit`. **Nunca** loguea tokens.
- Rate limit: 60 req/min por `user_id` vía `_shared/rateLimiter.ts`.
- Validación con Zod del body de entrada y de `params` por `op`.

---

## DAL `src/data/tmwe.ts`

```ts
export async function tmweGetMyProfile()
export async function tmweTrack(awb: string)
export async function tmweListMyShipments(filters?)
export async function tmweUnifiedShipment(payload)
export async function tmweRubricaSearch(query)

export async function tmweConnectionStatus()   // SELECT desde tmwe_user_connections_v
export async function tmweConnectStart()       // invoca tmwe-oauth-start, devuelve redirect_url
export async function tmweDisconnect()         // edge function tmwe-disconnect que borra fila
```

Todas usan `invokeEdgeV2('tmwe-proxy', ...)`. Nunca tocan tokens.

---

## UI

**Settings → Connections** (extender `ConnectionsSettingsTab.tsx`):
- Bloque "TMWE (Findair Sandbox)" con:
  - Estado: `Conectado como <tmwe_email> · TMWE id <tmwe_user_id> · scopes [...] · token válido hasta <expires_at>` o "No conectado".
  - Botón **Conectar** → `tmweConnectStart()` → redirect.
  - Botón **Desconectar** (con confirm).
  - Botón **Probar** (`profile.me`, `tracking.byAwb` con AWB demo).
- Toast post-callback leyendo `?tmwe=ok|error`.

**Diagnostics panel** (`/v2/test-extensions` o nueva tab): ping `system.health`, `profile.me`, `shipment.list` con cronómetro.

---

## Mapeo identidad — reglas operativas

- **SSOT**: `auth.users.id` (Lovable). `tmwe_user_id` es atributo.
- 1 operador Lovable ⇄ 1 cuenta TMWE (UNIQUE `tmwe_user_id`). Reintento de OAuth con misma cuenta TMWE para otro user_id → error claro `TMWE_ACCOUNT_ALREADY_LINKED`.
- Email TMWE puede diferir del email Lovable (esperado).
- Disconnect = `DELETE FROM tmwe_user_tokens WHERE user_id = auth.uid()` + (opcional) revoke al endpoint TMWE si existe.
- Admin **no** puede impersonar TMWE de otro operador en esta fase (fuera de scope).

---

## Wiring agentes (Bruce y otros)

- Nuevas capabilities en `agent_capabilities`: `tmwe.profile`, `tmwe.tracking`, `tmwe.shipment`, `tmwe.rubrica`.
- Tool handlers llaman al DAL TMWE. Hard guards: nunca `system.*` para agentes, sólo `identity: "user"` con el `user_id` del operador activo.
- KB doc `public/kb-source/integrations/tmwe.md` con ops disponibles, ejemplos, errores.

---

## Fuera de scope (fase 1)

- Switch sandbox ↔ producción.
- Webhooks inbound TMWE.
- Endpoints `fatturazione`, `pagamenti`, `customs`, `register_user`.
- Impersonación admin → operador.
- Refresh proactivo en background (se hace lazy en `tmwe-proxy`).

---

## Orden de implementación

1. Crear secrets (request al usuario).
2. Migración DB (3 tablas + vista + RLS).
3. Edge function `tmwe-proxy` con whitelist mínima (`profile.me`, `tracking.byAwb`, `shipment.list`).
4. Edge functions `tmwe-oauth-start` y `tmwe-oauth-callback`.
5. DAL `src/data/tmwe.ts`.
6. UI Settings → Connections (bloque TMWE).
7. Pruebas manuales: connect → profile → track → disconnect.
8. Wiring agente Bruce (capabilities + KB).
