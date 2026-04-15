import { Client } from "https://deno.land/x/postgres@v0.19.3/mod.ts";
import { getCorsHeaders, corsPreflight } from "../_shared/cors.ts";
import { getSecurityHeaders } from "../_shared/securityHeaders.ts";

type AuthGateAction = "is_email_authorized" | "record_user_login" | "get_user_roles";

interface AuthGateRequest {
  action?: unknown;
  email?: unknown;
  userId?: unknown;
}

function jsonResponse(origin: string | null, status: number, body: Record<string, unknown>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: getSecurityHeaders({
      ...getCorsHeaders(origin),
      "Content-Type": "application/json",
      "Cache-Control": "no-store",
    }),
  });
}

function isValidEmail(value: unknown): value is string {
  return typeof value === "string" && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

function isValidUuid(value: unknown): value is string {
  return typeof value === "string"
    && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function withClient<T>(run: (client: Client) => Promise<T>): Promise<T> {
  const connectionString = Deno.env.get("SUPABASE_DB_URL");
  if (!connectionString) throw new Error("SUPABASE_DB_URL non configurata");

  const client = new Client(connectionString);
  await client.connect();

  try {
    return await run(client);
  } finally {
    await client.end();
  }
}

Deno.serve(async (req) => {
  const preflight = corsPreflight(req);
  if (preflight) return preflight;

  const origin = req.headers.get("origin");

  try {
    const body = await req.json().catch(() => ({})) as AuthGateRequest;
    const action = body.action;

    if (action === "is_email_authorized") {
      if (!isValidEmail(body.email)) {
        return jsonResponse(origin, 400, { error: "Email non valida." });
      }

      const email = body.email.trim().toLowerCase();
      const authorized = await withClient(async (client) => {
        const result = await client.queryObject<{ is_active: boolean }>({
          text: `
            select is_active
            from public.authorized_users
            where lower(email) = lower($1)
            limit 1
          `,
          args: [email],
        });

        return result.rows[0]?.is_active === true;
      });

      return jsonResponse(origin, 200, { authorized });
    }

    if (action === "record_user_login") {
      if (!isValidEmail(body.email)) {
        return jsonResponse(origin, 400, { error: "Email non valida." });
      }

      const email = body.email.trim().toLowerCase();
      await withClient(async (client) => {
        await client.queryObject({
          text: `
            update public.authorized_users
            set last_login_at = now(),
                login_count = coalesce(login_count, 0) + 1,
                updated_at = now()
            where lower(email) = lower($1)
          `,
          args: [email],
        });
      });

      return jsonResponse(origin, 200, { success: true });
    }

    if (action === "get_user_roles") {
      if (!isValidUuid(body.userId)) {
        return jsonResponse(origin, 400, { error: "User ID non valido." });
      }

      const roles = await withClient(async (client) => {
        const result = await client.queryObject<{ role: string }>({
          text: `
            select role::text as role
            from public.user_roles
            where user_id = $1::uuid
            order by role asc
          `,
          args: [body.userId],
        });

        return result.rows.map((row) => row.role);
      });

      return jsonResponse(origin, 200, { roles });
    }

    return jsonResponse(origin, 400, { error: "Azione non supportata." });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return jsonResponse(origin, 500, { error: message });
  }
});
