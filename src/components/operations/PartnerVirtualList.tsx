import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, ChevronRight, Trophy } from "lucide-react";
import { getPartnerContactQuality } from "@/hooks/useContactCompleteness";
import { getYearsMember } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { getRealLogoUrl } from "@/lib/partnerUtils";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { StatusDot } from "./partner-list/SubComponents";

interface Props {
  partners: any[];
  isLoading: boolean;
  isDark: boolean;
  selectedPartnerId?: string | null;
  onSelect: (id: string) => void;
  onEmailClick: (target: { email: string; name: string; company: string; partnerId: string }) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
}

export function PartnerVirtualList({ partners, isLoading, isDark, selectedPartnerId, onSelect, onEmailClick }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: partners.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 52,
    overscan: 15,
  });

  if (isLoading) {
    return (
      <div className="flex-1 min-h-0 p-3 space-y-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="space-y-2">
            <Skeleton className="h-5 w-40" />
            <Skeleton className="h-4 w-28" />
          </div>
        ))}
      </div>
    );
  }

  return (
    <div ref={parentRef} className="flex-1 min-h-0 overflow-y-auto overflow-x-hidden">
      <div style={{ height: `${virtualizer.getTotalSize()}px`, width: "100%", position: "relative" }}>
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const partner = partners[virtualRow.index] as any;
          const contacts = partner.partner_contacts || [];
          const primaryContact = contacts.find((c: any) => c.is_primary) || contacts[0];
          const hasProfile = !!partner.raw_profile_html;
          const hasEmail = !!partner.email || contacts.some((c: any) => c.email);
          const hasPhone = !!partner.phone || contacts.some((c: any) => c.direct_phone || c.mobile);
          const hasDeep = !!(partner.enrichment_data as any)?.deep_search_at;
          const years = getYearsMember(partner.member_since);

          return (
            <div
              key={partner.id}
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                width: "100%",
                height: `${virtualRow.size}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
              onClick={() => onSelect(partner.id)}
              className={cn(
                "px-3 py-2 cursor-pointer transition-all duration-150 group",
                selectedPartnerId === partner.id
                  ? isDark ? "bg-sky-950/40" : "bg-sky-50"
                  : isDark ? "hover:bg-white/[0.04]" : "hover:bg-sky-50/40",
              )}
            >
              <div className="flex items-center gap-2.5">
                {getRealLogoUrl(partner.logo_url) ? (
                  <img src={getRealLogoUrl(partner.logo_url)!} alt="" className="w-7 h-7 rounded-md object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                ) : (
                  <div className={cn("w-7 h-7 rounded-md shrink-0 flex items-center justify-center text-[10px] font-bold", isDark ? "bg-white/[0.06] text-slate-500" : "bg-slate-100 text-slate-400")}>
                    {partner.company_name?.charAt(0)}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("font-bold text-xs truncate", isDark ? "text-slate-100" : "text-slate-800")}>{partner.company_name}</p>
                    {partner.company_alias && (
                      <span className={cn("text-[9px] px-1 py-0.5 rounded shrink-0", isDark ? "bg-teal-900/30 text-teal-400" : "bg-teal-100 text-teal-700")}>{partner.company_alias}</span>
                    )}
                    {years > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Trophy className="w-3 h-3 text-amber-500 fill-amber-500" />
                        <span className="text-[10px] font-bold text-amber-500">{years}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className={cn("text-[11px] truncate", isDark ? "text-slate-400" : "text-slate-500")}>{partner.city}</span>
                    {partner.rating > 0 && <MiniStars rating={Number(partner.rating)} size="w-2.5 h-2.5" />}
                    {primaryContact && (
                      <span className={cn("text-[10px] truncate max-w-[80px]", isDark ? "text-slate-500" : "text-slate-400")}>· {primaryContact.name}</span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <StatusDot ok={hasProfile} label="Profilo" isDark={isDark} />
                  <StatusDot ok={hasEmail} label="Email" isDark={isDark} />
                  <StatusDot ok={hasPhone} label="Telefono" isDark={isDark} />
                  <StatusDot ok={hasDeep} label="Deep Search" isDark={isDark} />
                </div>
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {primaryContact?.email && (
                    <button onClick={(e) => { e.stopPropagation(); onEmailClick({ email: primaryContact.email, name: primaryContact.name, company: partner.company_name, partnerId: partner.id }); }}
                      className={cn("p-1 rounded-md transition-all", isDark ? "text-sky-400 hover:bg-sky-500/20" : "text-sky-600 hover:bg-sky-50")}>
                      <Send className="w-3 h-3" />
                    </button>
                  )}
                  <ChevronRight className={cn("w-3.5 h-3.5", isDark ? "text-slate-600" : "text-slate-300")} />
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
