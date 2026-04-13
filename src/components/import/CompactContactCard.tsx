import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Mail, Phone, Eye } from "lucide-react";
import type { ImportedContact } from "@/hooks/useImportLogs";

interface CompactContactCardProps {
  contact: ImportedContact;
  isSelected: boolean;
  onToggleSelect: (selected: boolean) => void;
  onQuickEmail?: () => void;
  onQuickCall?: () => void;
  onViewDetail?: () => void;
}

// Country code to flag emoji
function countryFlag(country: string | null): string {
  if (!country) return "🌍";
  const code = country.trim().toUpperCase().slice(0, 2);
  if (code.length !== 2) return "🌍";
  return String.fromCodePoint(...[...code].map(c => 0x1F1E6 + c.charCodeAt(0) - 65));
}

// Origin-based left border accent
function getOriginAccent(origin: string | null): string {
  switch (origin?.toLowerCase()) {
    case "wca": return "from-chart-1/60 to-chart-1/20";
    case "import": return "from-chart-3/60 to-chart-3/20";
    case "bca": return "from-amber-500/60 to-amber-500/20";
    case "manual": return "from-emerald-500/60 to-emerald-500/20";
    case "report_aziende": return "from-chart-4/60 to-chart-4/20";
    default: return "from-muted-foreground/40 to-muted-foreground/10";
  }
}

export function CompactContactCard({
  contact,
  isSelected,
  onToggleSelect,
  onQuickEmail,
  onQuickCall,
  onViewDetail,
}: CompactContactCardProps) {
  const c = contact;
  const transferred = c.is_transferred;

  return (
    <div
      className={`group relative rounded-lg border p-2.5 text-xs transition-all overflow-hidden ${
        transferred
          ? "opacity-50 bg-muted/30"
          : isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30 hover:shadow-sm"
      }`}
    >
      {/* Origin accent border */}
      <div className={`absolute left-0 top-0 bottom-0 w-[3px] bg-gradient-to-b rounded-l ${getOriginAccent(c.origin)}`} />
      <div className="flex items-start gap-2">
        <Checkbox
          checked={isSelected}
          disabled={transferred}
          onCheckedChange={(v) => onToggleSelect(!!v)}
          className="mt-0.5"
        />
        <div className="flex-1 min-w-0 space-y-1">
          {/* Row 1: Company + flag */}
          <div className="flex items-center gap-1.5">
            <span className="text-sm">{countryFlag(c.country)}</span>
            <span className="font-semibold truncate text-foreground">
              {c.company_name || "—"}
            </span>
          </div>

          {/* Row 2: Contact name + position */}
          {c.name && (
            <div className="text-muted-foreground truncate">
              {c.name}
              {c.position && (
                <span className="ml-1 text-[10px] text-primary/70">• {c.position}</span>
              )}
            </div>
          )}

          {/* Row 3: Location */}
          <div className="text-muted-foreground truncate">
            {[c.city, c.country].filter(Boolean).join(", ") || "—"}
          </div>

          {/* Row 4: Email/phone hints */}
          <div className="flex items-center gap-2 flex-wrap">
            {c.email && (
              <span className="inline-flex items-center gap-1 text-xs text-sky-400 font-medium truncate max-w-[160px]" title={c.email}>
                <Mail className="w-3 h-3 shrink-0" /> {c.email}
              </span>
            )}
            {c.phone && (
              <span className="inline-flex items-center gap-1 text-xs text-emerald-400 font-medium truncate max-w-[120px]" title={c.phone}>
                <Phone className="w-3 h-3 shrink-0" /> {c.phone}
              </span>
            )}
          </div>

          {/* Badges */}
          <div className="flex items-center gap-1 flex-wrap">
            {c.origin && (
              <Badge variant="outline" className="text-[9px] px-1 py-0">
                {c.origin}
              </Badge>
            )}
            {transferred && (
              <Badge variant="secondary" className="text-[9px] px-1 py-0">
                Trasferito
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Quick action icons — visible on hover */}
      {!transferred && (
        <div className="absolute top-1.5 right-1.5 flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
          {c.email && onQuickEmail && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onQuickEmail(); }}
              title="Crea attività email"
              aria-label="Invia"
            >
              <Mail className="w-3 h-3" />
            </Button>
          )}
          {(c.phone || c.mobile) && onQuickCall && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onQuickCall(); }}
              title="Crea attività chiamata"
              aria-label="Chiama"
            >
              <Phone className="w-3 h-3" />
            </Button>
          )}
          {onViewDetail && (
            <Button
              variant="ghost"
              size="icon"
              className="h-6 w-6"
              onClick={(e) => { e.stopPropagation(); onViewDetail(); }}
              title="Dettaglio"
            >
              <Eye className="w-3 h-3" />
            </Button>
          )}
        </div>
      )}
    </div>
  );
}
