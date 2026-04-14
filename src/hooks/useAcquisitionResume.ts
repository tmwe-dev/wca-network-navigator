/**
 * Acquisition pipeline resume logic — extracted from useAcquisitionPipeline.tsx
 * Checks for active/paused acquisition jobs on mount and restores state.
 */
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { getPartnersByCountries } from "@/data/partners";
import { toast } from "@/hooks/use-toast";
import type { QueueItem } from "@/components/acquisition/types";
import { createLogger } from "@/lib/log";

const log = createLogger("useAcquisitionResume");
import type { PipelineStatus, LiveStats } from "./useAcquisitionPipeline";
import { upsertDirectoryCache } from "@/data/directoryCache";
import { updateDownloadJob } from "@/data/downloadJobs";

interface ResumeSetters {
  setActiveJobId: (id: string | null) => void;
  setQueue: (items: QueueItem[]) => void;
  setSelectedIds: (ids: Set<number>) => void;
  setCompletedCount: (n: number) => void;
  setLiveStats: (s: LiveStats) => void;
  setPipelineStatus: (s: PipelineStatus) => void;
  setResumeLoading: (v: boolean) => void;
  pauseRef: React.MutableRefObject<boolean>;
  cancelRef: React.MutableRefObject<boolean>;
}

export function useAcquisitionResume(setters: ResumeSetters) {
  const {
    setActiveJobId, setQueue, setSelectedIds, setCompletedCount,
    setLiveStats, setPipelineStatus, setResumeLoading, pauseRef, cancelRef,
  } = setters;

  useEffect(() => {
    (async () => {
      try {
        const { data: activeJobs } = await supabase
          .from("download_jobs")
          .select("*")
          .eq("job_type", "acquisition")
          .in("status", ["running", "paused"])
          .order("created_at", { ascending: false })
          .limit(1);

        if (activeJobs && activeJobs.length > 0) {
          const job = activeJobs[0];
          setActiveJobId(job.id);
          const wcaIds = (job.wca_ids as number[]) || [];
          const processedIds = new Set((job.processed_ids as number[]) || []);

          const queueItems: QueueItem[] = wcaIds.map((id) => ({
            wca_id: id,
            company_name: `WCA ${id}`,
            country_code: job.country_code,
            city: "",
            status: processedIds.has(id) ? ("done" as const) : ("pending" as const),
            alreadyDownloaded: false,
          }));

          // Enrich names from partners table
          const partners = await getPartnersByCountries([job.country_code], "wca_id, company_name, city");
          if (partners) {
            for (const p of partners) {
              const qi = queueItems.find((q) => q.wca_id === p.wca_id);
              if (qi) {
                qi.company_name = p.company_name;
                qi.city = p.city;
              }
            }
          }

          // Enrich remaining from directory_cache
          const stillMissing = queueItems.filter(q => q.company_name.startsWith("WCA "));
          if (stillMissing.length > 0) {
            const { data: cacheEntries } = await supabase
              .from("directory_cache")
              .select("members")
              .eq("country_code", job.country_code);
            if (cacheEntries) {
              for (const entry of cacheEntries) {
                const members = (entry.members as unknown[]) || [];
                for (const m of members) {
                  if (!m.wca_id || !m.company_name) continue;
                  const qi = stillMissing.find(q => q.wca_id === m.wca_id);
                  if (qi) {
                    qi.company_name = m.company_name;
                    if (m.city) qi.city = m.city;
                  }
                }
              }
            }
          }

          // If still missing names, re-scan directory
          const stillMissing2 = queueItems.filter(q => q.company_name.startsWith("WCA "));
          if (stillMissing2.length > 0) {
            try {
              // 🤖 Claude Engine V8: usa wcaScraper bridge invece di Edge Function
              const { scrapeWcaDirectory } = await import("@/lib/api/wcaScraper");
              const scanResult = await scrapeWcaDirectory(job.country_code, job.network_name || "");
              if (scanResult?.success && scanResult?.members) {
                const membersJson = scanResult.members.map((m: unknown) => ({
                  company_name: m.company_name,
                  city: m.city,
                  country_code: job.country_code,
                  wca_id: m.wca_id,
                }));
                await upsertDirectoryCache({
                    country_code: job.country_code,
                    network_name: job.network_name || "",
                    members: membersJson as unknown,
                    total_results: scanResult.members.length,
                    scanned_at: new Date().toISOString(),
                    updated_at: new Date().toISOString(),
                  });
                for (const m of scanResult.members) {
                  if (!m.wca_id || !m.company_name) continue;
                  const qi = stillMissing2.find(q => q.wca_id === m.wca_id);
                  if (qi) {
                    qi.company_name = m.company_name;
                    if (m.city) qi.city = m.city;
                  }
                }
              }
            } catch (scanErr) {
              log.warn("re-scan directory failed", { message: scanErr instanceof Error ? scanErr.message : String(scanErr) });
            }
          }

          setQueue(queueItems);
          setSelectedIds(new Set(wcaIds.filter((id) => !processedIds.has(id))));
          setCompletedCount(processedIds.size);

          setLiveStats({
            processed: processedIds.size,
            withEmail: job.contacts_found_count || 0,
            withPhone: 0,
            complete: job.contacts_found_count || 0,
            empty: job.contacts_missing_count || 0,
            failedLoads: 0,
          });

          if (job.status === "running" || job.status === "paused") {
            setPipelineStatus("paused");
            pauseRef.current = true;

            if (job.status === "running") {
              await updateDownloadJob(job.id, { status: "paused" });
            }

            toast({
              title: "Acquisizione precedente trovata",
              description: `${processedIds.size}/${wcaIds.length} partner già processati. Premi Riprendi per continuare.`,
            });
          } else {
            setPipelineStatus("paused");
            toast({
              title: "Acquisizione precedente trovata",
              description: `${processedIds.size}/${wcaIds.length} partner già processati. Puoi riprendere.`,
            });
          }
        }
      } catch (err) {
        log.error("check active acquisition jobs failed", { message: err instanceof Error ? err.message : String(err) });
      } finally {
        setResumeLoading(false);
      }
    })();

    return () => {
      cancelRef.current = true;
    };
  }, []);
}
