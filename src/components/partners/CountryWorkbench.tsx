import { useState, useMemo, useCallback } from "react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { WCA_COUNTRIES } from "@/data/wcaCountries";
import {
  ArrowLeft,
  Users,
  Phone,
  Mail,
  AlertTriangle,
  Download,
  CheckCircle2,
  CheckSquare,
  MapPin,
  Star,
} from "lucide-react";

interface CountryWorkbenchProps {
  countryCode: string;
  partners: any[];
  onBack: () => void;
  onSelectPartner: (id: string) => void;
  selectedId: string | null;
  selectedIds: Set<string>;
  onToggleSelection: (id: string) => void;
  onSelectAllFiltered: (ids: string[]) => void;
  onDownloadProfiles?: (countryCode: string) => void;
}

type WorkbenchFilter = "all" | "with_phone" | "with_email" | "no_phone" | "no_email" | "no_profile";

const hasPhone = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.mobile || c.direct_phone);
const hasEmail = (p: any) =>
  (p.partner_contacts || []).some((c: any) => c.email);
const hasProfile = (p: any) => !!p.raw_profile_html;

export function CountryWorkbench({
  countryCode,
  partners,
  onBack,
  onSelectPartner,
  selectedId,
  selectedIds,
  onToggleSelection,
  onSelectAllFiltered,
  onDownloadProfiles,
}: CountryWorkbenchProps) {
  const [filter, setFilter] = useState<WorkbenchFilter>("all");

  const countryName = WCA_COUNTRIES.find((c) => c.code === countryCode)?.name || countryCode;
  const flag = getCountryFlag(countryCode);

  // Country partners
  const countryPartners = useMemo(
    () => (partners || []).filter((p: any) => p.country_code === countryCode),
    [partners, countryCode]
  );

  // Stats
  const stats = useMemo(() => {
    const total = countryPartners.length;
    const withProfile = countryPartners.filter(hasProfile).length;
    const withPhone = countryPartners.filter(hasPhone).length;
    const withEmail = countryPartners.filter(hasEmail).length;
    const noProfile = total - withProfile;
    const noPhone = total - withPhone;
    const noEmail = total - withEmail;
    return { total, withProfile, withPhone, withEmail, noProfile, noPhone, noEmail };
  }, [countryPartners]);

  // Filtered list
  const filteredPartners = useMemo(() => {
    let list = countryPartners;
    switch (filter) {
      case "with_phone": list = list.filter(hasPhone); break;
      case "with_email": list = list.filter(hasEmail); break;
      case "no_phone": list = list.filter((p) => !hasPhone(p)); break;
      case "no_email": list = list.filter((p) => !hasEmail(p)); break;
      case "no_profile": list = list.filter((p) => !hasProfile(p)); break;
    }
    return list.sort((a: any, b: any) => a.company_name.localeCompare(b.company_name));
  }, [countryPartners, filter]);

  const allSelected = filteredPartners.length > 0 && filteredPartners.every((p: any) => selectedIds.has(p.id));

  const handleSelectAll = useCallback(() => {
    onSelectAllFiltered(allSelected ? [] : filteredPartners.map((p: any) => p.id));
  }, [allSelected, filteredPartners, onSelectAllFiltered]);

  const filters: { key: WorkbenchFilter; label: string; count: number; color?: string }[] = [
    { key: "all", label: "Tutti", count: stats.total },
    { key: "with_phone", label: "Con Tel", count: stats.withPhone },
    { key: "with_email", label: "Con Email", count: stats.withEmail },
    { key: "no_phone", label: "Senza Tel", count: stats.noPhone, color: "text-amber-600 dark:text-amber-400" },
    { key: "no_email", label: "Senza Email", count: stats.noEmail, color: "text-amber-600 dark:text-amber-400" },
    { key: "no_profile", label: "Senza Profilo", count: stats.noProfile, color: "text-destructive" },
  ];

  return (
    <div className="flex flex-col h-full">
      {/* Back header */}
      <div className="p-4 border-b border-border/50">
        <button
          onClick={onBack}
          className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors mb-3"
        >
          <ArrowLeft className="w-4 h-4" />
          Torna ai Paesi
        </button>
        <div className="flex items-center gap-3">
          <span className="text-3xl">{flag}</span>
          <div>
            <h2 className="text-lg font-bold">{countryName}</h2>
            <p className="text-xs text-muted-foreground">{stats.total} partner totali</p>
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="p-4 border-b border-border/50">
        <div className="grid grid-cols-3 gap-2">
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <p className="text-lg font-bold">{stats.withProfile}</p>
            <p className="text-[10px] text-muted-foreground">Con profilo</p>
          </div>
          <div className={cn(
            "text-center p-2 rounded-lg",
            stats.noProfile > 0 ? "bg-destructive/10" : "bg-muted/50"
          )}>
            <p className={cn("text-lg font-bold", stats.noProfile > 0 && "text-destructive")}>
              {stats.noProfile}
            </p>
            <p className="text-[10px] text-muted-foreground">Senza profilo</p>
          </div>
          <div className="text-center p-2 rounded-lg bg-muted/50">
            <div className="flex items-center justify-center gap-2">
              <div>
                <p className="text-sm font-bold flex items-center gap-1">
                  <Phone className="w-3 h-3" /> {stats.withPhone}
                </p>
              </div>
              <div>
                <p className="text-sm font-bold flex items-center gap-1">
                  <Mail className="w-3 h-3" /> {stats.withEmail}
                </p>
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground">Contatti</p>
          </div>
        </div>

        {/* Download missing profiles */}
        {stats.noProfile > 0 && onDownloadProfiles && (
          <Button
            variant="outline"
            size="sm"
            className="w-full mt-3 gap-2 border-amber-400 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            onClick={() => onDownloadProfiles(countryCode)}
          >
            <Download className="w-4 h-4" />
            Scarica {stats.noProfile} profili mancanti
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="px-4 py-3 border-b border-border/50">
        <div className="flex flex-wrap gap-1.5">
          {filters.map((f) => (
            <button
              key={f.key}
              onClick={() => setFilter(f.key)}
              className={cn(
                "text-xs px-2.5 py-1 rounded-lg border transition-all",
                filter === f.key
                  ? "bg-primary/10 border-primary/30 text-primary font-medium"
                  : "bg-muted border-border text-muted-foreground hover:bg-accent"
              )}
            >
              {f.label} <span className={cn("font-semibold ml-0.5", f.color)}>{f.count}</span>
            </button>
          ))}
        </div>
      </div>

      {/* List header */}
      <div className="px-4 py-2 flex items-center justify-between border-b border-border/50">
        <span className="text-xs text-muted-foreground">
          {filteredPartners.length} partner
        </span>
        <button
          onClick={handleSelectAll}
          className={cn(
            "flex items-center gap-1 text-xs px-2 py-1 rounded-lg border transition-all",
            allSelected
              ? "bg-primary/10 border-primary/30 text-primary"
              : "bg-muted border-border text-muted-foreground hover:bg-accent"
          )}
        >
          <CheckSquare className="w-3 h-3" />
          {allSelected ? "Deseleziona" : "Sel. tutti"}
        </button>
      </div>

      {/* Partner list */}
      <ScrollArea className="flex-1">
        <div className="divide-y divide-border/50">
          {filteredPartners.map((partner: any) => {
            const pHasPhone = hasPhone(partner);
            const pHasEmail = hasEmail(partner);
            const pHasProfile = hasProfile(partner);
            const isSelected = selectedIds.has(partner.id);
            const contacts = partner.partner_contacts || [];

            return (
              <div
                key={partner.id}
                onClick={() => onSelectPartner(partner.id)}
                className={cn(
                  "px-4 py-2.5 cursor-pointer transition-colors flex items-center gap-2.5",
                  "hover:bg-accent/50",
                  selectedId === partner.id && "bg-accent",
                  isSelected && "bg-primary/5",
                  !pHasProfile && "border-l-4 border-l-destructive",
                )}
              >
                <div
                  onClick={(e) => {
                    e.stopPropagation();
                    onToggleSelection(partner.id);
                  }}
                  className="shrink-0"
                >
                  <Checkbox checked={isSelected} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{partner.company_name}</p>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground mt-0.5">
                    <span className="flex items-center gap-0.5">
                      <MapPin className="w-3 h-3" />
                      {partner.city}
                    </span>
                    {partner.rating > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                        {Number(partner.rating).toFixed(1)}
                      </span>
                    )}
                    <span className="text-[10px]">{contacts.length} cont.</span>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {pHasPhone && <Phone className="w-3.5 h-3.5 text-emerald-500" />}
                  {pHasEmail && <Mail className="w-3.5 h-3.5 text-sky-500" />}
                  {pHasProfile ? (
                    <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                  ) : (
                    <AlertTriangle className="w-3.5 h-3.5 text-destructive" />
                  )}
                </div>
              </div>
            );
          })}
          {filteredPartners.length === 0 && (
            <div className="p-8 text-center text-sm text-muted-foreground">
              Nessun partner con questo filtro
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
