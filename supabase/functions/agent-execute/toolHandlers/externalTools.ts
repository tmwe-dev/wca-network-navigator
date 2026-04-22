import { resolvePartnerId } from "../shared.ts";

export async function handleEnrichPartnerWebsite(
  args: Record<string, unknown>,
  authHeader: string
): Promise<unknown> {
  let pid = args.partner_id as string;

  if (!pid && args.company_name) {
    const r = await resolvePartnerId(args);
    if (r) pid = r.id;
  }

  if (!pid) {
    return { error: "Partner non trovato" };
  }

  console.warn(
    "[LEGACY] agent-execute → enrich_partner_website: preferire Deep Search client-side."
  );

  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/enrich-partner-website`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify({ partner_id: pid }),
    }
  );

  const data = await response.json();
  return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
}

export async function handleGenerateAliases(
  args: Record<string, unknown>,
  authHeader: string
): Promise<unknown> {
  const body: Record<string, unknown> = {
    type: args.type || "company",
    limit: Number(args.limit) || 20,
  };

  if (args.partner_ids) {
    body.partner_ids = args.partner_ids;
  }

  if (args.country_code) {
    body.country_code = String(args.country_code).toUpperCase();
  }

  const response = await fetch(
    `${Deno.env.get("SUPABASE_URL")}/functions/v1/generate-aliases`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: authHeader,
      },
      body: JSON.stringify(body),
    }
  );

  const data = await response.json();
  return response.ok ? { success: true, ...data } : { error: data.error || "Errore" };
}

export async function handleScanDirectory(): Promise<unknown> {
  return {
    error:
      "Funzione scrape-wca-directory rimossa. Il download directory è ora gestito dal sistema esterno wca-app.",
  };
}

export async function handleSuggestNextContacts(
  args: Record<string, unknown>
): Promise<unknown> {
  const url = Deno.env.get("SUPABASE_URL")!;
  const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const res = await fetch(`${url}/functions/v1/ai-arena-suggest`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      focus: args.focus || "tutti",
      preferred_channel: args.channel || "email",
      batch_size: Math.min(Number(args.batch_size) || 5, 10),
      excluded_ids: [],
    }),
  });

  if (!res.ok) {
    return { error: await res.text() };
  }

  return await res.json();
}
