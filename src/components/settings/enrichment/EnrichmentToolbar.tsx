/**
 * EnrichmentToolbar — Search, filter dropdown, and stats bar
 */
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Search, Filter, CheckCircle2, Linkedin, Globe, ImageOff, XCircle, Rocket, StopCircle, Loader2,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { EnrichFilter } from "@/hooks/useEnrichmentData";
import type { BaseEnrichmentProgress } from "@/hooks/useBaseEnrichment";
import { ReactNode } from "react";

interface FilterOption {
  value: EnrichFilter;
  label: string;
  icon: ReactNode;
}

const ENRICH_FILTERS: FilterOption[] = [
  { value: "all", label: "Tutti", icon: <Filter className="w-3 h-3" /> },
  { value: "with-logo", label: "Con logo", icon: <CheckCircle2 className="w-3 h-3" /> },
  { value: "no-logo", label: "Senza logo", icon: <ImageOff className="w-3 h-3" /> },
  { value: "with-linkedin", label: "Con LinkedIn", icon: <Linkedin className="w-3 h-3" /> },
  { value: "no-linkedin", label: "Senza LinkedIn", icon: <XCircle className="w-3 h-3" /> },
  { value: "with-domain", label: "Con dominio", icon: <Globe className="w-3 h-3" /> },
  { value: "no-domain", label: "Senza dominio", icon: <XCircle className="w-3 h-3" /> },
];

interface Props {
  search: string;
  enrichFilter: EnrichFilter;
  stats: { total: number; withDomain: number; withLinkedin: number; withLogo: number };
  onSearchChange: (v: string) => void;
  onFilterChange: (v: EnrichFilter) => void;
  baseEnrichment?: {
    progress: BaseEnrichmentProgress;
    selectedCount: number;
    onStart: () => void | Promise<void>;
    onStop: () => void;
  };
}

export function EnrichmentToolbar({ search, enrichFilter, stats, onSearchChange, onFilterChange, baseEnrichment }: Props) {
  const isRunning = baseEnrichment?.progress.status === "running";
  const showProgressBar = baseEnrichment && baseEnrichment.progress.status !== "idle" && baseEnrichment.progress.total > 0;
  const pct = baseEnrichment && baseEnrichment.progress.total > 0
    ? (baseEnrichment.progress.done / baseEnrichment.progress.total) * 100
    : 0;

  return (
    <div className="space-y-1.5">
    <div className="flex items-center gap-2 flex-wrap">
      <div className="relative flex-1 min-w-[180px] max-w-xs">
        <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-muted-foreground/60" />
        <Input placeholder="Cerca nome, dominio, email..." value={search} onChange={e => onSearchChange(e.target.value)} className="pl-8 h-8 text-xs" />
      </div>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
            <Filter className="w-3.5 h-3.5" />
            {ENRICH_FILTERS.find(f => f.value === enrichFilter)?.label || "Tutti"}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start">
          {ENRICH_FILTERS.map(f => (
            <DropdownMenuItem key={f.value} onClick={() => onFilterChange(f.value)} className={cn("text-xs gap-2", enrichFilter === f.value && "bg-accent")}>
              {f.icon} {f.label}
            </DropdownMenuItem>
          ))}
        </DropdownMenuContent>
      </DropdownMenu>

      {baseEnrichment && (
        <Button
          size="sm"
          onClick={isRunning ? baseEnrichment.onStop : baseEnrichment.onStart}
          disabled={!isRunning && baseEnrichment.selectedCount === 0}
          variant={isRunning ? "destructive" : "default"}
          className="h-8 text-xs gap-1.5"
          title={isRunning ? "Stop arricchimento" : (baseEnrichment.selectedCount === 0 ? "Seleziona almeno una riga" : "Avvia arricchimento base (LinkedIn slug + logo + scrape sito)")}
        >
          {isRunning ? (
            <><StopCircle className="w-3.5 h-3.5" /> Stop</>
          ) : (
            <><Rocket className="w-3.5 h-3.5" /> Arricchimento Base{baseEnrichment.selectedCount > 0 ? ` (${baseEnrichment.selectedCount})` : ""}</>
          )}
        </Button>
      )}

      <div className="flex items-center gap-3 ml-auto text-[10px] text-muted-foreground">
        {isRunning && baseEnrichment ? (
          <span className="flex items-center gap-1 text-primary font-semibold">
            <Loader2 className="w-3 h-3 animate-spin" />
            Arricchendo: {baseEnrichment.progress.done}/{baseEnrichment.progress.total}
          </span>
        ) : (
          <>
        <span>{stats.total} totali</span>
        <span className="flex items-center gap-0.5"><Globe className="w-3 h-3" /> {stats.withDomain}</span>
        <span className="flex items-center gap-0.5"><Linkedin className="w-3 h-3" /> {stats.withLinkedin}</span>
        <span className="flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" /> {stats.withLogo}</span>
          </>
        )}
      </div>
    </div>

    {showProgressBar && baseEnrichment && (
      <div className="space-y-1">
        <Progress value={pct} className="h-1" />
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          <span className="truncate max-w-[60%]">
            {isRunning && baseEnrichment.progress.currentName ? `· ${baseEnrichment.progress.currentName}` : baseEnrichment.progress.status === "done" ? "✅ Completato" : baseEnrichment.progress.status === "paused" ? "In pausa" : ""}
          </span>
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-0.5"><Linkedin className="w-2.5 h-2.5 text-primary" /> {baseEnrichment.progress.slugFound}</span>
            <span className="flex items-center gap-0.5"><CheckCircle2 className="w-2.5 h-2.5 text-emerald-500" /> {baseEnrichment.progress.logoFound}</span>
            <span className="flex items-center gap-0.5"><Globe className="w-2.5 h-2.5 text-primary" /> {baseEnrichment.progress.siteScraped}</span>
            {baseEnrichment.progress.errors > 0 && <span className="text-destructive">⚠ {baseEnrichment.progress.errors}</span>}
          </div>
        </div>
      </div>
    )}
    </div>
  );
}
