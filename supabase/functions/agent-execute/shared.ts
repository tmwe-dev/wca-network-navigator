import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";
import { escapeLike } from "../_shared/sqlEscape.ts";

export const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

export interface ExecuteContext {
  agent_id?: string;
}

export { escapeLike };

export async function resolvePartnerId(args: Record<string, unknown>): Promise<{ id: string; name: string } | null> {
  if (args.partner_id) {
    const { data } = await supabase.from("partners").select("id, company_name").eq("id", args.partner_id).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  if (args.company_name) {
    const { data } = await supabase.from("partners").select("id, company_name").ilike("company_name", `%${escapeLike(args.company_name as string)}%`).limit(1).single();
    return data ? { id: data.id, name: data.company_name } : null;
  }
  return null;
}
