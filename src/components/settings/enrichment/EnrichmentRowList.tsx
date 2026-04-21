/**
 * EnrichmentRowList — Tabella semplificata (LOVABLE-76C).
 * 6 colonne: ☐ · Azienda · Paese · Email · Stato · ⋮
 * Click sulla riga → espande pannello dettaglio inline (Dati / Deep Search / Azioni).
 */
import { useRef, useState } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Mail, SortAsc, SortDesc, ChevronDown, ChevronRight, Linkedin, Loader2, Globe, Brain, Image as ImageIcon, ExternalLink, Search,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type EnrichedRow, type SortField, type SortDir, getEnrichStatus } from "@/hooks/useEnrichmentData";
import type { RowEnrichmentState } from "@/hooks/useBaseEnrichment";

const COUNTRY_FLAGS: Record<string, string> = {
  AE: "🇦🇪", AR: "🇦🇷", AT: "🇦🇹", AU: "🇦🇺", BE: "🇧🇪", BG: "🇧🇬", BR: "🇧🇷",
  CA: "🇨🇦", CH: "🇨🇭", CL: "🇨🇱", CN: "🇨🇳", CO: "🇨🇴", CZ: "🇨🇿", DE: "🇩🇪",
  DK: "🇩🇰", EE: "🇪🇪", EG: "🇪🇬", ES: "🇪🇸", FI: "🇫🇮", FR: "🇫🇷", GB: "🇬🇧",
  GR: "🇬🇷", HK: "🇭🇰", HR: "🇭🇷", HU: "🇭🇺", ID: "🇮🇩", IE: "🇮🇪", IL: "🇮🇱",
  IN: "🇮🇳", IS: "🇮🇸", IT: "🇮🇹", JP: "🇯🇵", KE: "🇰🇪", KR: "🇰🇷", KW: "🇰🇼",
  LT: "🇱🇹", LU: "🇱🇺", LV: "🇱🇻", MA: "🇲🇦", MX: "🇲🇽", MY: "🇲🇾", NG: "🇳🇬",
  NL: "🇳🇱", NO: "🇳🇴", NZ: "🇳🇿", PE: "🇵🇪", PH: "🇵🇭", PK: "🇵🇰", PL: "🇵🇱",
  PT: "🇵🇹", QA: "🇶🇦", RO: "🇷🇴", RS: "🇷🇸", RU: "🇷🇺", SA: "🇸🇦", SE: "🇸🇪",
  SG: "🇸🇬", SI: "🇸🇮", SK: "🇸🇰", TH: "🇹🇭", TR: "🇹🇷", TW: "🇹🇼", UA: "🇺🇦",
  US: "🇺🇸", UY: "🇺🇾", VN: "🇻🇳", ZA: "🇿🇦",
};

const ORIGIN_ACCENT: Record<string, string> = {
  wca: "border-l-primary", contacts: "border-l-emerald-500", email: "border-l-primary",
  cockpit: "border-l-emerald-500", bca: "border-l-primary",
};

const ORIGIN_BADGE_CLASS: Record<string, string> = {
  wca: "bg-primary/10 text-primary border-border",
  contacts: "bg-emerald-500/10 text-emerald-700 border-border",
  email: "bg-primary/10 text-primary border-border",
  cockpit: "bg-emerald-500/10 text-emerald-700 border-border",
  bca: "bg-primary/10 text-primary border-border",
};

const sourceLabel = (s: string) => ({ wca: "WCA", contacts: "Contatti", email: "Email", cockpit: "Cockpit", bca: "BCA" }[s] || s);
const getFlag = (code?: string) => code ? COUNTRY_FLAGS[code.toUpperCase()] || "" : "";

// ── Status cell: 3 stati visivi chiari (Da arricchire / Parziale / Completo) ──
function EnrichmentStatusCell({ row }: { row: EnrichedRow }) {
  const status = getEnrichStatus(row);
  if (status === "missing") {
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-destructive/10 text-destructive text-xs font-medium">
        Da arricchire
      </span>
    );
  }
  if (status === "partial") {
    const score = [row.hasLinkedin, !!row.hasWebsiteExcerpt, row.hasLogo].filter(Boolean).length;
    return (
      <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 text-xs font-medium">
        Parziale ({score}/3)
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-xs font-medium">
      Completo
    </span>
  );
}

function StatusLine({ label, available, value }: { label: string; available: boolean; value?: string | null }) {
  return (
    <div className="flex items-center gap-2 min-w-0">
      <span className={cn("shrink-0 text-sm leading-none", available ? "text-emerald-600 dark:text-emerald-400" : "text-foreground/30")}>
        {available ? "✓" : "○"}
      </span>
      <span className="text-foreground/70 shrink-0">{label}</span>
      {value && <span className="text-foreground/60 truncate">— {value}</span>}
    </div>
  );
}

