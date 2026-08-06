/**
 * DAL — Bundle di export AI (agenti, KB, prompt operativi, memorie, settings, personas).
 * Estratto da `AIExportPanel` per rimuovere query dirette dal componente.
 * Solo letture, filtrate per utente.
 */
import { supabase } from "@/integrations/supabase/client";

export async function fetchAiExportBundle(userId: string) {
  const [agentsRes, kbRes, opRes, memRes, settingsRes, personasRes] = await Promise.all([
    supabase
      .from("agents")
      .select("id,name,role,avatar_emoji,is_active,system_prompt,knowledge_base,assigned_tools,created_at")
      .eq("user_id", userId)
      .order("name"),
    supabase
      .from("kb_entries")
      .select("id,title,content,category,chapter,tags,priority,is_active,source_path,created_at")
      .or(`user_id.eq.${userId},user_id.is.null`)
      .eq("is_active", true)
      .order("category")
      .order("priority", { ascending: false }),
    supabase
      .from("operative_prompts")
      .select("id,name,context,objective,procedure,criteria,examples,priority,tags,is_active,created_at")
      .eq("user_id", userId)
      .order("priority", { ascending: false }),
    supabase
      .from("ai_memory")
      .select("id,content,memory_type,level,importance,tags,created_at")
      .eq("user_id", userId)
      .gte("level", 2)
      .order("importance", { ascending: false })
      .limit(500),
    supabase.from("app_settings").select("id,key,value,updated_at").eq("user_id", userId).order("key"),
    supabase
      .from("agent_personas")
      .select(
        "id,agent_id,tone,custom_tone_prompt,language,style_rules,vocabulary_do,vocabulary_dont,example_messages,signature_template",
      )
      .eq("user_id", userId),
  ]);

  return { agentsRes, kbRes, opRes, memRes, settingsRes, personasRes };
}
