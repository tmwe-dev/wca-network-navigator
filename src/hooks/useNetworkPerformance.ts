import { useState, useCallback, useRef } from "react";
import { toast } from "@/hooks/use-toast";
import { ToastAction } from "@/components/ui/toast";
import { NetworkStats, NetworkRegression } from "@/components/acquisition/NetworkPerformanceBar";
import { QueueItem } from "@/components/acquisition/types";

export function useNetworkPerformance() {
  const [networkStats, setNetworkStats] = useState<Record<string, NetworkStats>>({});
  const [excludedNetworks, setExcludedNetworks] = useState<Set<string>>(new Set());
  const [networkRegressions, setNetworkRegressions] = useState<NetworkRegression[]>([]);
  const excludedNetworksRef = useRef<Set<string>>(new Set());
  const networkBaselineRef = useRef<Record<string, { successes: number; consecutiveFailures: number }>>({});

  const handleExcludeNetwork = useCallback((network: string) => {
    setExcludedNetworks((prev) => {
      const next = new Set(prev);
      next.add(network);
      excludedNetworksRef.current = next;
      return next;
    });
    toast({ title: `Network "${network}" escluso`, description: "I partner con solo questo network verranno saltati." });
  }, []);

  const handleReincludeNetwork = useCallback((network: string) => {
    setExcludedNetworks((prev) => {
      const next = new Set(prev);
      next.delete(network);
      excludedNetworksRef.current = next;
      return next;
    });
    toast({ title: `Network "${network}" riattivato` });
  }, []);

  /** Called from runExtensionLoop to update network stats after each partner. */
  const updateNetworkStats = useCallback((
    networks: string[],
    hasAnyContact: boolean,
    localNetworkStats: Record<string, { success: number; empty: number }>,
    autoExcludeThreshold: number,
  ) => {
    // Update local stats
    for (const net of networks) {
      if (!localNetworkStats[net]) localNetworkStats[net] = { success: 0, empty: 0 };
      if (hasAnyContact) localNetworkStats[net].success++;
      else localNetworkStats[net].empty++;
    }
    setNetworkStats({ ...localNetworkStats });

    // Auto-exclude networks with 0% success after threshold
    for (const net of networks) {
      const s = localNetworkStats[net];
      if (s && s.success === 0 && (s.success + s.empty) >= autoExcludeThreshold && !excludedNetworksRef.current.has(net)) {
        const networkToExclude = net;
        const undoTimeout = setTimeout(() => {
          excludedNetworksRef.current.add(networkToExclude);
          setExcludedNetworks(new Set(excludedNetworksRef.current));
        }, 5000);

        toast({
          title: `Network "${net}" verrà escluso`,
          description: `0/${s.empty} partner con contatti. Escluso tra 5s.`,
          action: (
            <ToastAction altText="Annulla" onClick={() => {
              clearTimeout(undoTimeout);
              toast({ title: `"${networkToExclude}" mantenuto`, description: "L'esclusione è stata annullata." });
            }}>
              Annulla
            </ToastAction>
          ),
        });
      }
    }

    // Regression detection
    for (const net of networks) {
      if (!networkBaselineRef.current[net]) {
        networkBaselineRef.current[net] = { successes: 0, consecutiveFailures: 0 };
      }
      const baseline = networkBaselineRef.current[net];
      if (hasAnyContact) {
        baseline.successes++;
        baseline.consecutiveFailures = 0;
      } else {
        baseline.consecutiveFailures++;
      }
      if (baseline.successes >= 2 && baseline.consecutiveFailures >= 3) {
        setNetworkRegressions(prev => {
          const existing = prev.find(r => r.network === net);
          if (existing) {
            return prev.map(r => r.network === net
              ? { ...r, consecutiveFailures: baseline.consecutiveFailures }
              : r
            );
          }
          return [...prev, {
            network: net,
            previousSuccesses: baseline.successes,
            consecutiveFailures: baseline.consecutiveFailures,
          }];
        });
      } else if (hasAnyContact) {
        setNetworkRegressions(prev => prev.filter(r => r.network !== net));
      }
    }
  }, []);

  const resetNetworkPerformance = useCallback(() => {
    setNetworkStats({});
    setExcludedNetworks(new Set());
    excludedNetworksRef.current = new Set();
    networkBaselineRef.current = {};
    setNetworkRegressions([]);
  }, []);

  return {
    networkStats, setNetworkStats,
    excludedNetworks, setExcludedNetworks,
    networkRegressions, setNetworkRegressions,
    networkBaselineRef, excludedNetworksRef,
    handleExcludeNetwork, handleReincludeNetwork,
    updateNetworkStats, resetNetworkPerformance,
  };
}
