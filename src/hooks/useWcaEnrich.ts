/**
 * useWcaEnrich — Hook per enrichment cross-network
 * 🤖 Claude Engine V8 · Arricchisce profili cercandoli su altri network WCA
 */

import { useState, useCallback } from "react";
import { wcaEnrich, WCA_NETWORKS, type EnrichResult, type ScrapeProfile } from "@/lib/api/wcaAppApi";

export interface EnrichProgress {
  phase: "idle" | "enriching" | "done" | "error";
  current: number;
  total: number;
  message: string;
  results: EnrichResult[];
}

export function useWcaEnrich() {
  const [progress, setProgress] = useState<EnrichProgress>({
    phase: "idle", current: 0, total: 0, message: "", results: [],
  });
  const [isRunning, setIsRunning] = useState(false);

  /** Arricchisci un partner su TUTTI i network disponibili */
  const enrichPartner = useCallback(async (
    companyName: string,
    originalWcaId?: number,
    networkNames?: string[],
  ): Promise<EnrichResult[]> => {
    if (isRunning) return [];
    setIsRunning(true);

    const networks = networkNames?.length
      ? networkNames
      : Object.keys(WCA_NETWORKS).filter(n => WCA_NETWORKS[n].domain);

    const results: EnrichResult[] = [];

    setProgress({
      phase: "enriching", current: 0, total: networks.length,
      message: `Enriching "${companyName}" su ${networks.length} network...`, results: [],
    });

    for (let i = 0; i < networks.length; i++) {
      const networkName = networks[i];
      const net = WCA_NETWORKS[networkName];
      if (!net?.domain) continue;

      setProgress(prev => ({
        ...prev,
        current: i + 1,
        message: `${networkName} (${i + 1}/${networks.length})`,
      }));

      try {
        const result = await wcaEnrich(companyName, net.domain, {
          originalWcaId,
          networkName,
        });
        results.push(result);
      } catch (err) {
        results.push({
          success: false,
          enriched: false,
          error: err instanceof Error ? err.message : "Errore",
        });
      }
    }

    setProgress({
      phase: "done",
      current: networks.length,
      total: networks.length,
      message: `Enrichment completato: ${results.filter(r => r.enriched).length} trovati`,
      results,
    });
    setIsRunning(false);
    return results;
  }, [isRunning]);

  /** Arricchisci su un singolo network */
  const enrichSingle = useCallback(async (
    companyName: string,
    networkDomain: string,
    networkName?: string,
    originalWcaId?: number,
  ): Promise<EnrichResult> => {
    try {
      return await wcaEnrich(companyName, networkDomain, { originalWcaId, networkName });
    } catch (err) {
      return { success: false, enriched: false, error: err instanceof Error ? err.message : "Errore" };
    }
  }, []);

  return {
    progress,
    isRunning,
    enrichPartner,
    enrichSingle,
    networks: WCA_NETWORKS,
  };
}
