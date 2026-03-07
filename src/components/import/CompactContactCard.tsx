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
      className={`group relative rounded-lg border p-2.5 text-xs transition-all ${
        transferred
          ? "opacity-50 bg-muted/30"
          : isSelected
          ? "border-primary/50 bg-primary/5 shadow-sm"
          : "border-border hover:border-primary/30 hover:shadow-sm"
      }`}
    >
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
