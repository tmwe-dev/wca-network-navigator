import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/hooks/use-toast";
import { queryKeys } from "@/lib/queryKeys";
import {
  findNetworkConfigs,
  updateNetworkConfig,
  insertNetworkConfig,
  type NetworkConfigRow,
} from "@/data/networkConfigs";

export type NetworkConfig = NetworkConfigRow;

export function useNetworkConfigs() {
  const queryClient = useQueryClient();

  const query = useQuery({
    queryKey: queryKeys.networkConfigs.all,
    queryFn: () => findNetworkConfigs(),
  });

  const updateConfig = useMutation({
    mutationFn: (config: Partial<NetworkConfig> & { id: string }) => updateNetworkConfig(config),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networkConfigs.all });
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  const addNetwork = useMutation({
    mutationFn: (networkName: string) => insertNetworkConfig(networkName),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.networkConfigs.all });
      toast({ title: "Network aggiunto" });
    },
    onError: (err) => {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    },
  });

  return { ...query, updateConfig, addNetwork };
}
