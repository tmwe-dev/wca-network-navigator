# TMWE / findair API Integration Plan

> **Status**: Ready for implementation in Lovable.dev
> **Owner**: Backend (Supabase Edge Functions) + Frontend (v2 UI)
> **Last verified**: 2026-04-30 against `https://sandbox.findair.net/erp/tmwe_json`

---

## 1. Context

WCA Network Navigator is a CRM for freight forwarders built on React + Supabase. It already integrates **WCA Directory**, **LinkedIn**, and **Routing Atlas** following a consolidated pattern: Deno Edge Functions + per-feature Supabase tables + the `invokeEdge<T>()` wrapper in [src/lib/api/invokeEdge.ts](../src/lib/api/invokeEdge.ts).

This plan adds **TMWE / findair** — an OAuth2-secured ERP API for transport / logistics operations (anagrafica, contacts, rate cards, shipments, tracking, invoicing). The CRM will:

- Pull TMWE master data (anagrafica + contacts + addresses + rate cards) to enrich CRM partners.
- Push outbound flows (rate quotes, draft shipments, tracking polling) when a CRM deal converts.
- Subscribe to webhooks for shipment / tracking / document events.

### Decisions already taken

| Topic | Decision |
|---|---|
| Auth model | **Single-tenant**: one global `client_id`/`client_secret` pair stored in Supabase Secrets. No per-user credentials in v1. |
| Token strategy | Server-side cache in Supabase, refreshed by an Edge Function. Token never reaches the browser. |
| MVP scope | **Anagrafica + Contacts + Addresses + Listini** (rate cards). Shipments / tracking / webhooks come right after. |
| UI surfaces | **Settings card** (connection status) + **Partner Detail tab** (TMWE actions on a CRM partner). |

---

## 2. TMWE API — what was verified

All requests below were executed against `https://sandbox.findair.net/erp/tmwe_json/` using the production-issued client credentials. **No IP allowlist is in place** (the OAuth client has `allowed_ips: ""`). All required scopes are already granted to the integration client (`shipment:read|write`, `rate:read`, `booking:write`, `tracking:read`, `document:read`, `webhook:manage`, `profile:read`, `listini:read`).

### 2.1 Authentication

```http
POST /erp/tmwe_json/token
Content-Type: application/x-www-form-urlencoded

grant_type=client_credentials&client_id=<id>&client_secret=<secret>
```

Response:
```json
{
  "access_token": "<160-char hex>",
  "token_type": "Bearer",
  "expires_in": 86400
}
```

Use the returned token as `Authorization: Bearer <access_token>` on every subsequent request. The token is opaque (not JWT) and lasts 24 h. There is also a refresh-token grant if needed; with `client_credentials` it is simpler to just re-fetch.

### 2.2 URL routing — important pitfall

The TMWE Apache rewrite (`.htaccess`) maps `/<action>` → `app.php?action=<action>`. The URLs displayed in the OpenAPI spec as `/?response_on=<action>` are **documentation artifacts, not real URLs** — calling them at the host root returns a 403 from Apache. The **only correct base URL** is:

```
https://sandbox.findair.net/erp/tmwe_json/<action>      (staging)
https://erp.tmwe.it/erp/tmwe_json/<action>              (production)
```

Where `<action>` is the `response_on` value from `config/routes/*.yml` (for example `api_anagrafica_crud`, **not** `api_anagrafica`).

### 2.3 OpenAPI specs available over HTTP

| Spec | Path | Size | Purpose |
|---|---|---|---|
| `external` | `GET /openapi_spec?spec=external` | ~378 KB / 39 paths | Public client-facing API (cargo, express, tracking, webhooks) |
| `oauth2` | `GET /openapi_spec?spec=oauth2` | ~266 KB | Token / introspect / revoke endpoints |
| **`main`** | `GET /openapi_spec?spec=main` | **~580 KB / 198 paths / 25 tags** | **Use this for the MVP** — includes `Anagrafica`, `Listini`, `Rubrica`, `Commercial`, etc. |
| `cargo` | `GET /openapi_spec?spec=cargo` | ~370 KB | Cargo + WebCargo + AWB + labels |

**Recommendation**: at build time download `spec=main` and run `openapi-typescript` to produce `src/types/tmwe-generated.d.ts`. Avoids hand-maintaining types.

