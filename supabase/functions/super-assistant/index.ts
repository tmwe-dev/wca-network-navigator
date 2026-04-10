import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SYSTEM_PROMPT = `Sei il Super Consulente Strategico del sistema WCA Network Navigator.

# RUOLO
Sei al di sopra di tutti gli agenti AI del sistema, incluso Luca (il Director). Il tuo ruolo è:
- Affiancare l'utente come partner strategico nella gestione quotidiana del business
- Ragionare, pianificare, consigliare — NON eseguire comandi operativi
- Creare e aggiornare il Piano Giornaliero (Daily Plan) con obiettivi e priorità
- Analizzare la situazione del sistema e proporre strategie
- Suggerire quali agenti attivare per quali compiti
- Rivedere e ottimizzare i prompt degli agenti se richiesto
- Mantenere memoria delle conversazioni passate per continuità

# CONOSCENZA
Hai accesso a:
- Stato completo del sistema (partner, contatti, campagne, job attivi)
- Knowledge Base commerciale completa (tecniche di vendita, negoziazione)
- Procedure operative di tutti gli agenti
- Memoria delle sessioni precedenti
- Piano giornaliero corrente

# STILE
- Parla in italiano in modo professionale ma amichevole
- Sii proattivo: suggerisci azioni, identifica opportunità
- Quando crei il daily plan, usa formato strutturato con priorità
- Ogni 10 messaggi nella conversazione, proponi un breve riassunto della sessione
- Rispondi in modo conciso ma completo

# DAILY PLAN
Quando l'utente discute di obiettivi o attività:
- Proponi una struttura del piano con priorità (Alta/Media/Bassa)
- Suggerisci assegnazioni agli agenti specifici
- Monitora il progresso durante la conversazione

# CONTESTO ATTUALE
`;

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const apiKey = Deno.env.get("LOVABLE_API_KEY");

    // Get user from token
    const supabase = createClient(supabaseUrl, serviceKey);
    const token = authHeader?.replace("Bearer ", "");
    let userId: string | null = null;

    if (token) {
      const { data: { user } } = await supabase.auth.getUser(token);
      userId = user?.id ?? null;
    }

    const { messages, pageContext, systemStats } = await req.json();

    // Fetch context data in parallel
    const contextParts: string[] = [];

    // Load user profile from app_settings
    const { data: aiSettings } = await supabase
      .from("app_settings")
      .select("key, value")
      .like("key", "ai_%");

    if (aiSettings?.length) {
      const get = (k: string) => aiSettings.find((s: any) => s.key === k)?.value?.trim() || "";
      const profileParts: string[] = [];
      if (get("ai_company_name")) profileParts.push(`Azienda: ${get("ai_company_name")} (${get("ai_company_alias")})`);
      if (get("ai_contact_name")) profileParts.push(`Referente: ${get("ai_contact_name")} — ${get("ai_contact_role")}`);
      if (get("ai_current_focus")) profileParts.push(`🎯 FOCUS CORRENTE: ${get("ai_current_focus")}`);
      if (get("ai_company_activities")) profileParts.push(`Attività: ${get("ai_company_activities")}`);
      if (get("ai_business_goals")) profileParts.push(`Obiettivi: ${get("ai_business_goals")}`);
      if (get("ai_behavior_rules")) profileParts.push(`Regole: ${get("ai_behavior_rules")}`);
      if (profileParts.length) contextParts.push(`## Profilo Utente\n${profileParts.join("\n")}`);
    }

    if (systemStats) {
      contextParts.push(`## Statistiche Sistema\n${JSON.stringify(systemStats, null, 2)}`);
    }
    if (pageContext) {
      contextParts.push(`## Pagina Corrente: ${pageContext}`);
    }

    // Fetch daily plan, recent memories, and KB entries
    if (userId) {
      const [dailyPlan, memories, kbEntries] = await Promise.all([
        supabase
          .from("ai_daily_plans")
          .select("*")
          .eq("user_id", userId)
          .eq("plan_date", new Date().toISOString().split("T")[0])
          .maybeSingle(),
        supabase
          .from("ai_memory")
          .select("content, tags, created_at")
          .eq("user_id", userId)
          .order("created_at", { ascending: false })
          .limit(10),
        supabase
          .from("kb_entries")
          .select("title, content, category, tags")
          .eq("user_id", userId)
          .eq("is_active", true)
          .gte("priority", 7)
          .order("priority", { ascending: false })
          .limit(10),
      ]);

      if (dailyPlan.data) {
        contextParts.push(
          `## Piano Giornaliero (${dailyPlan.data.plan_date})\nObiettivi: ${JSON.stringify(dailyPlan.data.objectives)}\nCompletati: ${JSON.stringify(dailyPlan.data.completed)}\nNote: ${dailyPlan.data.notes || "nessuna"}`
        );
      }

      if (memories.data && memories.data.length > 0) {
        const memStr = memories.data
          .map((m: any) => `[${m.tags?.join(", ") || "gen"}] ${m.content}`)
          .join("\n");
        contextParts.push(`## Memorie Recenti\n${memStr}`);
      }

      if (kbEntries.data && kbEntries.data.length > 0) {
        const kbStr = kbEntries.data
          .map((e: any) => `### ${e.title} [${e.tags?.join(", ") || e.category}]\n${e.content}`)
          .join("\n\n");
        contextParts.push(`## Knowledge Base\n${kbStr}`);
      }
    }

    const fullSystemPrompt = SYSTEM_PROMPT + contextParts.join("\n\n");

    // Check if we should auto-summarize (every 10 messages)
    const shouldSummarize = messages.length > 0 && messages.length % 10 === 0;

    // Call AI
    if (!apiKey) {
      throw new Error("LOVABLE_API_KEY not configured");
    }

    const aiResponse = await fetch("https://ai.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullSystemPrompt },
          ...messages,
        ],
        temperature: 0.7,
        max_tokens: 4096,
      }),
    });

    if (!aiResponse.ok) {
      const err = await aiResponse.text();
      throw new Error(`AI error: ${aiResponse.status} - ${err}`);
    }

    const aiData = await aiResponse.json();
    const content = aiData.choices?.[0]?.message?.content || "Nessuna risposta";

    // Auto-summarize every 10 messages
    if (shouldSummarize && userId) {
      const last10 = messages.slice(-10);
      const summaryPrompt = `Riassumi in 2-3 righe questa conversazione operativa:\n${last10.map((m: any) => `${m.role}: ${m.content}`).join("\n")}`;

      const summaryResp = await fetch("https://ai.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash-lite",
          messages: [{ role: "user", content: summaryPrompt }],
          max_tokens: 200,
        }),
      });

      if (summaryResp.ok) {
        const summaryData = await summaryResp.json();
        const summary = summaryData.choices?.[0]?.message?.content;
        if (summary) {
          await supabase.from("ai_memory").insert({
            user_id: userId,
            content: summary,
            memory_type: "session_summary",
            tags: ["session_summary", "daily_plan", new Date().toISOString().split("T")[0]],
            importance: 4,
            context_page: pageContext || "super-assistant",
          });
        }
      }
    }

    return new Response(JSON.stringify({ content }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("Super assistant error:", e);
    return new Response(
      JSON.stringify({ error: e.message || "Errore interno" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
