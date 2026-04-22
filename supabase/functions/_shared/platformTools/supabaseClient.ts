/**
 * supabaseClient.ts - Shared Supabase client and utilities for platformTools modules
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

export const supabase = createClient(
  Deno.env.get("SUPABASE_URL")!,
  Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
);

// Re-export escapeLike from parent
export { escapeLike } from "../sqlEscape.ts";
