/**
 * useWcaPartners — Hook per query partners dal DB Supabase via wca-app
 * 🤖 Claude Engine V8 · Accesso diretto al DB partners
 */

import { useState, useCallback } from "react";
import { wcaPartners, wcaCountryCounts, wcaCheckIds, type CheckIdsResult } from "@/lib/api/wcaAppApi";

export interface PartnersPage {
  partners: any[];
  total: number;
  page: number;
}

export function useWcaPartners() {
  const [isLoading, setIsLoading] = useState(false);
  const [countryCounts, setCountryCounts] = useState<Record<string, number> | null>(null);

  /** Cerca partners nel DB */
  const searchPartners = useCallback(async (options?: {
    country?: string;
    search?: string;
    page?: number;
    limit?: number;
    select?: string;
  }): Promise<PartnersPage> => {
    setIsLoading(true);
    try {
      const result = await wcaPartners(options);
      if (result.success) {
        return {
          partners: result.partners || [],
          total: result.total || 0,
          page: result.page || 1,
        };
      }
      throw new Error(result.error || "Query fallita");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Carica conteggi per paese */
  const loadCountryCounts = useCallback(async (): Promise<Record<string, number>> => {
    setIsLoading(true);
    try {
      const result = await wcaCountryCounts();
      if (result.success && result.counts) {
        setCountryCounts(result.counts);
        return result.counts;
      }
      throw new Error(result.error || "Country counts fallito");
    } finally {
      setIsLoading(false);
    }
  }, []);

  /** Confronta array IDs con DB — restituisce mancanti */
  const checkMissing = useCallback(async (ids: number[], country?: string): Promise<CheckIdsResult> => {
    return wcaCheckIds(ids, country);
  }, []);

  return {
    isLoading,
    countryCounts,
    searchPartners,
    loadCountryCounts,
    checkMissing,
  };
}
