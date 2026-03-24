/**
 * useWcaVerify — Hook per verifica membro su network specifico
 * 🤖 Claude Engine V8 · Controlla esistenza e profilo su qualsiasi network WCA
 */

import { useState, useCallback } from "react";
import { wcaVerify, type VerifyResult } from "@/lib/api/wcaAppApi";

export function useWcaVerify() {
  const [isVerifying, setIsVerifying] = useState(false);
  const [lastResult, setLastResult] = useState<VerifyResult | null>(null);

  /** Verifica singolo membro su un network */
  const verify = useCallback(async (wcaId: number, network: string): Promise<VerifyResult> => {
    setIsVerifying(true);
    try {
      const result = await wcaVerify(wcaId, network);
      setLastResult(result);
      return result;
    } catch (err) {
      const result: VerifyResult = {
        success: false, found: false, wcaId, network,
        error: err instanceof Error ? err.message : "Errore verifica",
      };
      setLastResult(result);
      return result;
    } finally {
      setIsVerifying(false);
    }
  }, []);

  /** Verifica membro su TUTTI i network */
  const verifyAll = useCallback(async (
    wcaId: number,
    networkNames: string[],
    onProgress?: (current: number, total: number, networkName: string) => void,
  ): Promise<VerifyResult[]> => {
    setIsVerifying(true);
    const results: VerifyResult[] = [];

    for (let i = 0; i < networkNames.length; i++) {
      onProgress?.(i + 1, networkNames.length, networkNames[i]);
      try {
        const result = await wcaVerify(wcaId, networkNames[i]);
        results.push(result);
      } catch (err) {
        results.push({
          success: false, found: false, wcaId, network: networkNames[i],
          error: err instanceof Error ? err.message : "Errore",
        });
      }
    }

    setIsVerifying(false);
    return results;
  }, []);

  return { isVerifying, lastResult, verify, verifyAll };
}
