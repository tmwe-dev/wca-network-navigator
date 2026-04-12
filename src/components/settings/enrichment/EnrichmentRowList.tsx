/**
 * EnrichmentRowList — Header + scrollable row list
 */
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Mail, SortAsc, SortDesc, MoreVertical, Linkedin, CheckCircle2, ImageOff, Brain, Image,
} from "lucide-react";
import { CompanyLogo } from "@/components/ui/CompanyLogo";
import { cn } from "@/lib/utils";
import type { EnrichedRow, SortField, SortDir } from "@/hooks/useEnrichmentData";

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
  onToggleAll: () => void;
  onToggleOne: (id: string) => void;
  onToggleSort: (field: SortField) => void;
  onDeepSearch: (rows: EnrichedRow[]) => void;
}

export function EnrichmentRowList({
  rows, selected, allSelected, sortField, sortDir,
  onToggleAll, onToggleOne, onToggleSort, onDeepSearch,
}: Props) {
  const SortIcon = sortDir === "asc" ? SortAsc : SortDesc;

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

      {/* Rows */}
      <ScrollArea className="h-[calc(100vh-370px)] min-h-[250px] border border-t-0 border-border rounded-b-lg">
        <div className="divide-y divide-border/50">
          {rows.map((row) => {
            const isSelected = selected.has(row.id);
            const flag = getFlag(row.country);
            return (
              <div
                key={row.id}
                className={cn(
                  "grid grid-cols-[32px_28px_1fr_1fr_70px_50px_70px_60px_28px] items-center gap-2 px-3 py-2 transition-colors border-l-[3px]",
                  ORIGIN_ACCENT[row.source] || "border-l-transparent",
                  isSelected ? "bg-primary/5" : "hover:bg-accent/30"
                )}
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
                <div className="flex items-center gap-1">
                  <Linkedin className={cn("w-3.5 h-3.5", row.hasLinkedin ? "text-primary" : "text-muted-foreground/20")} />
                  {row.hasLogo ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <ImageOff className="w-3.5 h-3.5 text-muted-foreground/20" />
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
          {rows.length === 0 && (
            <div className="text-center py-10 text-sm text-muted-foreground">Nessun risultato trovato</div>
          )}
        </div>
      </ScrollArea>
    </>
  );
}