function formatDate(s?: string | null): string {
  if (!s) return "";
  try { return new Date(s).toLocaleDateString("it-IT"); } catch { return ""; }
}

interface Props {
  rows: EnrichedRow[];
  selected: Set<string>;
  allSelected: boolean;
  sortField: SortField;
  sortDir: SortDir;
  rowStates?: Record<string, RowEnrichmentState>;
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onToggleSort: (field: SortField) => void;
  onDeepSearch: (rows: EnrichedRow[]) => void;
}

export function EnrichmentRowList({
  rows, selected, allSelected, sortField, sortDir, rowStates,
  onToggleAll, onToggleOne, onToggleSort, onDeepSearch,
}: Props) {
  const SortIcon = sortDir === "asc" ? SortAsc : SortDesc;
  const parentRef = useRef<HTMLDivElement>(null);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());

  const toggleExpand = (id: string) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: (i) => expanded.has(rows[i]?.id) ? 220 : 52,
    overscan: 15,
  });

  const COL_TEMPLATE = "32px_24px_minmax(0,1fr)_120px_120px_140px_28px";

  return (
    <>
      {/* Header */}
      <div
        className="grid items-center gap-3 px-3 py-2 bg-muted/40 rounded-t-lg border border-border/60 text-xs font-medium text-foreground/70 uppercase tracking-wider"
        style={{ gridTemplateColumns: COL_TEMPLATE.replace(/_/g, " ") }}
      >
        <div className="flex justify-center">
          <Checkbox checked={allSelected} onCheckedChange={onToggleAll} className="h-3.5 w-3.5" />
        </div>
        <div />
        <button className="flex items-center gap-1 hover:text-foreground transition-colors text-left" onClick={() => onToggleSort("name")}>
          Azienda {sortField === "name" && <SortIcon className="w-3 h-3" />}
        </button>
        <div>Paese</div>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onToggleSort("emailCount")}>
          <Mail className="w-3 h-3" /> Email {sortField === "emailCount" && <SortIcon className="w-3 h-3" />}
        </button>
        <div>Stato</div>
        <div />
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="h-[calc(100vh-420px)] min-h-[300px] border border-t-0 border-border/60 rounded-b-lg overflow-auto"
      >
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-foreground/80">Nessun risultato trovato</div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const row = rows[virtualItem.index];
              const isSelected = selected.has(row.id);
              const isExpanded = expanded.has(row.id);
              const flag = getFlag(row.country);
              const realId = row.realId || row.id;
              const liveState = rowStates?.[realId];
              const isLive = liveState?.status === "running";
              const ed = row.websiteExcerpt;
              const initial = row.name?.[0]?.toUpperCase() || "?";

              return (
                <div
                  key={row.id}
                  className={cn(
                    "absolute left-0 w-full border-l-[3px] border-b border-border/60 transition-colors",
                    ORIGIN_ACCENT[row.source] || "border-l-transparent",
                    isSelected ? "bg-primary/5" : "hover:bg-accent/30",
                    isLive && "bg-primary/10 ring-1 ring-primary/40",
                  )}
                  style={{ top: virtualItem.start, height: virtualItem.size }}
                >
                  {/* RIGA PRINCIPALE */}
                  <div
                    className="grid items-center gap-3 px-3 py-2 cursor-pointer min-h-[48px]"
                    style={{ gridTemplateColumns: COL_TEMPLATE.replace(/_/g, " ") }}
                    onClick={() => toggleExpand(row.id)}
                  >
                    <div className="flex justify-center" onClick={(e) => e.stopPropagation()}>
                      <Checkbox checked={isSelected} onCheckedChange={() => onToggleOne(row.id)} className="h-3.5 w-3.5" />
                    </div>
                    <div className="text-foreground/60 shrink-0">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </div>
                    {/* Azienda con logo + nome + dominio + linkedin badge */}
                    <div className="flex items-center gap-3 min-w-0">
                      {row.logoUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={row.logoUrl} alt={row.name} className="w-8 h-8 rounded object-contain bg-card border border-border/60 shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded bg-muted flex items-center justify-center text-foreground/60 text-sm font-bold shrink-0">
                          {initial}
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-foreground truncate">{row.name}</p>
                        <div className="flex items-center gap-2 text-xs text-foreground/60">
                          {row.domain && <span className="truncate">{row.domain}</span>}
                          {row.hasLinkedin && (
                            <span className="text-cyan-600 dark:text-cyan-400 shrink-0 flex items-center gap-0.5">
                              <Linkedin className="w-3 h-3" /> ✓
                            </span>
                          )}
                          <span className="shrink-0 text-foreground/50">· {sourceLabel(row.source)}</span>
                        </div>
                      </div>
                    </div>
                    {/* Paese */}
                    <div className="flex items-center gap-1.5 text-foreground/70">
                      {flag && <span className="text-lg leading-none">{flag}</span>}
                      {row.country && <span className="text-xs uppercase">{row.country}</span>}
                    </div>
                    {/* Email */}
                    <div className="text-xs text-foreground/70 truncate">
                      {row.emailCount ? (
                        <span className="font-semibold text-foreground">{row.emailCount} msg</span>
                      ) : row.email ? (
                        <span className="truncate" title={row.email}>{row.email}</span>
                      ) : (
                        <span className="text-foreground/40">—</span>
                      )}
                    </div>
                    {/* Stato */}
                    <div onClick={(e) => e.stopPropagation()}>
                      {isLive ? (
                        <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 text-primary text-xs font-medium">
                          <Loader2 className="w-3 h-3 animate-spin" /> In corso…
                        </span>
                      ) : (
                        <EnrichmentStatusCell row={row} />
                      )}
                    </div>
                    {/* Slot finale: indicatore espansione */}
                    <div />
                  </div>

                  {/* PANNELLO ESPANSO */}
                  {isExpanded && (
                    <div className="px-4 py-3 bg-muted/30 border-t border-border/60">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
                        {/* COL 1 — Dati base */}
                        <div>
                          <p className="font-semibold text-foreground/80 mb-2 uppercase tracking-wide text-xs">Dati disponibili</p>
                          <div className="space-y-1.5">
                            <StatusLine label="LinkedIn" available={row.hasLinkedin} value={row.linkedinUrl} />
                            <StatusLine label="Sito web" available={!!row.hasWebsiteExcerpt} value={ed?.description?.slice(0, 60)} />
                            <StatusLine label="Logo" available={row.hasLogo} />
                            <StatusLine label="Email estratte" available={!!ed?.emails?.length} value={ed?.emails?.slice(0, 2).join(", ")} />
                            <StatusLine label="Telefoni" available={!!ed?.phones?.length} value={ed?.phones?.slice(0, 2).join(", ")} />
                          </div>
                        </div>

                        {/* COL 2 — Deep Search status */}
                        <div>
                          <p className="font-semibold text-foreground/80 mb-2 uppercase tracking-wide text-xs">Deep Search</p>
                          {ed?.scraped_at ? (
                            <div className="space-y-1 text-foreground/70">
                              <p>Scraping: <span className="text-foreground">{formatDate(ed.scraped_at)}</span></p>
                            </div>
                          ) : (
                            <p className="text-foreground/50 italic">Mai eseguito</p>
                          )}
                        </div>

                        {/* COL 3 — Azioni */}
                        <div>
                          <p className="font-semibold text-foreground/80 mb-2 uppercase tracking-wide text-xs">Azioni</p>
                          <div className="flex flex-col gap-1.5 items-stretch">
                            <Button size="sm" variant="outline" className="h-7 text-xs gap-1.5 justify-start" onClick={() => onDeepSearch([row])}>
                              <Brain className="w-3.5 h-3.5" /> Deep Search
                            </Button>
                            {!row.hasLogo && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs gap-1.5 justify-start"
                                onClick={() => window.open(`https://www.google.com/search?tbm=isch&q=${encodeURIComponent(`${row.name} company logo`)}`, "_blank")}
                              >
                                <ImageIcon className="w-3.5 h-3.5" /> Cerca Logo Google
                              </Button>
                            )}
                            {!row.hasLinkedin && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs gap-1.5 justify-start"
                                onClick={() => window.open(`https://www.google.com/search?q=${encodeURIComponent(`${row.name} site:linkedin.com/company`)}`, "_blank")}
                              >
                                <Search className="w-3.5 h-3.5" /> Cerca LinkedIn
                              </Button>
                            )}
                            {row.linkedinUrl && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs gap-1.5 justify-start"
                                onClick={() => window.open(row.linkedinUrl, "_blank")}
                              >
                                <Linkedin className="w-3.5 h-3.5" /> Apri LinkedIn <ExternalLink className="w-3 h-3 ml-auto" />
                              </Button>
                            )}
                            {row.domain && (
                              <Button
                                size="sm" variant="outline" className="h-7 text-xs gap-1.5 justify-start"
                                onClick={() => window.open(`https://${row.domain}`, "_blank")}
                              >
                                <Globe className="w-3.5 h-3.5" /> Apri sito <ExternalLink className="w-3 h-3 ml-auto" />
                              </Button>
                            )}
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