### 2.4 Verified endpoints (smoke test 2026-04-30)

#### Master data (MVP focus)

| Endpoint | Method | Required params | Verified |
|---|---|---|---|
| `/api_anagrafica_crud` | GET | (none for list) | ✅ 20 anagrafiche returned |
| `/api_anagrafica_crud` | POST/PATCH | body | schema OK |
| `/api_anagrafica_addresses` | GET | `id_anagrafica` | ✅ 11 addresses for id=1 |
| `/api_anagrafica_addresses` | POST/PATCH | body | schema OK |
| `/api_anagrafica_set_default_address` | POST | body | schema OK |
| `/api_anagrafica_contacts` | GET | `id_anagrafica` | ✅ 101 contacts for id=1 |
| `/api_anagrafica_contacts` | POST/PATCH | body | schema OK |
| `/api_anagrafica_banks` | GET | `id_anagrafica` | ✅ schema OK |
| `/api_anagrafica_set_default_bank` | POST | body | schema OK |
| `/api_anagrafica_vat_declarations` | GET/POST | body | schema OK |
| `/api_anagrafica_vies` | POST | `pi_cf`, `country` | schema OK |
| `/api_anagrafica_scaglioni` | GET | `id_anagrafica` | schema OK |
| `/api_anagrafica_service_config` | GET/POST | `id_anagrafica` | schema OK |
| `/api_anagrafica_cargo_margins` | GET/POST | `id_anagrafica` | schema OK |
| `/api_contact_types` | GET | (none) | schema OK |
| `/api_listini` | GET | (none for list) | ✅ 50 listini (tipo C/F) |
| `/api_listini_pack` | GET | `listino_id` or `pack_id` | schema OK |
| `/api_listini_prices` | GET | `pack_id` | schema OK |
| `/api_listini_supplements` | GET | `pack_id` or `?types=1` | schema OK |
| `/api_listini_assignments` | GET | `id_anagrafica` or `id` | ⚠️ 500 SQL error (see §10) |
| `/api_listini_rate_lookup` | GET | `id_anagrafica`, `id_servizio`, `peso`, `zona` | schema OK |
| `/api_listini_import` | POST | body | schema OK |
| `/api_listini_export` | GET | filters | schema OK |
| `/api_commercial_contact` | GET | (none) | ✅ data returned |
| `/api_commercial_contact_crud` | GET/POST/PATCH/DELETE | body | ✅ |
| `/api_commercial_contact_single` | GET | `id` | schema OK |
| `/rubrica_search` | GET | `q` | schema OK |
| `/rubrica_set_preferred` | POST | body | schema OK |
| `/api_my_status` | GET | (none) | ✅ tier + scopes |
| `/api_webhook` | GET/POST/DELETE | body | ✅ |
| `/get-api-countries` | GET | (none) | ✅ |
| `/get-api-good-type` | GET | (none) | ✅ |
| `/cap_city_prov` | GET | `cap` or `iso` | ✅ |

#### Outbound flows (post-MVP, but verified)

| Endpoint | Method | Verified |
|---|---|---|
| `/ext_my_shipments` | GET | ✅ |
| `/ext_cargo_shipments` | GET | ✅ paginated |
| `/ext_cargo_shipment_create` | POST | schema OK |
| `/ext_shipment_addresses` | POST/PUT | schema OK |
| `/ext_cargo_packages` | POST | schema OK |
| `/ext_cargo_rate` | POST | schema OK |
| `/ext_cargo_rate_realtime` | POST | schema OK (SSE) |
| `/ext_cargo_booking` | POST | schema OK |
| `/ext_tracking?shipment_id=…` | GET | ✅ returns `signature[]`, `tracking[]` |

### 2.5 Known issues to escalate to TMWE

- `GET /api_listini_assignments?id_anagrafica=1` → HTTP 500 with `Unknown column 'sf.descrizione' in 'order clause'`. Server-side bug.
- `GET /api_invoices` and `/api_proforma_invoices` → HTTP 403 even with all scopes granted. Likely require an admin role beyond OAuth scopes.
- `GET /api_currency_convert` → HTTP 500. Server-side bug.

These can be worked around (skip / disable in UI) but should be reported.

---

## 3. Architecture

