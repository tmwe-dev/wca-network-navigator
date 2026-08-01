import { useQuery } from "@tanstack/react-query";
import { fetchRaDashboardStats } from "@/data/raDashboard";
import type { RADashboardStats } from "@/types/ra";

const RA_DASHBOARD_KEY = ["ra-dashboard"] as const;

export function useRADashboard() {
  return useQuery({
    queryKey: RA_DASHBOARD_KEY,
    queryFn: (): Promise<RADashboardStats> => fetchRaDashboardStats(),
    staleTime: 30_000,
  });
}
