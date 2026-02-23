import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Mail, Phone, User, Building2, ChevronRight } from "lucide-react";
import { useAllActivities, type AllActivity } from "@/hooks/useActivities";
import { groupByCountry } from "@/lib/groupByCountry";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";

interface ContactListPanelProps {
  selectedActivityId: string | null;
  onSelect: (activity: AllActivity) => void;
  search?: string;
}

export default function ContactListPanel({ selectedActivityId, onSelect, search = "" }: ContactListPanelProps) {
  const { data: activities, isLoading } = useAllActivities();

  const emailActivities = useMemo(() => {
    if (!activities) return [];
    return activities.filter(
      (a) => a.activity_type === "send_email" && a.status !== "completed"
    );
  }, [activities]);

  const filtered = useMemo(() => {
    if (!search.trim()) return emailActivities;
    const q = search.toLowerCase();
    return emailActivities.filter((a) =>
      a.partners?.company_name?.toLowerCase().includes(q) ||
      a.partners?.company_alias?.toLowerCase().includes(q) ||
      a.partners?.country_name?.toLowerCase().includes(q) ||
      a.partners?.city?.toLowerCase().includes(q) ||
      a.selected_contact?.name?.toLowerCase().includes(q) ||
      a.selected_contact?.contact_alias?.toLowerCase().includes(q)
    );
  }, [emailActivities, search]);

  const grouped = useMemo(
    () =>
      groupByCountry(
        filtered,
        (a) => a.partners?.country_code || "??",
        (a) => a.partners?.country_name || "?"
      ),
    [filtered]
  );

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
      <div className="px-3 py-2 border-b border-stone-200/60">
        <p className="text-[11px] text-stone-400 font-medium">
          {filtered.length} attività email · {grouped.length} paesi
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-1.5 space-y-0.5">
          {grouped.map(({ countryCode, countryName, items }) => (
            <div key={countryCode} className="mb-1">
              <div className="flex items-center gap-2 px-2 py-1.5 text-[11px] font-semibold text-stone-400 uppercase tracking-wider">
                <span>{getCountryFlag(countryCode)}</span>
                <span>{countryName}</span>
                <Badge className="text-[9px] h-4 px-1.5 bg-stone-100 text-stone-500 hover:bg-stone-100 border-0">
                  {items.length}
                </Badge>
              </div>
              {items.map((activity) => {
                const isSelected = activity.id === selectedActivityId;
                const contact = activity.selected_contact;
                const hasEmail = !!contact?.email;
                const displayName = contact?.contact_alias || contact?.name;
                const companyDisplay = activity.partners?.company_alias || activity.partners?.company_name;

                return (
                  <button
                    key={activity.id}
                    onClick={() => onSelect(activity)}
                    className={cn(
                      "w-full text-left p-2.5 rounded-lg transition-all duration-150 group",
                      "hover:bg-stone-50",
                      isSelected
                        ? "bg-violet-50/50 border border-violet-300/50 shadow-sm"
                        : "border border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      <div className={cn(
                        "w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-violet-100 text-violet-600" : "bg-stone-100 text-stone-400"
                      )}>
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm text-stone-700 truncate">{companyDisplay}</span>
                        </div>
                        {contact ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-stone-400" />
                            <span className="text-xs text-stone-500 truncate">
                              {displayName}
                              {contact.title && ` · ${contact.title}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-amber-500">Nessun contatto</span>
                        )}
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {hasEmail && <Mail className="w-3 h-3 text-violet-400" />}
                          {(contact?.direct_phone || contact?.mobile) && (
                            <Phone className="w-3 h-3 text-violet-400" />
                          )}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-3.5 h-3.5 shrink-0 transition-transform text-stone-300",
                        isSelected && "text-violet-400 rotate-90"
                      )} />
                    </div>
                  </button>
                );
              })}
            </div>
          ))}
          {grouped.length === 0 && (
            <div className="text-center py-8 text-stone-400 text-sm">
              Nessuna attività email trovata
            </div>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
