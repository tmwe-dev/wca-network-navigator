/**
 * IO Queries: AI Lab operative prompts
 */
import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";
import type { PostgrestError } from "@supabase/supabase-js";

export type EmailPromptRow = Database["public"]["Tables"]["email_prompts"]["Row"];

export async function fetchOperativePromptsRaw(): Promise<{
  data: Pick<EmailPromptRow, "id" | "title" | "instructions" | "is_active" | "scope">[] | null;
  error: PostgrestError | null;
}> {
  return supabase
    .from("email_prompts")
    .select("id, title, instructions, is_active, scope")
    .order("priority", { ascending: false })
    .limit(20);
}
