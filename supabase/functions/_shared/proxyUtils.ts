/**
 * Proxy utilities for edge function consolidation.
 * Forwards requests from legacy function endpoints to macro-functions
 * with an injected routing field (scope/action).
 */
import { getCorsHeaders, corsPreflight } from "./cors.ts";

export async function proxyToMacro(
  req: Request,
  targetFunction: string,
  inject: Record<string, string>,
): Promise<Response> {
  const pre = corsPreflight(req);
  if (pre) return pre;

  const origin = req.headers.get("origin");
  const dynCors = getCorsHeaders(origin);

  const body = await req.json();
  Object.assign(body, inject);

  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${targetFunction}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": req.headers.get("Authorization") || "",
      "Content-Type": "application/json",
      "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { ...dynCors, "Content-Type": resp.headers.get("Content-Type") || "application/json" },
  });
}

/** Forward a request to an existing edge function (macro → original for complex scopes) */
export async function forwardToFunction(
  fnName: string,
  body: Record<string, unknown>,
  headers: Headers,
): Promise<Response> {
  const url = `${Deno.env.get("SUPABASE_URL")}/functions/v1/${fnName}`;
  const resp = await fetch(url, {
    method: "POST",
    headers: {
      "Authorization": headers.get("Authorization") || "",
      "Content-Type": "application/json",
      "apikey": Deno.env.get("SUPABASE_ANON_KEY") || "",
    },
    body: JSON.stringify(body),
  });

  const data = await resp.text();
  return new Response(data, {
    status: resp.status,
    headers: { ...dynCors, "Content-Type": resp.headers.get("Content-Type") || "application/json" },
  });
}
