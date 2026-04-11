import { useState, useCallback, useRef, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { useLinkedInExtensionBridge } from "./useLinkedInExtensionBridge";
import { useFireScrapeExtensionBridge } from "./useFireScrapeExtensionBridge";
import { toast } from "sonner";
import { getPatternPause } from "@/hooks/useScrapingSettings";
import { createLogger } from "@/lib/log";

const log = createLogger("useLinkedInFlow");

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

export type LinkedInFlowPhase = "idle" | "scraping" | "deep_search" | "enriching" | "generating" | "paused" | "completed" | "error";

interface FlowContact {
  id: string;
  name: string;
  company: string;
  linkedinUrl?: string | null;
  website?: string | null;
  sourceType?: string;
}

export function useLinkedInFlow() {
  const liBridge = useLinkedInExtensionBridge();
  const pcBridge = useFireScrapeExtensionBridge();
  const [activeJobId, setActiveJobId] = useState<string | null>(null);
  const [phase, setPhase] = useState<LinkedInFlowPhase>("idle");
  const [progress, setProgress] = useState({ total: 0, processed: 0, success: 0, errors: 0 });
  const [currentContact, setCurrentContact] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<string | null>(null);
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
   * Uses BOTH extensions: LinkedIn (profile scraping) + Partner Connect (website deep search).
   */
  const startFlow = useCallback(async (
    contacts: FlowContact[],
    config: {
      delaySec?: number;
      autoConnect?: boolean;
      generateOutreach?: boolean;
      deepSearchWeb?: boolean;
    } = {}
  ) => {
    if (runningRef.current) {
      toast.warning("Un job LinkedIn è già in corso");
      return null;
    }

    const hasLi = liBridge.isAvailable;
    const hasPc = pcBridge.isAvailable;

    if (!hasLi && !hasPc) {
      toast.error("Nessuna estensione rilevata. Installa Partner Connect e/o LinkedIn Extension.");
      return null;
    }

    // Preflight: verify LinkedIn session is actually authenticated
    if (hasLi) {
      const authCheck = await liBridge.ensureAuthenticated(0);
      if (!authCheck.ok) {
        toast.error(`LinkedIn non autenticato (${authCheck.reason}). Accedi a LinkedIn e riprova.`);
        return null;
      }
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
          deep_search_web: config.deepSearchWeb ?? true,
          extensions: { linkedin: hasLi, partner_connect: hasPc },
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

    const tools: string[] = [];
    if (hasLi) tools.push("LinkedIn");
    if (hasPc) tools.push("Partner Connect");

    toast.success(`LinkedIn Flow avviato: ${contacts.length} contatti`, {
      description: `Estensioni: ${tools.join(" + ")} · Delay: ${config.delaySec || 15}s`,
    });

    processLoop(job.id, config.delaySec || 15);
    return job.id;
  }, [liBridge.isAvailable, pcBridge.isAvailable]);

  const processLoop = useCallback(async (jobId: string, delaySec: number) => {
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

    // Read job config once
    const { data: jobData } = await supabase
      .from("linkedin_flow_jobs")
      .select("config")
      .eq("id", jobId)
      .single();
    const jobConfig = (jobData?.config as Record<string, any>) || {};

    for (let idx = 0; idx < items.length; idx++) {
      const item = items[idx];

      if (abortRef.current) {
        await supabase.from("linkedin_flow_jobs").update({ status: "cancelled" }).eq("id", jobId);
        runningRef.current = false;
        setPhase("idle");
        toast.info("LinkedIn Flow interrotto");
        return;
      }

      setCurrentContact(item.contact_name || item.contact_id);

      await supabase.from("linkedin_flow_items")
        .update({ status: "processing", started_at: new Date().toISOString() })
        .eq("id", item.id);

      const enrichment: Record<string, any> = { processed_at: new Date().toISOString() };
      let itemStatus = "completed";
      let errorMsg: string | null = null;

      try {
        // ═══════════════════════════════════════════
        // STEP 1: LinkedIn Profile Scraping (via LinkedIn Extension)
        // ═══════════════════════════════════════════
        if (item.linkedin_url && liBridge.isAvailable) {
          setPhase("scraping");
          setCurrentStep("Scraping profilo LinkedIn...");

          const result = await liBridge.extractProfile(item.linkedin_url);

          if (result.success && result.profile) {
            enrichment.linkedin = {
              name: result.profile.name,
              headline: result.profile.headline,
              location: result.profile.location,
              about: result.profile.about,
              profileUrl: result.profile.profileUrl,
              photoUrl: result.profile.photoUrl,
              connectionStatus: (result.profile as any).connectionStatus || "unknown",
            };
            enrichment.linkedin_ok = true;
            enrichment.connection_status = enrichment.linkedin.connectionStatus;
          } else {
            enrichment.linkedin_ok = false;
            enrichment.linkedin_error = result.error || "Extraction failed";
          }

          // Human-like pause after scraping (3-6s)
          await sleep(3000 + Math.random() * 3000);
        }

        // ═══════════════════════════════════════════
        // STEP 2: Website Deep Search (via Partner Connect)
        // ═══════════════════════════════════════════
        if (jobConfig.deep_search_web && pcBridge.isAvailable && item.company_name) {
          setPhase("deep_search");
          setCurrentStep("Deep Search sito web...");

          // Find the partner's website from DB
          const { data: partner } = await supabase
            .from("partners")
            .select("website, enrichment_data")
            .ilike("company_name", `%${item.company_name}%`)
            .limit(1)
            .single();

          const website = partner?.website;
          const existingEnrichment = (partner?.enrichment_data as Record<string, any>) || {};

          // Check if cached scrape is fresh (< 30 days)
          const cachedAt = existingEnrichment.website_scraped_at;
          const isCacheFresh = cachedAt && (Date.now() - new Date(cachedAt).getTime()) < 30 * 86400000;

          if (website && !isCacheFresh) {
            try {
              // Use Partner Connect to scrape the company website
              const scrapeResult = await pcBridge.scrapeUrl(website);

              if (scrapeResult.success && scrapeResult.markdown) {
                enrichment.website = {
                  url: website,
                  title: scrapeResult.metadata?.title,
                  description: scrapeResult.metadata?.description,
                  content_preview: scrapeResult.markdown.slice(0, 3000),
                  word_count: scrapeResult.stats?.words,
                  lang: scrapeResult.metadata?.lang,
                  source: "partner_connect",
                };
                enrichment.website_ok = true;

                // Use Partner Connect brain to analyze the content
                setCurrentStep("Analisi AI del sito...");
                try {
                  const analysis = await pcBridge.brainAnalyze(
                    `Analizza questa azienda per una partnership nel freight forwarding. ` +
                    `Identifica: servizi offerti, rotte operative, specializzazioni, segnali di export. ` +
                    `Contenuto: ${scrapeResult.markdown.slice(0, 2000)}`
                  );
                  if (analysis.success) {
                    enrichment.website_analysis = analysis;
                  }
                } catch (e) {
                  log.warn("operation failed", { error: e instanceof Error ? e.message : String(e) });
                  // Brain analysis is optional
                }
              } else {
                enrichment.website_ok = false;
                enrichment.website_error = scrapeResult.error || "Scrape failed";
              }
            } catch (e: any) {
              enrichment.website_ok = false;
              enrichment.website_error = e.message;
            }

            await sleep(4000 + Math.random() * 3000);
          } else if (isCacheFresh) {
            enrichment.website_ok = true;
            enrichment.website_cached = true;
            enrichment.website = { source: "cache", cached_at: cachedAt };
          }
        }

        // ═══════════════════════════════════════════
        // STEP 3: Save enrichment to partner DB
        // ═══════════════════════════════════════════
        setPhase("enriching");
        setCurrentStep("Salvataggio dati...");

        if (item.company_name) {
          await saveEnrichmentToPartner(item.company_name, enrichment);
        }

        // ═══════════════════════════════════════════
        // STEP 4: AI Outreach Generation
        // ═══════════════════════════════════════════
        if (jobConfig.generate_outreach && (enrichment.linkedin_ok || enrichment.website_ok)) {
          setPhase("generating");
          setCurrentStep("Generazione bozza AI...");

          try {
            const outreach = await invokeEdge<{ subject?: string; body?: string; language?: string; error?: string } | null>("generate-outreach", {
              body: {
                channel: "linkedin",
                contact_name: item.contact_name || "",
                company_name: item.company_name || "",
                quality: "standard",
                linkedin_profile: enrichment.linkedin || undefined,
              },
              context: "useLinkedInFlow.outreach",
            });

            if (outreach && !outreach.error) {
              enrichment.outreach = {
                subject: outreach.subject,
                body: outreach.body,
                language: outreach.language,
              };
            }
          } catch (e: any) {
            log.warn("outreach generation skipped", { message: e instanceof Error ? e.message : String(e) });
          }
        }

        // ═══════════════════════════════════════════
        // STEP 5: Auto-connect (optional, smart)
        // ═══════════════════════════════════════════
        const connStatus = enrichment.connection_status || "unknown";
        const shouldConnect = jobConfig.auto_connect
          && item.linkedin_url
          && liBridge.isAvailable
          && connStatus !== "connected"
          && connStatus !== "pending";

        if (shouldConnect && enrichment.outreach?.body) {
          setCurrentStep("Invio richiesta collegamento...");
          try {
            const note = enrichment.outreach.body.replace(/<[^>]+>/g, "").trim().slice(0, 295) + (enrichment.outreach.body.length > 295 ? "..." : "");
            const connResult = await liBridge.sendConnectionRequest(item.linkedin_url!, note);
            enrichment.connection_sent = connResult.success;
            enrichment.connection_status = connResult.success ? "pending" : connStatus;
            if (!connResult.success) {
              enrichment.connection_error = connResult.error;
            }
          } catch (e: any) {
            enrichment.connection_error = e.message;
          }
          await sleep(5000 + Math.random() * 4000);
        } else if (connStatus === "connected") {
          setCurrentStep("Già connesso — skip collegamento");
          enrichment.connection_skipped = true;
          enrichment.connection_skip_reason = "already_connected";
        } else if (connStatus === "pending") {
          setCurrentStep("Richiesta già in attesa — skip");
          enrichment.connection_skipped = true;
          enrichment.connection_skip_reason = "pending";
        }

      } catch (e: any) {
        itemStatus = "error";
        errorMsg = e.message || "Unknown error";
        log.error("flow error", { contactName: item.contact_name, message: e instanceof Error ? e.message : String(e) });
      }

      // Save item result
      await supabase.from("linkedin_flow_items").update({
        status: itemStatus,
        scraped_data: enrichment as any,
        enrichment_result: enrichment as any,
        error_message: errorMsg,
        completed_at: new Date().toISOString(),
      }).eq("id", item.id);

      // Update job counters
      const processed = await getProcessedCount(jobId);
      const successes = await getCountByStatus(jobId, "completed");
      const errors = await getCountByStatus(jobId, "error");

      await supabase.from("linkedin_flow_jobs").update({
        processed_count: processed,
        success_count: successes,
        error_count: errors,
        updated_at: new Date().toISOString(),
      }).eq("id", jobId);

      setProgress({ total: items.length + processed - items.length, processed, success: successes, errors });

      // Human-pattern pause between contacts (fixed sequence, no regularity)
      if (idx < items.length - 1) {
        const patternPause = getPatternPause(idx);
        setCurrentStep(`Pausa ${patternPause}s...`);
        await sleep(patternPause * 1000);
      }
    }

    await finalizeJob(jobId);
  }, [liBridge, pcBridge]);

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
    setCurrentStep(null);
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
    currentStep,
    activeJobId,
    isRunning: phase === "scraping" || phase === "enriching" || phase === "deep_search" || phase === "generating",
    extensionAvailable: liBridge.isAvailable || pcBridge.isAvailable,
    linkedInAvailable: liBridge.isAvailable,
    partnerConnectAvailable: pcBridge.isAvailable,
  };
}

// ── Helpers ──

async function saveEnrichmentToPartner(companyName: string, enrichment: Record<string, any>) {
  try {
    const { data: partners } = await supabase
      .from("partners")
      .select("id, enrichment_data")
      .ilike("company_name", `%${companyName}%`)
      .limit(1);

    if (partners?.[0]) {
      const existing = (partners[0].enrichment_data as Record<string, any>) || {};
      const update: Record<string, any> = { ...existing };

      // LinkedIn data
      if (enrichment.linkedin_ok && enrichment.linkedin) {
        update.linkedin_profile_name = enrichment.linkedin.name;
        update.linkedin_profile_headline = enrichment.linkedin.headline;
        update.linkedin_profile_location = enrichment.linkedin.location;
        update.linkedin_profile_about = enrichment.linkedin.about?.slice(0, 2000);
        update.linkedin_profile_url = enrichment.linkedin.profileUrl;
        update.linkedin_scraped_at = enrichment.processed_at;
        update.linkedin_summary = [
          enrichment.linkedin.name,
          enrichment.linkedin.headline,
          enrichment.linkedin.about?.slice(0, 500),
        ].filter(Boolean).join(" — ");
      }

      // Website data (via Partner Connect)
      if (enrichment.website_ok && enrichment.website && !enrichment.website_cached) {
        update.website_title = enrichment.website.title;
        update.website_description = enrichment.website.description;
        update.website_content_preview = enrichment.website.content_preview?.slice(0, 3000);
        update.website_lang = enrichment.website.lang;
        update.website_scraped_at = enrichment.processed_at;
        update.website_scrape_source = "partner_connect";
      }

      // AI Analysis (via Partner Connect brain)
      if (enrichment.website_analysis) {
        update.website_analysis = enrichment.website_analysis;
        update.website_analyzed_at = enrichment.processed_at;
      }

      // Connection status
      if (enrichment.connection_status) {
        update.linkedin_connection_status = enrichment.connection_status;
      }
      if (enrichment.connection_sent !== undefined) {
        update.linkedin_connection_sent = enrichment.connection_sent;
        update.linkedin_connection_at = enrichment.processed_at;
      }
      if (enrichment.connection_skipped) {
        update.linkedin_connection_skipped = true;
        update.linkedin_connection_skip_reason = enrichment.connection_skip_reason;
      }

      await supabase.from("partners").update({
        enrichment_data: update,
      }).eq("id", partners[0].id);
    }
  } catch (e) {
    log.error("save enrichment to partner failed", { message: e instanceof Error ? e.message : String(e) });
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
