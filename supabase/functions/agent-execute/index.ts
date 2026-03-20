import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.3";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader || "" } } }
    );

    const { data: { user }, error: authError } = await supabase.auth.getUser();
    if (authError || !user) {
      return new Response(JSON.stringify({ error: "Non autenticato" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { agent_id, task_id, chat_messages } = body;

    if (!agent_id) {
      return new Response(JSON.stringify({ error: "agent_id richiesto" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load agent config
    const { data: agent, error: agentErr } = await supabase
      .from("agents")
      .select("*")
      .eq("id", agent_id)
      .eq("user_id", user.id)
      .single();

    if (agentErr || !agent) {
      return new Response(JSON.stringify({ error: "Agente non trovato" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build system prompt with KB injection
    let systemPrompt = agent.system_prompt || "Sei un agente AI.";
    const kb = agent.knowledge_base as Array<{ title: string; content: string }> | null;
    if (kb && kb.length > 0) {
      systemPrompt += "\n\n--- KNOWLEDGE BASE ---\n";
      for (const entry of kb) {
        systemPrompt += `\n### ${entry.title}\n${entry.content}\n`;
      }
    }

    // If chat_messages provided, this is a conversation (not task execution)
    if (chat_messages && Array.isArray(chat_messages)) {
      const aiMessages = [
        { role: "system", content: systemPrompt },
        ...chat_messages.map((m: any) => ({ role: m.role, content: m.content })),
      ];

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: aiMessages,
          max_tokens: 2000,
        }),
      });

      if (!aiRes.ok) {
        const errText = await aiRes.text();
        console.error("AI error:", aiRes.status, errText);
        return new Response(JSON.stringify({ error: "Errore AI", response: "Mi dispiace, c'è stato un errore nella comunicazione." }), {
          status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const aiData = await aiRes.json();
      const responseText = aiData.choices?.[0]?.message?.content || "Nessuna risposta.";

      return new Response(JSON.stringify({ response: responseText }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Task execution mode
    if (task_id) {
      const { data: task, error: taskErr } = await supabase
        .from("agent_tasks")
        .select("*")
        .eq("id", task_id)
        .eq("user_id", user.id)
        .single();

      if (taskErr || !task) {
        return new Response(JSON.stringify({ error: "Task non trovato" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Mark task as running
      await supabase
        .from("agent_tasks")
        .update({ status: "running", started_at: new Date().toISOString() })
        .eq("id", task_id);

      // Execute via AI with task context
      const taskPrompt = `${systemPrompt}

--- COMPITO ASSEGNATO ---
Tipo: ${task.task_type}
Descrizione: ${task.description}
Filtri target: ${JSON.stringify(task.target_filters)}

Esegui il compito descritto sopra. Rispondi con un riepilogo chiaro delle azioni eseguite e dei risultati ottenuti.`;

      const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
      const aiRes = await fetch("https://api.lovable.dev/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: "google/gemini-2.5-flash",
          messages: [{ role: "system", content: taskPrompt }, { role: "user", content: "Esegui il compito assegnato." }],
          max_tokens: 3000,
        }),
      });

      let resultSummary = "Esecuzione completata.";
      if (aiRes.ok) {
        const aiData = await aiRes.json();
        resultSummary = aiData.choices?.[0]?.message?.content || resultSummary;
      } else {
        await aiRes.text();
        resultSummary = "Errore durante l'esecuzione del task.";
      }

      // Update task
      const currentLog = (task.execution_log as any[]) || [];
      await supabase
        .from("agent_tasks")
        .update({
          status: aiRes.ok ? "completed" : "failed",
          result_summary: resultSummary.slice(0, 5000),
          execution_log: [...currentLog, { ts: new Date().toISOString(), result: resultSummary.slice(0, 2000) }],
          completed_at: new Date().toISOString(),
        })
        .eq("id", task_id);

      // Update agent stats
      const stats = (agent.stats as any) || {};
      await supabase
        .from("agents")
        .update({
          stats: { ...stats, tasks_completed: (stats.tasks_completed || 0) + 1 },
          updated_at: new Date().toISOString(),
        })
        .eq("id", agent_id);

      return new Response(JSON.stringify({ success: true, result: resultSummary }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ error: "Specificare chat_messages o task_id" }), {
      status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    console.error("agent-execute error:", err);
    return new Response(JSON.stringify({ error: "Errore interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
