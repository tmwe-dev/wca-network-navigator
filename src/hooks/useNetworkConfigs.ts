import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

export interface NetworkConfig {
  id: string;
  network_name: string;
  is_member: boolean;
  has_contact_emails: boolean;
  has_contact_names: boolean;
  has_contact_phones: boolean;
  sample_tested_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export function useNetworkConfigs() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: ["network-configs"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("network_configs")
        .select("*")
        .order("network_name");
      if (error) throw error;
      return data as NetworkConfig[];
    },
  });

  const updateConfig = useMutation({
    mutationFn: async (config: Partial<NetworkConfig> & { id: string }) => {
      const { error } = await supabase
        .from("network_configs")
        .update(config)
        .eq("id", config.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-configs"] });
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const addNetwork = useMutation({
    mutationFn: async (networkName: string) => {
      const { error } = await supabase
        .from("network_configs")
        .insert({ network_name: networkName, is_member: true });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["network-configs"] });
      toast({ title: "Network aggiunto" });
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  return { ...query, updateConfig, addNetwork };
}
