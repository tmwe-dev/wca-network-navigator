import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface OperativeJob {
  id: string;
  title: string;
  description: string | null;
  status: string;
  steps: { channels?: string[]; deadline?: string; target?: string };
  metadata: { generated_prompt?: string; prompt_generated_at?: string };
  tags: string[] | null;
  created_at: string;
  completed_at: string | null;
  current_step: number;
}

const TAG = "operative_job";

export function useOperativeJobs() {
  const qc = useQueryClient();
  const key = ["operative-jobs"];

  const query = useQuery({
    queryKey: key,
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return [];
      const { data, error } = await supabase
        .from("ai_work_plans")
        .select("*")
        .contains("tags", [TAG])
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as OperativeJob[];
    },
  });

  const createJob = useMutation({
    mutationFn: async (input: { title: string; description: string; channels: string[]; deadline?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const steps = { channels: input.channels, deadline: input.deadline || null, target: "" };
      const { data, error } = await supabase
        .from("ai_work_plans")
        .insert({
          title: input.title,
          description: input.description,
          steps: steps as any,
          metadata: {} as any,
          tags: [TAG],
          status: "running",
          user_id: user.id,
        })
        .select()
        .single();
      if (error) throw error;
      return data as unknown as OperativeJob;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Job creato"); },
    onError: (e: any) => toast.error(e.message || "Errore creazione job"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const upd: any = { status };
      if (status === "completed") upd.completed_at = new Date().toISOString();
      const { error } = await supabase.from("ai_work_plans").update(upd).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteJob = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ai_work_plans").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Job eliminato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const generatePrompt = useMutation({
    mutationFn: async (job: OperativeJob) => {
      // Load operative strategy for context
      const { data: stratRow } = await supabase
        .from("app_settings")
        .select("value")
        .eq("key", "operative_strategy")
        .maybeSingle();
      const strategy = stratRow?.value ? JSON.parse(stratRow.value) : {};

      const systemMsg = `Sei un manager AI operativo. Genera un prompt strutturato per gli agenti sales basandoti sulle istruzioni del job e sulla strategia aziendale.

Il prompt deve contenere:
1. **Obiettivo**: cosa deve essere raggiunto
2. **Procedura**: passi da seguire
3. **Criteri**: regole e vincoli da rispettare
4. **Esempi**: 1-2 esempi di messaggio ideale

Strategia aziendale: ${JSON.stringify(strategy)}`;

      const userMsg = `Job: "${job.title}"
Istruzioni: ${job.description || "Nessuna istruzione specifica"}
Canali: ${(job.steps?.channels || []).join(", ") || "tutti"}
Scadenza: ${job.steps?.deadline || "non specificata"}`;

      const res = await invokeEdge<any>("agent-execute", {
        body: {
          messages: [
            { role: "system", content: systemMsg },
            { role: "user", content: userMsg },
          ],
        },
        context: "useOperativeJobs.generatePrompt",
      });

      const prompt = res?.response || res?.content || "Prompt non generato";
      
      const { error } = await supabase
        .from("ai_work_plans")
        .update({
          metadata: {
            ...(job.metadata || {}),
            generated_prompt: prompt,
            prompt_generated_at: new Date().toISOString(),
          } as any,
        })
        .eq("id", job.id);
      if (error) throw error;
      return prompt;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Prompt AI generato"); },
    onError: (e: any) => toast.error(e.message || "Errore generazione prompt"),
  });

  const savePrompt = useMutation({
    mutationFn: async ({ id, prompt, currentMeta }: { id: string; prompt: string; currentMeta: any }) => {
      const { error } = await supabase
        .from("ai_work_plans")
        .update({
          metadata: { ...(currentMeta || {}), generated_prompt: prompt, prompt_generated_at: new Date().toISOString() } as any,
        })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Prompt salvato"); },
    onError: (e: any) => toast.error(e.message),
  });

  return { jobs: query.data ?? [], isLoading: query.isLoading, createJob, updateStatus, deleteJob, generatePrompt, savePrompt };
}
