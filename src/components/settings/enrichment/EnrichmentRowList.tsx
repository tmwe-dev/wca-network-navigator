/**
 * EnrichmentRowList — Header + virtualized scrollable row list
 */
import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Mail, SortAsc, SortDesc, MoreVertical, Linkedin, CheckCircle2, ImageOff, Brain, Image, Loader2, Globe,
} from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { cn } from "@/lib/utils";
import type { EnrichedRow, SortField, SortDir } from "@/hooks/useEnrichmentData";
import type { RowEnrichmentState } from "@/hooks/useBaseEnrichment";
import { EnrichmentDetailPopover } from "./EnrichmentDetailPopover";

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

  const virtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 44,
    overscan: 15,
  });

  return (
    <>
      {/* Header */}
      <div className="grid grid-cols-[32px_28px_1fr_1fr_70px_50px_70px_60px_28px] items-center gap-2 px-3 py-1.5 bg-muted/40 rounded-t-lg border border-border text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        <div className="flex justify-center">
          <Checkbox checked={allSelected} onCheckedChange={onToggleAll} className="h-3.5 w-3.5" />
        </div>
        <div />
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onToggleSort("name")}>
          Nome {sortField === "name" && <SortIcon className="w-3 h-3" />}
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onToggleSort("domain")}>
          Dominio {sortField === "domain" && <SortIcon className="w-3 h-3" />}
        </button>
        <div>Paese</div>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onToggleSort("emailCount")}>
          <Mail className="w-3 h-3" /> {sortField === "emailCount" && <SortIcon className="w-3 h-3" />}
        </button>
        <button className="flex items-center gap-1 hover:text-foreground transition-colors" onClick={() => onToggleSort("source")}>
          Fonte {sortField === "source" && <SortIcon className="w-3 h-3" />}
        </button>
        <div>Stato</div>
        <div />
      </div>

      {/* Virtualized rows */}
      <div
        ref={parentRef}
        className="h-[calc(100vh-370px)] min-h-[250px] border border-t-0 border-border rounded-b-lg overflow-auto"
      >
        {rows.length === 0 ? (
          <div className="text-center py-10 text-sm text-muted-foreground">Nessun risultato trovato</div>
        ) : (
          <div className="relative w-full" style={{ height: virtualizer.getTotalSize() }}>
            {virtualizer.getVirtualItems().map((virtualItem) => {
              const row = rows[virtualItem.index];
              const isSelected = selected.has(row.id);
              const flag = getFlag(row.country);
              const realId = row.realId || row.id;
              const liveState = rowStates?.[realId];
              const isLive = liveState?.status === "running";
              const isLiveDone = liveState?.status === "done";
              return (
                <div
                  key={row.id}
                  className={cn(
                    "absolute left-0 w-full grid grid-cols-[32px_28px_1fr_1fr_70px_50px_70px_60px_28px] items-center gap-2 px-3 py-2 transition-colors border-l-[3px] border-b border-border/50",
                    ORIGIN_ACCENT[row.source] || "border-l-transparent",
                    isSelected ? "bg-primary/5" : "hover:bg-accent/30",
                    isLive && "bg-primary/10 ring-1 ring-primary/40"
                  )}
                  style={{ top: virtualItem.start, height: virtualItem.size }}
                >
                  <div className="flex justify-center">
                    <Checkbox checked={isSelected} onCheckedChange={() => onToggleOne(row.id)} className="h-3.5 w-3.5" />
                  </div>
                  <CompanyLogo domain={row.domain} name={row.name} size={24} />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold text-foreground truncate uppercase">{row.name}</div>
                    {row.email && <div className="text-[10px] text-muted-foreground truncate">{row.email}</div>}
                  </div>
                  <div className="text-[11px] text-muted-foreground truncate">
                    {row.domain || <span className="italic text-muted-foreground/50">—</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    {flag && <span className="text-lg leading-none">{flag}</span>}
                    {row.country && <span className="text-[10px] text-muted-foreground uppercase">{row.country}</span>}
                  </div>
                  <div className="text-center">
                    {row.emailCount ? (
                      <span className="text-[10px] font-semibold text-foreground">{row.emailCount}</span>
                    ) : (
                      <span className="text-[10px] text-muted-foreground/30">—</span>
                    )}
                  </div>
                  <Badge variant="outline" className={cn("text-[9px] px-1.5 py-0.5", ORIGIN_BADGE_CLASS[row.source])}>
                    {sourceLabel(row.source)}
                  </Badge>
                  <div className="flex items-center gap-1" title={
                    isLive ? "Arricchimento in corso..." :
                    isLiveDone && liveState.status === "done" ? `Slug: ${liveState.slug ? "✓" : "—"} | Logo: ${liveState.logo ? "✓" : "—"} | Sito: ${liveState.site ? "✓" : "—"}` :
                    undefined
                  }>
                    {isLive ? (
                      <Loader2 className="w-3.5 h-3.5 text-primary animate-spin" />
                    ) : (
                      <>
                        {(row.hasLinkedin || (isLiveDone && liveState.status === "done" && liveState.slug)) ? (
                          <EnrichmentDetailPopover row={row} kind="linkedin">
                            <Linkedin className={cn(
                              "w-3.5 h-3.5 text-primary",
                              isLiveDone && liveState.status === "done" && liveState.slug && "drop-shadow-[0_0_4px_hsl(var(--primary))]"
                            )} />
                          </EnrichmentDetailPopover>
                        ) : (
                          <Linkedin className="w-3.5 h-3.5 text-muted-foreground/20" />
                        )}
                        {(row.hasLogo || (isLiveDone && liveState.status === "done" && liveState.logo)) ? (
                          <EnrichmentDetailPopover row={row} kind="logo">
                            <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          </EnrichmentDetailPopover>
                        ) : (
                          <ImageOff className="w-3.5 h-3.5 text-muted-foreground/20" />
                        )}
                        {(row.hasWebsiteExcerpt || (isLiveDone && liveState.status === "done" && liveState.site)) && (
                          <EnrichmentDetailPopover row={row} kind="site">
                            <Globe className={cn(
                              "w-3.5 h-3.5 text-primary",
                              isLiveDone && liveState.status === "done" && liveState.site && "drop-shadow-[0_0_4px_hsl(var(--primary))]"
                            )} />
                          </EnrichmentDetailPopover>
                        )}
                        {isLiveDone && (
                          <EnrichmentDetailPopover row={row} kind="fresh">
                            <span className="text-[10px]">✨</span>
                          </EnrichmentDetailPopover>
                        )}
                      </>
                    )}
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <button className="p-0.5 rounded hover:bg-accent transition-colors">
                        <MoreVertical className="w-3.5 h-3.5 text-muted-foreground" />
                      </button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="min-w-[160px]">
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => onDeepSearch([row])}>
                        <Brain className="w-3.5 h-3.5" /> Deep Search
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs gap-2" onClick={() => {
                        const query = encodeURIComponent(`${row.name} company logo`);
                        window.open(`https://www.google.com/search?tbm=isch&q=${query}`, "_blank");
                      }}>
                        <Image className="w-3.5 h-3.5" /> Cerca Logo Google
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-xs gap-2">
                        <Linkedin className="w-3.5 h-3.5" /> Cerca LinkedIn
                      </DropdownMenuItem>
                      {row.linkedinUrl && (
                        <DropdownMenuItem className="text-xs gap-2" onClick={() => window.open(row.linkedinUrl, "_blank")}>
                          <Linkedin className="w-3.5 h-3.5" /> Apri LinkedIn
                        </DropdownMenuItem>
                      )}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </>
  );
}
