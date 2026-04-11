import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { findWorkPlans, createWorkPlan, updateWorkPlan, deleteWorkPlan } from "@/data/workPlans";
import { getAppSetting } from "@/data/appSettings";

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
      return findWorkPlans(user.id, [TAG]) as Promise<unknown> as Promise<OperativeJob[]>;
    },
  });

  const createJob = useMutation({
    mutationFn: async (input: { title: string; description: string; channels: string[]; deadline?: string }) => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const steps = { channels: input.channels, deadline: input.deadline || null, target: "" };
      return createWorkPlan({
        title: input.title, description: input.description,
        steps: JSON.parse(JSON.stringify(steps)), metadata: JSON.parse("{}"),
        tags: [TAG], status: "running", user_id: user.id,
      }) as Promise<unknown> as Promise<OperativeJob>;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Job creato"); },
    onError: (e: any) => toast.error(e.message || "Errore creazione job"),
  });

  const updateStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: string }) => {
      const upd: any = { status };
      if (status === "completed") upd.completed_at = new Date().toISOString();
      await updateWorkPlan(id, upd);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError: (e: any) => toast.error(e.message),
  });

  const deleteJobMut = useMutation({
    mutationFn: (id: string) => deleteWorkPlan(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Job eliminato"); },
    onError: (e: any) => toast.error(e.message),
  });

  const generatePrompt = useMutation({
    mutationFn: async (job: OperativeJob) => {
      const { data: { user } } = await supabase.auth.getUser();
      const stratValue = user ? await getAppSetting("operative_strategy", user.id) : null;
      const strategy = stratValue ? JSON.parse(stratValue) : {};

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
        body: { messages: [{ role: "system", content: systemMsg }, { role: "user", content: userMsg }] },
        context: "useOperativeJobs.generatePrompt",
      });

      const prompt = res?.response || res?.content || "Prompt non generato";
      await updateWorkPlan(job.id, {
        metadata: { ...(job.metadata || {}), generated_prompt: prompt, prompt_generated_at: new Date().toISOString() } as any,
      });
      return prompt;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Prompt AI generato"); },
    onError: (e: any) => toast.error(e.message || "Errore generazione prompt"),
  });

  const savePrompt = useMutation({
    mutationFn: async ({ id, prompt, currentMeta }: { id: string; prompt: string; currentMeta: any }) => {
      await updateWorkPlan(id, {
        metadata: { ...(currentMeta || {}), generated_prompt: prompt, prompt_generated_at: new Date().toISOString() } as any,
      });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: key }); toast.success("Prompt salvato"); },
    onError: (e: any) => toast.error(e.message),
  });

  return { jobs: query.data ?? [], isLoading: query.isLoading, createJob, updateStatus, deleteJob: deleteJobMut, generatePrompt, savePrompt };
}
