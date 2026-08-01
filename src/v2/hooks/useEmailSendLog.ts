/**
 * Hook V2 — email_send_log observability.
 */
import { useQuery } from "@tanstack/react-query";
import { fetchEmailSendLogStats, type EmailSendLogStats } from "@/data/emailSendLog";
import { queryKeys } from "@/lib/queryKeys";

export type EmailRangePreset = "24h" | "7d" | "30d";

function rangeToSinceIso(range: EmailRangePreset): string {
  const now = Date.now();
  const ms = range === "24h" ? 24 * 3600_000 : range === "7d" ? 7 * 86400_000 : 30 * 86400_000;
  return new Date(now - ms).toISOString();
}

export function useEmailSendLog(range: EmailRangePreset) {
  return useQuery<EmailSendLogStats>({
    queryKey: queryKeys.email.sendLog(range),
    queryFn: () => fetchEmailSendLogStats(rangeToSinceIso(range)),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });
}