```
React frontend (src/v2/integrations/tmwe/...)
   │
   ▼  invokeEdge<T>("tmwe-<action>", { body, context })
Supabase Edge Functions (supabase/functions/tmwe-*/index.ts)
   ├─ tmwe-token              (internal — token cache + refresh)
   ├─ tmwe-status             (smoke test — GET /api_my_status)
   ├─ tmwe-anagrafica-list    (GET /api_anagrafica_crud)
   ├─ tmwe-anagrafica-detail  (parallel: addresses + contacts + banks)
   ├─ tmwe-listini-list       (GET /api_listini)
   ├─ tmwe-listini-detail     (pack + prices + supplements)
   ├─ tmwe-rate-lookup        (GET /api_listini_rate_lookup)
   ├─ tmwe-shipment-create    (POST cargo flow — phase 2)
   ├─ tmwe-tracking           (GET /ext_tracking — phase 2)
   ├─ tmwe-webhook-subscribe  (POST /api_webhook — phase 2)
   └─ tmwe-webhook-receive    (inbound — phase 2)
   │
   ▼  fetch with cached Bearer token
TMWE API (sandbox.findair.net / erp.tmwe.it)
```

### 3.1 Shared client (`supabase/functions/_shared/tmweClient.ts`)

```ts
// Pseudocode — to be expanded during implementation
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const TMWE_BASE_URL = Deno.env.get("TMWE_BASE_URL")!;          // e.g. https://sandbox.findair.net/erp/tmwe_json
const TMWE_CLIENT_ID = Deno.env.get("TMWE_CLIENT_ID")!;
const TMWE_CLIENT_SECRET = Deno.env.get("TMWE_CLIENT_SECRET")!;

export async function getTmweToken(): Promise<string> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: cached } = await supabase
    .from("tmwe_oauth_token")
    .select("access_token, expires_at")
    .eq("id", 1)
    .maybeSingle();

  const now = Date.now();
  if (cached && new Date(cached.expires_at).getTime() - now > 60_000) {
    return cached.access_token;
  }

  const res = await fetch(`${TMWE_BASE_URL}/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: TMWE_CLIENT_ID,
      client_secret: TMWE_CLIENT_SECRET,
    }),
  });
  if (!res.ok) throw new Error(`TMWE token fetch failed: ${res.status}`);
  const json = await res.json() as { access_token: string; expires_in: number };

  await supabase.from("tmwe_oauth_token").upsert({
    id: 1,
    access_token: json.access_token,
    token_type: "Bearer",
    expires_at: new Date(now + (json.expires_in - 60) * 1000).toISOString(),
    updated_at: new Date().toISOString(),
  });

  return json.access_token;
}

export async function tmweFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  let token = await getTmweToken();
  let res = await doFetch(token);

  if (res.status === 401) {
    // Stale token — invalidate cache and retry once.
    await invalidateCache();
    token = await getTmweToken();
    res = await doFetch(token);
  }

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`TMWE ${res.status} ${path}: ${body.slice(0, 500)}`);
  }
  return await res.json() as T;

  async function doFetch(t: string): Promise<Response> {
    return fetch(`${TMWE_BASE_URL}${path}`, {
      ...init,
      headers: {
        ...(init.headers ?? {}),
        Authorization: `Bearer ${t}`,
        Accept: "application/json",
      },
    });
  }
}

