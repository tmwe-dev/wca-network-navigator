import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useLinkedInExtensionBridge } from "./useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { toast } from "sonner";

export interface LinkedInFlowJob {
  id: string;
  status: string;
  total_count: number;
  processed_count: number;
  success_count: number;
  error_count: number;
  delay_seconds: number;
  config: Record<string, any>;
  created_at: string;
  completed_at: string | null;
}

export interface LinkedInFlowItem {
  id: string;
  job_id: string;
  contact_id: string;
  contact_name: string | null;
  company_name: string | null;
  linkedin_url: string | null;
  source_type: string;
  status: string;
  scraped_data: Record<string, any> | null;
  enrichment_result: Record<string, any> | null;
  error_message: string | null;
  position: number;
}

export type LinkedInFlowPhase = "idle" | "scraping" | "enriching" | "paused" | "completed" | "error";

interface FlowContact {
  id: string;
  name: string;
  company: string;
  linkedinUrl?: string | null;
  sourceType?: string;
}

export function useLinkedInFlow() {
  const liBridge = useLinkedInExtensionBridge();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LinkedInFlowPhase>("idle");
  const [progress, setProgress] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [currentContact, setCurrentContact] = useState<string | null>(null);
  const abortRef = useRef(false);
  const runningRef = useRef(false);

  // Listen for realtime updates on the job
  useEffect(() => {
    if (!activeJobId) return;
    const channel = supabase
      .channel(`li-flow-${activeJobId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "linkedin_flow_jobs",
        filter: `id=eq.${activeJobId}`,
      }, (payload: any) => {
        const row = payload.new;
        setProgress({
          total: row.total_count,
          processed: row.processed_count,
          success: row.success_count,
          errors: row.error_count,
        });
        if (row.status === "completed" || row.status === "cancelled") {
          setPhase(row.status === "completed" ? "completed" : "idle");
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [activeJobId]);

  /**
   * Start a LinkedIn flow batch job.
   * Contacts are queued in DB, then processed one-by-one via extension.
   */
  const startFlow = useCallback(async (
    contacts: FlowContact[],
    config: { delaySec?: number; autoConnect?: boolean; generateOutreach?: boolean } = {}
  ) => {
    if (runningRef.current) {
      toast.warning("Un job LinkedIn è già in corso");
      return null;
    }
    if (!liBridge.isAvailable) {
      toast.error("Estensione LinkedIn non rilevata. Assicurati che Partner Connect sia attivo.");
      return null;
    }
    if (contacts.length === 0) {
      toast.warning("Nessun contatto selezionato");
      return null;
    }

    const { data: { user } } = await supabase.auth.getUser();
    if (!user) { toast.error("Non autenticato"); return null; }

    // Create job
    const { data: job, error: jobErr } = await supabase
      .from("linkedin_flow_jobs")
      .insert({
        user_id: user.id,
        total_count: contacts.length,
        delay_seconds: config.delaySec || 15,
        config: {
          auto_connect: config.autoConnect ?? false,
          generate_outreach: config.generateOutreach ?? true,
        },
        status: "running",
      })
      .select()
      .single();

    if (jobErr || !job) {
      toast.error("Errore creazione job: " + (jobErr?.message || "unknown"));
      return null;
    }

    // Insert items
    const items = contacts.map((c, i) => ({
      job_id: job.id,
      contact_id: c.id,
      contact_name: c.name,
      company_name: c.company,
      linkedin_url: c.linkedinUrl || null,
      source_type: c.sourceType || "cockpit",
      position: i,
    }));

    const { error: itemsErr } = await supabase.from("linkedin_flow_items").insert(items);
    if (itemsErr) {
      toast.error("Errore inserimento contatti: " + itemsErr.message);
      return null;
    }

    setActiveJobId(job.id);
    setProgress({ total: contacts.length, processed: 0, success: 0, errors: 0 });
    setPhase("scraping");
    abortRef.current = false;
    runningRef.current = true;

    toast.success(`LinkedIn Flow avviato: ${contacts.length} contatti`, {
      description: `Delay: ${config.delaySec || 15}s tra profili`,
    });

    // Start processing loop
    processLoop(job.id, config.delaySec || 15);

    return job.id;
  }, [liBridge.isAvailable]);

  const processLoop = useCallback(async (jobId: string, delaySec: number) => {
    // Fetch pending items
    const { data: items } = await supabase
      .from("linkedin_flow_items")
      .select("*")
      .eq("job_id", jobId)
      .eq("status", "pending")
      .order("position", { ascending: true });

    if (!items || items.length === 0) {
      await finalizeJob(jobId);
      return;
    }

    for (const item of items) {
      if (abortRef.current) {
        await supabase.from("linkedin_flow_jobs").update({ status: "cancelled" }).eq("id", jobId);
        runningRef.current = false;
        setPhase("idle");
        toast.info("LinkedIn Flow interrotto");
        return;
      }

      setCurrentContact(item.contact_name || item.contact_id);

      // Mark item as processing
      await supabase.from("linkedin_flow_items")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id);

      let scraped: Record<string, any> | null = null;
      let itemStatus = "completed";
      let errorMsg: string | null = null;

      try {
        // ── Step 1: Scrape LinkedIn profile ──
        if (item.linkedin_url) {
          setPhase("scraping");
          const result = await liBridge.extractProfile(item.linkedin_url);

          if (result.success && result.profile) {
            scraped = {
              name: result.profile.name,
              headline: result.profile.headline,
              location: result.profile.location,
              about: result.profile.about,
              profileUrl: result.profile.profileUrl,
              photoUrl: result.profile.photoUrl,
              scraped_at: new Date().toISOString(),
            };
          } else {
            scraped = { error: result.error || "Extraction failed", scraped_at: new Date().toISOString() };
          }
        }

        // ── Step 2: Enrich partner/contact in DB ──
        setPhase("enriching");
        if (scraped && !scraped.error && item.company_name) {
          await enrichPartnerWithLinkedIn(item.company_name, scraped);
        }

        // ── Step 3: Optionally generate outreach via edge function ──
        const { data: jobData } = await supabase
          .from("linkedin_flow_jobs")
          .select("config")
          .eq("id", jobId)
          .single();

        const jobConfig = (jobData?.config as Record<string, any>) || {};

        if (jobConfig.generate_outreach && scraped && !scraped.error) {
          try {
            const { data: outreach } = await supabase.functions.invoke("generate-outreach", {
              body: {
                channel: "linkedin",
                contact_name: item.contact_name || "",
                company_name: item.company_name || "",
                quality: "standard",
                linkedin_profile: scraped,
              },
            });

            if (outreach && !outreach.error) {
              scraped = {
                ...scraped,
                generated_subject: outreach.subject,
                generated_body: outreach.body,
                generated_language: outreach.language,
              };
            }
          } catch (e: any) {
            console.warn("Outreach generation skipped:", e.message);
          }
        }
      } catch (e: any) {
        itemStatus = "error";
        errorMsg = e.message || "Unknown error";
        console.error(`LinkedIn flow error for ${item.contact_name}:`, e);
      }

      // Save item result
      await supabase.from("linkedin_flow_items").update({
        status: itemStatus,
        scraped_data: scraped as any,
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", item.id);

      // Update job counters
      const isSuccess = itemStatus === "completed";
      await supabase.from("linkedin_flow_jobs").update({
        processed_count: (await getProcessedCount(jobId)),
        success_count: isSuccess
          ? (await getCountByStatus(jobId, "completed"))
          : undefined,
        error_count: !isSuccess
          ? (await getCountByStatus(jobId, "error"))
          : undefined,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      // Human-like delay between profiles
      if (items.indexOf(item) < items.length - 1) {
        const jitter = Math.random() * 5;
        await sleep((delaySec + jitter) * 1000);
      }
    }

    await finalizeJob(jobId);
  }, [liBridge]);

  const finalizeJob = async (jobId: string) => {
    const processed = await getProcessedCount(jobId);
    const successes = await getCountByStatus(jobId, "completed");
    const errors = await getCountByStatus(jobId, "error");

    await supabase.from("linkedin_flow_jobs").update({
      status: "completed",
      processed_count: processed,
      success_count: successes,
      error_count: errors,
      completed_at: new Date().toISOString(),
    }).eq("id", jobId);

    runningRef.current = false;
    setPhase("completed");
    setCurrentContact(null);
    toast.success(`LinkedIn Flow completato: ${successes} OK, ${errors} errori`);
  };

  const stopFlow = useCallback(() => {
    abortRef.current = true;
    setPhase("paused");
  }, []);

  const resumeFlow = useCallback(async () => {
    if (!activeJobId) return;
    abortRef.current = false;
    runningRef.current = true;
    setPhase("scraping");

    const { data: job } = await supabase
      .from("linkedin_flow_jobs")
      .select("delay_seconds")
      .eq("id", activeJobId)
      .single();

    await supabase.from("linkedin_flow_jobs")
      .update({ status: "running" })
      .eq("id", activeJobId);

    processLoop(activeJobId, (job?.delay_seconds as number) || 15);
  }, [activeJobId, processLoop]);

  return {
    startFlow,
    stopFlow,
    resumeFlow,
    phase,
    progress,
    currentContact,
    activeJobId,
    isRunning: phase === "scraping" || phase === "enriching",
    extensionAvailable: liBridge.isAvailable,
  };
}

// ── Helpers ──

async function enrichPartnerWithLinkedIn(companyName: string, scraped: Record<string, any>) {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, enrichment_data")
      .ilike("company_name", `%${companyName}%`)
      .limit(1);

    if (partners?.[0]) {
      const existing = (partners[0].enrichment_data as Record<string, any>) || {};
      await supabase.from("partners").update({
        enrichment_data: {
          ...existing,
          linkedin_profile_name: scraped.name,
          linkedin_profile_headline: scraped.headline,
          linkedin_profile_location: scraped.location,
          linkedin_profile_about: scraped.about?.slice(0, 2000),
          linkedin_profile_url: scraped.profileUrl,
          linkedin_scraped_at: scraped.scraped_at,
          linkedin_summary: [scraped.name, scraped.headline, scraped.about?.slice(0, 500)]
            .filter(Boolean).join(" — "),
        },
      }).eq("id", partners[0].id);
    }
  } catch (e) {
    console.error("Failed to enrich partner with LinkedIn data:", e);
  }
}

async function getProcessedCount(jobId: string): Promise<number> {
  const { count } = await supabase
    .from("linkedin_flow_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .in("status", ["completed", "error"]);
  return count || 0;
}

async function getCountByStatus(jobId: string, status: string): Promise<number> {
  const { count } = await supabase
    .from("linkedin_flow_items")
    .select("*", { count: "exact", head: true })
    .eq("job_id", jobId)
    .eq("status", status);
  return count || 0;
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}
