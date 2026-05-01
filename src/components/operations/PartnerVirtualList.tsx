import { useRef } from "react";
import { useVirtualizer } from "@tanstack/react-virtual";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import { Send, ChevronRight, Trophy, Loader2, Plane } from "lucide-react";
import { getYearsMember, getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { getEffectiveLogoUrl, getEnrichmentSnippet, hasLinkedIn, hasWhatsApp } from "@/lib/partnerUtils";
import { MiniStars } from "@/components/partners/shared/MiniStars";
import { EnrichedStatusIcons } from "./partner-list/SubComponents";
import { OptimizedImage } from "@/components/shared/OptimizedImage";

interface Props {
  partners: Array<Record<string, unknown>>;
  isLoading: boolean;
  isDark: boolean;
  selectedPartnerId?: string | null;
  onSelect: (id: string) => void;
  onEmailClick: (target: { email: string; name: string; company: string; partnerId: string }) => void;
  selectedIds?: Set<string>;
  onToggleSelect?: (id: string) => void;
  loadMoreRef?: React.RefObject<HTMLDivElement>;
  hasNextPage?: boolean;
  isFetchingNextPage?: boolean;
}

export function PartnerVirtualList({ partners, isLoading, isDark, selectedPartnerId, onSelect, onEmailClick, selectedIds, onToggleSelect, loadMoreRef, hasNextPage, isFetchingNextPage }: Props) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: partners.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 62,
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
          type PartnerContact = { email?: string; name?: string; is_primary?: boolean; direct_phone?: string; mobile?: string; [k: string]: unknown };
          const partner = partners[virtualRow.index] as Record<string, unknown> & { id: string; partner_contacts?: PartnerContact[]; company_name?: string; company_alias?: string; city?: string; rating?: number; email?: string; phone?: string; lead_status?: string; member_since?: string | null; country_code?: string; raw_profile_html?: string; enrichment_data?: Record<string, unknown> };
          const contacts = partner.partner_contacts || [];
          const primaryContact = contacts.find((c) => c.is_primary) || contacts[0];
          const hasProfile = !!partner.raw_profile_html;
          const hasEmail = !!partner.email || contacts.some((c: Record<string, unknown>) => c.email);
          const hasPhone = !!partner.phone || contacts.some((c: Record<string, unknown>) => c.direct_phone || c.mobile);
          const hasDeep = !!partner.enrichment_data?.deep_search_at;
          const inHolding = partner.lead_status && partner.lead_status !== "new";
          const years = getYearsMember(partner.member_since as string | null);
          const logoUrl = getEffectiveLogoUrl(partner);
          const flag = getCountryFlag(partner.country_code as string);
          const snippet = getEnrichmentSnippet(partner);
          const hasLi = hasLinkedIn(partner);
          const hasWa = hasWhatsApp(partner);

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
                {onToggleSelect && (
                  <Checkbox
                    checked={selectedIds?.has(partner.id) || false}
                    onCheckedChange={() => onToggleSelect(partner.id)}
                    onClick={(e) => e.stopPropagation()}
                    className="shrink-0"
                  />
                )}
                {/* Logo / Flag fallback */}
                {logoUrl ? (
                  <OptimizedImage src={logoUrl} alt="" className="w-9 h-9 rounded-md object-contain bg-white/10 border border-white/10 shrink-0" onError={e => (e.target as HTMLImageElement).style.display = 'none'} />
                ) : (
                  <div className={cn("w-9 h-9 rounded-md shrink-0 flex items-center justify-center text-base leading-none", isDark ? "bg-white/[0.06]" : "bg-slate-100")}>
                    {flag !== "🌍" ? flag : <span className={cn("text-[11px] font-bold", isDark ? "text-slate-500" : "text-slate-400")}>{partner.company_name?.charAt(0)}</span>}
                  </div>
                )}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <p className={cn("font-bold text-xs truncate", isDark ? "text-slate-100" : "text-slate-800")}>{partner.company_name}</p>
                    {inHolding && (
                      <span title="In circuito di attesa">
                        <Plane className="w-3.5 h-3.5 text-primary shrink-0 animate-pulse" />
                      </span>
                    )}
                    {partner.company_alias && (
                      <span className={cn("text-[9px] px-1 py-0.5 rounded shrink-0", isDark ? "bg-emerald-900/30 text-emerald-400" : "bg-emerald-100 text-emerald-700")}>{partner.company_alias}</span>
                    )}
                    {years > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Trophy className="w-3 h-3 text-primary fill-primary" />
                        <span className="text-[10px] font-bold text-primary">{years}</span>
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-sm leading-none shrink-0">{flag}</span>
                    <span className={cn("text-[11px] truncate", isDark ? "text-slate-400" : "text-slate-500")}>{partner.city}</span>
                    {(partner.rating ?? 0) > 0 && <MiniStars rating={Number(partner.rating)} size="w-2.5 h-2.5" />}
                    {primaryContact && (
                      <span className={cn("text-[10px] truncate max-w-[80px]", isDark ? "text-slate-500" : "text-slate-400")}>· {String(primaryContact.name ?? "")}</span>
                    )}
                  </div>
                  {snippet && (
                    <p className={cn("text-[9px] truncate mt-0.5 italic", isDark ? "text-slate-500" : "text-slate-400")}>{snippet}</p>
                  )}
                </div>
                <EnrichedStatusIcons
                  hasProfile={hasProfile}
                  hasEmail={hasEmail}
                  hasPhone={hasPhone}
                  hasDeep={hasDeep}
                  hasLi={hasLi}
                  hasWa={hasWa}
                  isDark={isDark}
                />
                <div className="flex items-center gap-0.5 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                  {primaryContact?.email && (
                    <button onClick={(e) => { e.stopPropagation(); onEmailClick({ email: String(primaryContact.email), name: String(primaryContact.name ?? ""), company: partner.company_name ?? "", partnerId: partner.id }); }}
                      className={cn("p-1 rounded-md transition-all", isDark ? "text-primary hover:bg-primary/20" : "text-primary hover:bg-primary/10")}>
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
      {/* Infinite scroll sentinel */}
      {loadMoreRef && (
        <div ref={loadMoreRef as React.Ref<HTMLDivElement>} className="h-10 flex items-center justify-center">
          {isFetchingNextPage && (
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          )}
          {!isFetchingNextPage && hasNextPage && (
            <span className="text-[10px] text-muted-foreground">Scorri per caricare altri...</span>
          )}
        </div>
      )}
    </div>
  );
}
