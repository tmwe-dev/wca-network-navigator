## Objetivo
Añadir "Entra con TMWE" en `/v2/login` como método adicional al email+password+whitelist actual. Auto-crear la cuenta Lovable Cloud si el email TMWE no existe aún.

## Decisiones clave
- **Coexiste** con email+password actual. No se toca el flujo whitelist existente.
- **Auto-provisioning** abierto: cualquier email TMWE válido crea cuenta automáticamente.
- **Cero tokens TMWE en cliente**: todo el OAuth pasa por edge functions (ya construidas en la iteración previa).
- **Mapeo 1:1**: `auth.users.id` ⇄ `tmwe_user_id` (vía `tmwe_user_tokens` ya existente).

## Flujo de login TMWE
```
[Login page] → botón "Entra con TMWE"
   ↓
edge: tmwe-oauth-start  (genera state, redirige a sandbox.findair.net/oauth/authorize)
   ↓
[Usuario aprueba en TMWE]
   ↓
edge: tmwe-oauth-login-callback  (NUEVA, distinta de la callback de "conectar")
   - Intercambia code → tokens TMWE
   - Llama get_my_profile → obtiene email, tmwe_user_id, company
   - Busca auth.users por email
       · Si existe → usa ese user_id
       · Si NO existe → admin.createUser({ email, email_confirm: true, password: random })
   - Guarda/upserta tokens en tmwe_user_tokens (mapeo user_id ⇄ tmwe_user_id)
   - Genera magic link Supabase (admin.generateLink type=magiclink)
   - Redirige al frontend con el magic link → sesión iniciada
   ↓
[/v2 dashboard]
```

## Cambios necesarios

### 1. DB (migración mínima)
- Añadir columna `tmwe_email` (text) y `tmwe_company` (text) a `tmwe_user_tokens` para auditoría (ya se guardan en metadata, lo extraemos a columnas indexadas).
- Añadir flag `created_via_tmwe` (boolean default false) en `profiles` para distinguir cuentas auto-provisionadas.
- **No se toca whitelist** (`authorized_users`): los usuarios TMWE auto-provisionados saltan la whitelist por diseño.

### 2. Edge function nueva: `tmwe-oauth-login-callback`
Distinta de `tmwe-oauth-callback` (esa es para "conectar TMWE a un usuario ya logueado"). Esta es para "loguearse vía TMWE".
- `verify_jwt = false` (público, recibe el code de TMWE)
- Diferenciada por parámetro `intent=login` en el `state`
- Usa `service_role` para crear usuarios y generar magic links
- Devuelve redirect 302 a la URL del magic link

### 3. Edge function `tmwe-oauth-start` (modificar)
- Aceptar parámetro `intent` (`connect` | `login`)
- Guardar `intent` en `tmwe_oauth_state`
- Redirigir a la callback correcta según `intent`

### 4. UI: `/v2/login`
- Añadir botón "Entra con TMWE" debajo del form actual con separador "oppure"
- Llama a `tmwe-oauth-start` con `intent=login`
- Loading state mientras redirige

### 5. DAL: `src/data/tmwe.ts`
- Añadir `startTmweLogin()` que llama al edge con `intent=login`

## Seguridad
- `state` CSRF sigue obligatorio (TTL 10min, single-use).
- Magic link generado server-side, nunca expuesto en logs.
- Rate limit en callback: máx 10 intentos/hora por IP.
- Audit en `tmwe_proxy_audit` cada login (event=`oauth_login_success` / `oauth_login_failure`).
- Email TMWE se confirma como verificado solo si TMWE devuelve `email_verified=true`.

## Fuera de alcance
- Vincular a posteriori cuenta TMWE a cuenta email/password ya existente con email distinto (se hace solo por email match).
- Logout de TMWE (solo cierra sesión Lovable).
- Refresh automático del token TMWE durante la sesión Lovable (ya gestionado por `tmweClient.ts`).

## Detalles técnicos
- Endpoints TMWE usados: `/oauth/authorize`, `/oauth/token`, `/erp/tmwe_json/get_my_profile`.
- `state` table: añadir columna `intent text not null default 'connect' check (intent in ('connect','login'))`.
- Magic link redirect: `${SITE_URL}/v2` (ya configurado).
- Si email TMWE coincide con un user existente que tiene password → solo se vincula y se loguea (no se sobreescribe password).