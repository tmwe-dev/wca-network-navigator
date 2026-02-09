import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface DownloadQueueItem {
  id: string;
  country_code: string;
  country_name: string;
  network_name: string;
  priority: number;
  id_range_start: number | null;
  id_range_end: number | null;
  status: "pending" | "in_progress" | "completed" | "paused";
  total_found: number;
  total_processed: number;
  last_processed_id: number | null;
  created_at: string;
  updated_at: string;
}

export function useDownloadQueue() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["download-queue"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("download_queue")
        .select("*")
        .order("priority", { ascending: true });
      if (error) throw error;
      return data as DownloadQueueItem[];
    },
  });

  const addToQueue = useMutation({
    mutationFn: async (items: Omit<DownloadQueueItem, "id" | "created_at" | "updated_at" | "total_found" | "total_processed" | "last_processed_id">[]) => {
      const { error } = await supabase.from("download_queue").insert(items);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-queue"] });
      toast({ title: "Paesi aggiunti alla coda" });
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const updateItem = useMutation({
    mutationFn: async (item: Partial<DownloadQueueItem> & { id: string }) => {
      const { error } = await supabase
        .from("download_queue")
        .update(item)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-queue"] });
    },
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("download_queue").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-queue"] });
    },
  });

  const clearCompleted = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("download_queue").delete().eq("status", "completed");
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["download-queue"] });
      toast({ title: "Completati rimossi dalla coda" });
    },
  });

  return { ...query, addToQueue, updateItem, removeItem, clearCompleted };
}
