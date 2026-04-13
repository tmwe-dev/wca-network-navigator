import { useMemo, useState, useEffect } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Mail, Phone, User, Building2, ChevronRight, AlertTriangle,
  Globe, Linkedin, MessageCircle, Send,
  Sparkles,
} from "lucide-react";
import ContactPicker from "@/components/workspace/ContactPicker";
import LinkedInDMDialog from "@/components/workspace/LinkedInDMDialog";
import { useAllActivities, type AllActivity } from "@/hooks/useActivities";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { groupByCountry } from "@/lib/groupByCountry";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { useGlobalFilters, type WorkspaceFilterKey } from "@/contexts/GlobalFiltersContext";

/* ── Helpers ── */

function getDisplayFields(a: AllActivity) {
  const p = a.partners;
  const m = a.source_meta || {};
  return {
    companyName: p?.company_alias || p?.company_name || m.company_name || a.title.replace(/^Email a /, ""),
    contactName: a.selected_contact?.contact_alias || a.selected_contact?.name || m.contact_name || null,
    countryCode: p?.country_code || m.country_code || "??",
    countryName: p?.country_name || m.country || (a.source_type === "prospect" ? "Italia" : "Import"),
    city: p?.city || m.city || null,
    isEnriched: !!p?.enriched_at,
    hasWebsite: !!p?.website || !!m.website,
    email: a.selected_contact?.email || m.email || null,
  };
}

function matchesFilter(a: AllActivity, f: WorkspaceFilterKey): boolean {
  const contact = a.selected_contact;
  const d = getDisplayFields(a);
  switch (f) {
    case "with_email": return !!contact?.email || !!d.email;
    case "no_email": return !contact?.email && !d.email;
    case "with_contact": return !!contact || !!d.contactName;
    case "no_contact": return !contact && !d.contactName;
    case "with_alias": return !!(contact?.contact_alias || a.partners?.company_alias);
    case "no_alias": return !contact?.contact_alias && !a.partners?.company_alias;
    case "enriched": return d.isEnriched;
    case "not_enriched": return !d.isEnriched;
  }
}

function useLinkedInLinks(partnerIds: string[]) {
  return useQuery({
    queryKey: ["linkedin-links-workspace", partnerIds],
    queryFn: async () => {
      if (!partnerIds.length) return {} as Record<string, string>;
      const { data, error } = await supabase
        .from("partner_social_links")
        .select("partner_id, url")
        .eq("platform", "linkedin")
        .in("partner_id", partnerIds);
      if (error) throw error;
      const map: Record<string, string> = {};
      (data || []).forEach((r) => { map[r.partner_id] = r.url; });
      return map;
    },
    enabled: partnerIds.length > 0,
    staleTime: 30_000,
  });
}

/* ── Component ── */

interface ContactListPanelProps {
  selectedActivityId: string | null;
  onSelect: (activity: AllActivity) => void;
  search?: string;
  sourceType?: "partner" | "prospect" | "contact";
  selectedIds: Set<string>;
  onToggleSelect: (id: string) => void;
  onSelectAll: (filteredIds: string[]) => void;
  onDeselectAll: () => void;
  onFilteredIdsChange?: (ids: string[]) => void;
}