async function invalidateCache(): Promise<void> {
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
  await supabase.from("tmwe_oauth_token").update({ expires_at: new Date(0).toISOString() }).eq("id", 1);
}
```

Each TMWE Edge Function follows the existing template — see [supabase/functions/get-wca-credentials/index.ts](../supabase/functions/get-wca-credentials/index.ts) — and reuses:

- [supabase/functions/_shared/cors.ts](../supabase/functions/_shared/cors.ts) — `corsPreflight`, `getCorsHeaders`.
- [supabase/functions/_shared/handleEdgeError.ts](../supabase/functions/_shared/handleEdgeError.ts) — `edgeError(...)`, `extractErrorMessage(...)`.
- [supabase/functions/_shared/authGuard.ts](../supabase/functions/_shared/authGuard.ts) — JWT validation of the calling CRM user.

### 3.2 Caller-side wrapper

Reuse the existing `invokeEdge<T>()` from [src/lib/api/invokeEdge.ts](../src/lib/api/invokeEdge.ts:38). All TMWE-specific React hooks live under `src/v2/integrations/tmwe/`.

---

## 4. Database migration

New file: `supabase/migrations/<timestamp>_tmwe_integration.sql`.

```sql
-- 4.1 Cached OAuth token (single row, server-side only)
CREATE TABLE public.tmwe_oauth_token (
  id           int  PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  access_token text NOT NULL,
  token_type   text NOT NULL DEFAULT 'Bearer',
  expires_at   timestamptz NOT NULL,
  scope        text,
  updated_at   timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_oauth_token ENABLE ROW LEVEL SECURITY;
-- No policies => only SERVICE_ROLE can read/write (Edge Functions only).

-- 4.2 Quote snapshots (request + response stored verbatim for audit)
CREATE TABLE public.tmwe_quotes (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  partner_id    uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  user_id       uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  request       jsonb NOT NULL,
  response      jsonb NOT NULL,
  tmwe_listino  text,
  total_amount  numeric,
  currency      text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_quotes ENABLE ROW LEVEL SECURITY;
CREATE POLICY tmwe_quotes_select ON public.tmwe_quotes FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tmwe_quotes_insert ON public.tmwe_quotes FOR INSERT WITH CHECK (auth.uid() = user_id);

-- 4.3 Shipment mirror (status + identifiers; full payload stays in TMWE)
CREATE TABLE public.tmwe_shipments (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tmwe_id         text NOT NULL UNIQUE,
  partner_id      uuid REFERENCES public.partners(id) ON DELETE SET NULL,
  user_id         uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  status          text NOT NULL DEFAULT 'draft',
  awb             text,
  tracking_url    text,
  payload         jsonb NOT NULL,
  last_synced_at  timestamptz NOT NULL DEFAULT now(),
  created_at      timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_shipments ENABLE ROW LEVEL SECURITY;
CREATE POLICY tmwe_shipments_select ON public.tmwe_shipments FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY tmwe_shipments_insert ON public.tmwe_shipments FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY tmwe_shipments_update ON public.tmwe_shipments FOR UPDATE USING (auth.uid() = user_id);

-- 4.4 Webhook event log (HMAC-verified inbound)
CREATE TABLE public.tmwe_webhook_events (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type   text NOT NULL,
  tmwe_id      text,
  payload      jsonb NOT NULL,
  signature_ok boolean NOT NULL,
  received_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_webhook_events ENABLE ROW LEVEL SECURITY;
-- Read-only via SERVICE_ROLE; UI fetches via Edge Function.

-- 4.5 Optional cache of master data (to avoid hammering TMWE)
CREATE TABLE public.tmwe_anagrafica_cache (
  id_anagrafica  text PRIMARY KEY,
  rag_soc        text,
  tipo           text,
  pi_cf          text,
  payload        jsonb NOT NULL,
  fetched_at     timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.tmwe_anagrafica_cache ENABLE ROW LEVEL SECURITY;
CREATE POLICY tmwe_anagra_select ON public.tmwe_anagrafica_cache FOR SELECT USING (true);
-- Writes only via SERVICE_ROLE.
```

> **Note on the partner link**. The CRM's `partners` table refers to WCA freight forwarders, while a TMWE `anagrafica` is a TMWE-side customer/supplier record. The mapping is **opt-in per partner**: add a `tmwe_anagrafica_id text` column to `partners` (nullable). Setting it links a CRM partner to a TMWE anagrafica. The migration must include:

```sql
ALTER TABLE public.partners ADD COLUMN IF NOT EXISTS tmwe_anagrafica_id text;
CREATE INDEX IF NOT EXISTS partners_tmwe_anagrafica_idx ON public.partners(tmwe_anagrafica_id);
```

---

## 5. Edge Functions

All under `supabase/functions/tmwe-*/index.ts`. Each one follows the auth-guard + CORS + edgeError pattern.

| Function | Purpose | TMWE call | Inputs | Output |
|---|---|---|---|---|
| `tmwe-token` | Internal — cache & refresh OAuth token. **Not invoked from frontend.** | `POST /token` | none | `{ access_token, expires_at }` |
| `tmwe-status` | Connection health check for the Settings card. | `GET /api_my_status` | none | `{ tier, scopes[], company_name, status }` |
| `tmwe-anagrafica-list` | List anagrafiche (paginated, optional `tipo` filter). | `GET /api_anagrafica_crud` | `{ tipo?, search?, page?, limit? }` | `{ data: Anagrafica[], total }` |
| `tmwe-anagrafica-detail` | Full detail of one anagrafica — fetched in parallel. | `GET /api_anagrafica_crud?id=…` + `_addresses` + `_contacts` + `_banks` | `{ id_anagrafica }` | `{ anagrafica, addresses[], contacts[], banks[] }` |
| `tmwe-anagrafica-link` | Persist `partners.tmwe_anagrafica_id`. | (DB only) | `{ partner_id, id_anagrafica }` | `{ ok: true }` |
| `tmwe-listini-list` | List rate cards. | `GET /api_listini` | `{ tipo?: 'C' \| 'F' }` | `{ data: Listino[] }` |
| `tmwe-listini-detail` | Pack + prices + supplements for one listino. | `GET /api_listini_pack` + `_prices` + `_supplements` | `{ listino_id }` | `{ pack, prices[], supplements[] }` |
| `tmwe-rate-lookup` | Quick price lookup for a partner. | `GET /api_listini_rate_lookup` | `{ id_anagrafica, id_servizio, peso, zona }` | `{ price, currency, breakdown }` |
| `tmwe-shipment-create` *(phase 2)* | Create cargo shipment from a CRM partner. | `POST /ext_cargo_shipment_create` + `/ext_shipment_addresses` + `/ext_cargo_packages` | `{ partner_id, origin, destination, packages[] }` | `{ tmwe_id, status }` |
| `tmwe-tracking` *(phase 2)* | On-demand tracking pull. | `GET /ext_tracking?shipment_id=…` | `{ tmwe_id }` | `{ events[], signature[] }` |
| `tmwe-webhook-subscribe` *(phase 2)* | Register the inbound webhook. | `POST /api_webhook` | `{ events[] }` | `{ subscription_id, secret }` |
| `tmwe-webhook-receive` *(phase 2)* | Inbound — verify HMAC, persist event, dispatch. | n/a | TMWE webhook payload | `200` |

### 5.1 Reference template

Each function should start from the pattern of [supabase/functions/get-wca-credentials/index.ts](../supabase/functions/get-wca-credentials/index.ts):

1. `corsPreflight(req)` short-circuit for `OPTIONS`.
2. Read `Authorization: Bearer <jwt>` and validate via `authClient.auth.getUser(token)`.
3. On failure → `edgeError('AUTH_REQUIRED', ...)` / `edgeError('AUTH_INVALID', ...)`.
4. On success → call `tmweFetch<T>(path, init)`, return `{ data }` JSON with CORS headers.
5. Wrap in try/catch → `edgeError('INTERNAL_ERROR', extractErrorMessage(e))`.

### 5.2 Register in `supabase/config.toml`

Add a `[functions.tmwe-<name>]` block per function (or use `verify_jwt = true` for everything except `tmwe-webhook-receive`, which **must have `verify_jwt = false`** because TMWE will call it without a Supabase JWT).

---

## 6. Secrets

Add to Supabase project secrets (no `.env` checked in):

| Key | Example value |
|---|---|
| `TMWE_BASE_URL` | `https://sandbox.findair.net/erp/tmwe_json` (staging) → `https://erp.tmwe.it/erp/tmwe_json` (prod) |
| `TMWE_CLIENT_ID` | (provided by TMWE) |
| `TMWE_CLIENT_SECRET` | (provided by TMWE) |
| `TMWE_WEBHOOK_SECRET` | (issued when phase-2 webhook is registered) |

Document the keys (without values) in `.env.example`.

---

## 7. Frontend

### 7.1 Generated types

In `package.json` add:
```json
"scripts": {
  "tmwe:types": "openapi-typescript https://sandbox.findair.net/erp/tmwe_json/openapi_spec?spec=main -o src/types/tmwe-generated.d.ts"
}
```

Run the script after the integration is connected to fetch + parse with bearer auth (or check the spec into the repo manually for now since the endpoint requires a token — see §10 for the fetch-during-build approach).

### 7.2 Folders

```
src/v2/integrations/tmwe/
├── api.ts                       # invokeEdge wrappers, one per Edge Function
├── hooks/
│   ├── useTmweStatus.ts
│   ├── useTmweAnagrafica.ts
│   ├── useTmweAnagraficaDetail.ts
│   ├── useTmweListini.ts
│   └── useTmweRateLookup.ts
├── components/
│   ├── TmweSettingsCard.tsx     # mounted in Settings v2
│   ├── PartnerTmweTab.tsx       # mounted in Partner Detail v2
│   ├── AnagraficaPicker.tsx     # autocompletes the link CRM partner ⇄ TMWE anagrafica
│   ├── ListiniTable.tsx
│   ├── RateLookupForm.tsx
│   └── QuoteHistoryList.tsx
└── types.ts                     # re-exports from tmwe-generated.d.ts
```

### 7.3 Settings card behaviour

- On mount → `invokeEdge('tmwe-status', { context: 'tmweSettings' })`.
- Show: `company_name`, `tier`, scopes count, last successful call.
- Buttons: **Test connection** (re-runs `tmwe-status`), **Refresh token** (calls `tmwe-token` directly to force a re-fetch).
- No credential inputs (single-tenant, secrets in Supabase only).

### 7.4 Partner Detail tab "TMWE"

- If `partner.tmwe_anagrafica_id` is null → show `AnagraficaPicker` (calls `tmwe-anagrafica-list` with debounced search).
- Once linked → display three sub-sections, each lazy-loaded:
  1. **Anagrafica** — addresses + contacts + banks (from `tmwe-anagrafica-detail`).
  2. **Listini assegnati** — list of rate cards (from `tmwe-listini-list` filtered by `id_anagrafica` once §10's `assignments` bug is fixed; in the meantime show all listini).
  3. **Quick rate** — `RateLookupForm` calling `tmwe-rate-lookup`.
- Optional **Quote history** card: rows from `tmwe_quotes` filtered by `partner_id`.

---

## 8. Implementation order

Each step is a separate PR-sized chunk. Steps 1–3 unblock the rest.

1. **DB migration** (§4). Create the four tables + the `tmwe_anagrafica_id` column on `partners`.
2. **Shared client** — `supabase/functions/_shared/tmweClient.ts` with the `getTmweToken` + `tmweFetch` helpers. Add unit tests under `_shared/` covering: cache hit, cache miss + fetch, 401-retry, fetch failure.
3. **`tmwe-token` + `tmwe-status` Edge Functions**. Smoke-test from the Lovable preview to confirm secrets + routing.
4. **`tmwe-anagrafica-list` + `tmwe-anagrafica-detail`** + their hooks + `AnagraficaPicker`.
5. **`tmwe-listini-list` + `tmwe-listini-detail`** + `ListiniTable`.
6. **`tmwe-rate-lookup`** + `RateLookupForm` + persistence to `tmwe_quotes`.
7. **Settings card** + **Partner Detail tab** wired up. End-to-end UAT with a real partner.
8. **Phase 2** (separate plan): `tmwe-shipment-create`, `tmwe-tracking`, webhooks.

---

## 9. Verification

End-to-end checks once everything is deployed:

1. `supabase functions invoke tmwe-token` → returns `{ access_token, expires_at }`. Run twice — second invocation must hit the DB cache (no extra `/token` request to TMWE; verify by enabling debug logs).
2. `supabase functions invoke tmwe-status` → returns `{ tier: 'standard', company_name: 'tmwe', scopes: [...] }`.
3. From a fresh browser session, open Settings → see the green **TMWE connected** card.
4. Open any Partner Detail → click **Link to TMWE anagrafica** → search → pick → verify `partners.tmwe_anagrafica_id` is set in the DB.
5. The **TMWE** tab loads anagrafica detail (addresses + contacts + banks) in under 2 s.
6. Run a quick rate lookup with a known service+weight+zone → row appears in `tmwe_quotes`.
7. Unit tests: `npm run test -- tmwe`. Coverage target: ≥80 % on `tmweClient.ts` (cache logic is the failure-prone bit).
8. E2E: Playwright spec `e2e/tmwe-integration.spec.ts` covering the Settings card and the link-and-fetch flow against a mocked Edge Function (`MSW`) — do **not** call the real sandbox in CI.

---

## 10. Open items / blockers

- **`/api_listini_assignments` returns 500** (`Unknown column 'sf.descrizione' in 'order clause'`). Workaround: in `tmwe-anagrafica-detail` fall back to listing all listini (`/api_listini`) and filter by `id_anagr_titolare`. Re-enable once TMWE patches the SQL.
- **`/api_invoices` and `/api_proforma_invoices` return 403** even with all scopes. Out of scope for v1; revisit when TMWE confirms whether an admin role is required.
- **`/api_currency_convert` returns 500**. Use a static currency rate or another provider for now.
- **Build-time type generation**. The `openapi_spec` endpoint requires a Bearer token, so the npm script in §7.1 needs the token at build time. Two options:
  - Easy: commit `src/types/tmwe-generated.d.ts` to the repo and regenerate manually with `curl -H "Authorization: Bearer …" … | openapi-typescript - -o …`.
  - Cleaner: a CI job that fetches a token (using CI secrets), downloads the spec, and commits the regenerated types via PR.
- **Production base URL**. Confirm with TMWE whether `https://erp.tmwe.it/erp/tmwe_json` is the final prod URL. The `oauth2-api.yaml` spec lists it; verify before flipping `TMWE_BASE_URL` in production secrets.

---

## 11. Files to create / modify (summary)

**Create**
- `supabase/migrations/<timestamp>_tmwe_integration.sql`
- `supabase/functions/_shared/tmweClient.ts`
- `supabase/functions/_shared/tmweClient.test.ts`
- `supabase/functions/tmwe-token/index.ts`
- `supabase/functions/tmwe-status/index.ts`
- `supabase/functions/tmwe-anagrafica-list/index.ts`
- `supabase/functions/tmwe-anagrafica-detail/index.ts`
- `supabase/functions/tmwe-anagrafica-link/index.ts`
- `supabase/functions/tmwe-listini-list/index.ts`
- `supabase/functions/tmwe-listini-detail/index.ts`
- `supabase/functions/tmwe-rate-lookup/index.ts`
- `src/types/tmwe-generated.d.ts` (generated, see §10)
- `src/v2/integrations/tmwe/api.ts`
- `src/v2/integrations/tmwe/hooks/useTmweStatus.ts`
- `src/v2/integrations/tmwe/hooks/useTmweAnagrafica.ts`
- `src/v2/integrations/tmwe/hooks/useTmweAnagraficaDetail.ts`
- `src/v2/integrations/tmwe/hooks/useTmweListini.ts`
- `src/v2/integrations/tmwe/hooks/useTmweRateLookup.ts`
- `src/v2/integrations/tmwe/components/TmweSettingsCard.tsx`
- `src/v2/integrations/tmwe/components/PartnerTmweTab.tsx`
- `src/v2/integrations/tmwe/components/AnagraficaPicker.tsx`
- `src/v2/integrations/tmwe/components/ListiniTable.tsx`
- `src/v2/integrations/tmwe/components/RateLookupForm.tsx`
- `src/v2/integrations/tmwe/components/QuoteHistoryList.tsx`
- `e2e/tmwe-integration.spec.ts`

**Modify**
- `supabase/config.toml` — register the new Edge Functions; `verify_jwt = false` only for `tmwe-webhook-receive`.
- Settings page (v2) — mount `<TmweSettingsCard />`.
- Partner Detail page (v2) — add **TMWE** tab and mount `<PartnerTmweTab />`.
- `package.json` — add `"tmwe:types"` script.
- `.env.example` — document `TMWE_BASE_URL`, `TMWE_CLIENT_ID`, `TMWE_CLIENT_SECRET`, `TMWE_WEBHOOK_SECRET`.

**Reuse (do not modify)**
- [src/lib/api/invokeEdge.ts](../src/lib/api/invokeEdge.ts) — central wrapper.
- [supabase/functions/_shared/cors.ts](../supabase/functions/_shared/cors.ts), [handleEdgeError.ts](../supabase/functions/_shared/handleEdgeError.ts), [authGuard.ts](../supabase/functions/_shared/authGuard.ts).
- Pattern from [supabase/functions/get-wca-credentials/index.ts](../supabase/functions/get-wca-credentials/index.ts) as the per-function template.
