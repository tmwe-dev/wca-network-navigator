/**
 * RawScrapePanel — pannello per ispezionare i markdown grezzi prodotti da FireScrape.
 *
 * Sorgenti consultate (in ordine):
 *   1. enrichment_data.deep_search_v2[*].markdown (nuove pipeline)
 *   2. enrichment_data.scrapes[*]                  (formato legacy)
 *   3. raw_profile_markdown                        (sync WCA legacy)
 *   4. scrape_cache (ultimi 20 record correlati)
 *
 * Ogni voce ha: titolo, fonte, lunghezza, anteprima espandibile.
 */
import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronDown, ChevronRight, FileText, Copy, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { untypedFrom } from "@/lib/supabaseUntyped";

interface ScrapeEntry {
  id: string;
  source: string;
  url: string | null;
  scrapedAt: string | null;
  markdown: string;
}

interface Props {
  partnerId?: string | null;
  contactId?: string | null;
  enrichmentData: Record<string, unknown> | null;
  rawProfileMarkdown: string | null;
}

function extractFromEnrichment(data: Record<string, unknown> | null): ScrapeEntry[] {
  if (!data || typeof data !== "object") return [];
  const out: ScrapeEntry[] = [];

  // Formato nuovo: deep_search_v2 = { googleMaps: { markdown, url, scrapedAt }, ... }
  const v2 = data.deep_search_v2;
  if (v2 && typeof v2 === "object") {
    for (const [key, value] of Object.entries(v2 as Record<string, unknown>)) {
      if (value && typeof value === "object") {
        const v = value as Record<string, unknown>;
        const md = typeof v.markdown === "string" ? v.markdown : null;
        if (md && md.trim()) {
          out.push({
            id: `v2-${key}`,
            source: `deep_search_v2.${key}`,
            url: typeof v.url === "string" ? v.url : null,
            scrapedAt: typeof v.scrapedAt === "string" ? v.scrapedAt : null,
            markdown: md,
          });
        }
      }
    }
  }

  // Formato legacy: scrapes = [{ source, url, markdown, ts }]
  const legacy = data.scrapes;
  if (Array.isArray(legacy)) {
    legacy.forEach((item, i) => {
      if (item && typeof item === "object") {
        const it = item as Record<string, unknown>;
        const md = typeof it.markdown === "string" ? it.markdown : null;
        if (md && md.trim()) {
          out.push({
            id: `legacy-${i}`,
            source: typeof it.source === "string" ? `scrapes.${it.source}` : `scrapes[${i}]`,
            url: typeof it.url === "string" ? it.url : null,
            scrapedAt: typeof it.ts === "string" ? it.ts : null,
            markdown: md,
          });
        }
      }
    });
  }

  return out;
}

export function RawScrapePanel({ partnerId, contactId, enrichmentData, rawProfileMarkdown }: Props) {
  const [expanded, setExpanded] = React.useState<Set<string>>(new Set());

  // Carica scrape_cache filtrato per URL che contengono il dominio del partner se presente
  const cacheQuery = useQuery({
    queryKey: ["raw-scrape-cache", partnerId, contactId],
    queryFn: async () => {
      const { data, error } = await untypedFrom("scrape_cache")
        .select("url, payload, scraped_at, mode")
        .order("scraped_at", { ascending: false })
        .limit(20);
      if (error) return [];
      return (data ?? []) as Array<{ url: string; payload: unknown; scraped_at: string; mode: string }>;
    },
  });

  const fromEnrichment = React.useMemo(
    () => extractFromEnrichment(enrichmentData),
    [enrichmentData],
  );

  const fromCache: ScrapeEntry[] = React.useMemo(() => {
    const rows = cacheQuery.data ?? [];
    return rows.flatMap((r, i) => {
      const payload = r.payload as Record<string, unknown> | null;
      const md = payload && typeof payload === "object" && typeof payload.markdown === "string"
        ? payload.markdown
        : null;
      if (!md || !md.trim()) return [];
      return [{
        id: `cache-${i}`,
        source: `scrape_cache.${r.mode}`,
        url: r.url,
        scrapedAt: r.scraped_at,
        markdown: md,
      }];
    });
  }, [cacheQuery.data]);

  const legacyEntry: ScrapeEntry | null = rawProfileMarkdown && rawProfileMarkdown.trim()
    ? {
        id: "legacy-profile",
        source: "partners.raw_profile_markdown",
        url: null,
        scrapedAt: null,
        markdown: rawProfileMarkdown,
      }
    : null;

  const allEntries = [
    ...fromEnrichment,
    ...(legacyEntry ? [legacyEntry] : []),
    ...fromCache,
  ];

  const toggle = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const copyMd = async (md: string) => {
    try {
      await navigator.clipboard.writeText(md);
      toast.success("Markdown copiato");
    } catch {
      toast.error("Copia fallita");
    }
  };

  if (allEntries.length === 0) {
    return (
      <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-3">
        <div className="flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
          <div className="flex-1">
            <div className="text-[11px] font-semibold text-amber-900 dark:text-amber-200">
              Nessun markdown grezzo disponibile
            </div>
            <div className="text-[10px] text-amber-800/80 dark:text-amber-200/80 mt-0.5">
              Lancia una Deep Search per popolare i markdown da FireScrape, oppure verifica che la pipeline V2 stia salvando i risultati.
              Per ispezionare gli scrape manuali apri <span className="font-mono">chrome://extensions</span> → Partner Connect → "service worker" → tab Console.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-muted-foreground flex items-center gap-1">
        <FileText className="w-3 h-3" />
        Markdown grezzi · {allEntries.length}
      </div>
      {allEntries.map((entry) => {
        const isOpen = expanded.has(entry.id);
        const preview = entry.markdown.slice(0, 280);
        return (
          <div key={entry.id} className="rounded border border-border/60 bg-muted/20">
            <button
              onClick={() => toggle(entry.id)}
              className="w-full flex items-start gap-2 p-2 text-left hover:bg-muted/40 transition-colors"
            >
              {isOpen ? <ChevronDown className="w-3 h-3 shrink-0 mt-0.5" /> : <ChevronRight className="w-3 h-3 shrink-0 mt-0.5" />}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <Badge variant="secondary" className="text-[9px] py-0 px-1.5 h-4 font-mono">{entry.source}</Badge>
                  <span className="text-[11px] text-foreground/70 font-mono">{entry.markdown.length} char</span>
                  {entry.scrapedAt && (
                    <span className="text-[11px] text-foreground/70">
                      {new Date(entry.scrapedAt).toLocaleString("it-IT")}
                    </span>
                  )}
                </div>
                {entry.url && (
                  <div className="text-[10px] text-primary/80 truncate font-mono mt-0.5">{entry.url}</div>
                )}
                {!isOpen && (
                  <div className="text-xs text-foreground/70 mt-1 line-clamp-2">{preview}…</div>
                )}
              </div>
            </button>
            {isOpen && (
              <div className="border-t border-border/60 p-2 space-y-1.5">
                <div className="flex justify-end">
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-6 text-[10px]"
                    onClick={(e) => { e.stopPropagation(); copyMd(entry.markdown); }}
                  >
                    <Copy className="w-3 h-3 mr-1" /> Copia
                  </Button>
                </div>
                <pre className="text-[10px] font-mono whitespace-pre-wrap break-words bg-background/60 rounded p-2 max-h-96 overflow-auto border border-border/30">
                  {entry.markdown}
                </pre>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