export default function ContactListPanel({
  selectedActivityId, onSelect, search = "", sourceType,
  selectedIds, onToggleSelect, onSelectAll, onDeselectAll, onFilteredIdsChange,
}: ContactListPanelProps) {
  const { data: activities, isLoading } = useAllActivities();
  const { filters } = useGlobalFilters();
  const activeFilters = filters.workspaceFilters;
  const emailGenFilter = filters.emailGenFilter;
  const selectedCountries = filters.workspaceCountries;
  const [dmTarget, setDmTarget] = useState<{ url: string; contactName: string | null; companyName: string } | null>(null);

  const emailActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter(
      (a) => a.activity_type === "send_email" && a.status !== "completed" && a.status !== "cancelled" && (!sourceType || a.source_type === sourceType)
    );
  }, [activities, sourceType]);

  const partnerIds = useMemo(() => [...new Set(emailActivities.map((a) => a.partner_id).filter(Boolean))] as string[], [emailActivities]);
  const { data: linkedinMap } = useLinkedInLinks(partnerIds);

  const searched = useMemo(() => {
    if (!search.trim()) return emailActivities;
    const q = search.toLowerCase();
    return emailActivities.filter((a) => {
      const d = getDisplayFields(a);
      return d.companyName?.toLowerCase().includes(q) ||
        d.contactName?.toLowerCase().includes(q) ||
        d.countryName?.toLowerCase().includes(q) ||
        d.city?.toLowerCase().includes(q) ||
        a.title?.toLowerCase().includes(q) ||
        a.description?.toLowerCase().includes(q);
    });
  }, [emailActivities, search]);

  const filtered = useMemo(() => {
    let result = searched;

    if (activeFilters.size > 0) {
      result = result.filter((a) => {
        for (const f of activeFilters) { if (!matchesFilter(a, f)) return false; }
        return true;
      });
    }

    if (emailGenFilter === "generated") {
      result = result.filter((a) => !!a.email_subject);
    } else if (emailGenFilter === "to_generate") {
      result = result.filter((a) => !a.email_subject);
    }

    if (selectedCountries.size > 0) {
      result = result.filter((a) => {
        const d = getDisplayFields(a);
        return selectedCountries.has(d.countryCode);
      });
    }

    return result;
  }, [searched, activeFilters, emailGenFilter, selectedCountries]);

  const emailGenCounts = useMemo(() => {
    const generated = searched.filter((a) => !!a.email_subject).length;
    return { all: searched.length, generated, to_generate: searched.length - generated };
  }, [searched]);

  const grouped = useMemo(
    () => groupByCountry(filtered, (a) => getDisplayFields(a).countryCode, (a) => getDisplayFields(a).countryName),
    [filtered]
  );

  const filteredIds = useMemo(() => filtered.map((a) => a.id), [filtered]);
  const allSelected = filtered.length > 0 && filtered.every((a) => selectedIds.has(a.id));

  useEffect(() => {
    onFilteredIdsChange?.(filteredIds);
  }, [filteredIds, onFilteredIdsChange]);

  if (isLoading) {
    return (
      <div className="flex flex-col h-full p-4 space-y-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header with select-all and counts */}
      <div className="px-3 py-2 border-b border-border/30 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Checkbox checked={allSelected}
            onCheckedChange={() => allSelected ? onDeselectAll() : onSelectAll(filteredIds)} />
          <p className="text-[11px] text-muted-foreground font-medium">
            {selectedIds.size > 0 ? (
              <span className="text-primary font-bold">{selectedIds.size} selezionati</span>
            ) : (
              <>{filtered.length} attività · {grouped.length} paesi</>
            )}
          </p>
        </div>
        {/* Email gen mini-counters */}
        <div className="flex items-center gap-1.5 text-[10px]">
          <span className="text-success font-medium" title="Email generate">
            <Sparkles className="w-3 h-3 inline mr-0.5" />{emailGenCounts.generated}
          </span>
          <span className="text-muted-foreground">/</span>
          <span className="text-warning font-medium" title="Da generare">
            <Mail className="w-3 h-3 inline mr-0.5" />{emailGenCounts.to_generate}
          </span>
        </div>
      </div>


      {/* List */}
      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {grouped.map(({ countryCode, countryName, items }) => (
            <div key={countryCode} className="mb-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                <span>{getCountryFlag(countryCode)}</span>
                <span>{countryName}</span>
                <Badge className="text-[9px] h-4 px-1.5 bg-muted text-muted-foreground hover:bg-muted border-0">
                  {items.length}
                </Badge>
              </div>
              {items.map((activity) => {
                const isSelected = activity.id === selectedActivityId;
                const isChecked = selectedIds.has(activity.id);
                const contact = activity.selected_contact;
                const d = getDisplayFields(activity);
                const hasEmail = !!contact?.email || !!d.email;
                const displayName = d.contactName;
                const companyDisplay = d.companyName;
                const linkedinUrl = activity.partner_id ? linkedinMap?.[activity.partner_id] : undefined;
                const hasGeneratedEmail = !!activity.email_subject;

                return (
                  <div key={activity.id}
                    className={cn(
                      "flex items-start gap-2 p-2 rounded-md transition-colors duration-150 group",
                      "hover:bg-muted/50",
                      isSelected ? "bg-muted border border-primary/20" : "border border-transparent"
                    )}>
                    <Checkbox checked={isChecked} onCheckedChange={() => onToggleSelect(activity.id)} className="mt-1.5" />
                    <button onClick={() => onSelect(activity)} className="flex-1 text-left min-w-0">
                      <div className="flex items-start gap-2">
                        <div className={cn(
                          "w-7 h-7 rounded-md flex items-center justify-center shrink-0 transition-colors relative",
                          isSelected ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"
                        )}>
                          <Building2 className="w-3.5 h-3.5" />
                          {d.isEnriched && (
                            <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-success rounded-full border-2 border-background" title="Arricchito" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-1.5">
                            <span className="font-medium text-sm text-foreground truncate">{companyDisplay}</span>
                            {hasGeneratedEmail && (
                              <span title="Email generata"><Sparkles className="w-3 h-3 text-success shrink-0" /></span>
                            )}
                            {d.hasWebsite && <Globe className="w-3 h-3 text-primary/60 shrink-0" />}
                            {linkedinUrl && (
                              <>
                                <a href={linkedinUrl} target="_blank" rel="noopener noreferrer"
                                  onClick={(e) => e.stopPropagation()} title="LinkedIn">
                                  <Linkedin className="w-3 h-3 text-[#0A66C2] shrink-0 hover:scale-110 transition-transform" />
                                </a>
                                <button onClick={(e) => { e.stopPropagation(); setDmTarget({ url: linkedinUrl, contactName: displayName || null, companyName: companyDisplay || "" }); }}
                                  title="Invia messaggio LinkedIn" className="inline-flex">
                                  <Send className="w-3 h-3 text-[#0A66C2]/60 shrink-0 hover:text-[#0A66C2] hover:scale-110 transition-all" />
                                </button>
                              </>
                            )}
                          </div>
                          {activity.source_type === "partner" && activity.partner_id && !activity.selected_contact_id ? (
                            <div className="mt-0.5">
                              <ContactPicker
                                activityId={activity.id}
                                partnerId={activity.partner_id}
                                selectedContactId={activity.selected_contact_id}
                                compact
                              />
                            </div>
                          ) : (contact || displayName) ? (
                            <div className="flex items-center gap-1 mt-0.5">
                              <User className="w-3 h-3 text-muted-foreground" />
                              <span className="text-xs text-muted-foreground truncate">
                                {displayName}{contact?.title && ` · ${contact.title}`}
                              </span>
                            </div>
                          ) : (
                            <div className="flex items-center gap-1 mt-0.5">
                              <AlertTriangle className="w-3 h-3 text-warning" />
                              <span className="text-[11px] text-warning">Nessun contatto</span>
                            </div>
                          )}
                          <div className="space-y-0.5 mt-0.5">
                            {hasEmail ? (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-sky-400 shrink-0" />
                                <span className="text-[11px] text-sky-400 font-medium truncate max-w-[160px]">{contact?.email || d.email}</span>
                              </div>
                            ) : (contact || displayName) ? (
                              <div className="flex items-center gap-1">
                                <Mail className="w-3 h-3 text-destructive/60" />
                                <span className="text-[11px] text-destructive/80">No email</span>
                              </div>
                            ) : null}
                            {(contact?.direct_phone || contact?.mobile) && (
                              <div className="flex items-center gap-1">
                                <Phone className="w-3 h-3 text-emerald-400 shrink-0" />
                                <span className="text-[11px] text-emerald-400 font-medium truncate max-w-[120px]">{contact.mobile || contact.direct_phone}</span>
                                <a href={`https://wa.me/${(contact.mobile || contact.direct_phone || "").replace(/[^0-9+]/g, "")}`}
                                  target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}
                                  title="WhatsApp" className="inline-flex ml-0.5">
                                  <MessageCircle className="w-3 h-3 text-success hover:scale-110 transition-transform" />
                                </a>
                              </div>
                            )}
                          </div>
                        </div>
                        <ChevronRight className={cn(
                          "w-3.5 h-3.5 shrink-0 transition-transform text-muted-foreground/50",
                          isSelected && "text-primary rotate-90"
                        )} />
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="text-center py-8 text-muted-foreground text-sm">
              Nessuna attività email trovata
            </div>
          )}
        </div>
      </ScrollArea>

      {dmTarget && (
        <LinkedInDMDialog
          open={!!dmTarget}
          onOpenChange={(open) => { if (!open) setDmTarget(null); }}
          profileUrl={dmTarget.url}
          contactName={dmTarget.contactName}
          companyName={dmTarget.companyName}
        />
      )}
    </div>
  );
}
