import { useState, useMemo } from "react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Search, Mail, Phone, User, Building2, ChevronRight
} from "lucide-react";
import { useAllActivities, type AllActivity } from "@/hooks/useActivities";
import { groupByCountry } from "@/lib/groupByCountry";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";

const LinkedInIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" className={cn("w-3 h-3 fill-current", className)}>
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
  </svg>
);

interface ContactListPanelProps {
  selectedActivityId: string | null;
  onSelect: (activity: AllActivity) => void;
}

export default function ContactListPanel({ selectedActivityId, onSelect }: ContactListPanelProps) {
  const { data: activities, isLoading } = useAllActivities();
  const [search, setSearch] = useState("");

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
          <Skeleton key={i} className="h-16 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      <div className="p-3 border-b border-border/30">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca partner..."
            className="pl-9 h-9 text-sm bg-background/50 border-border/30"
          />
        </div>
        <p className="text-[11px] text-muted-foreground mt-2">
          {filtered.length} attività email in {grouped.length} paesi
        </p>
      </div>

      <ScrollArea className="flex-1">
        <div className="p-2 space-y-1">
          {grouped.map(({ countryCode, countryName, items }) => (
            <div key={countryCode} className="mb-2">
              <div className="flex items-center gap-2 px-2 py-1.5 text-xs font-semibold text-muted-foreground uppercase tracking-wide">
                <span>{getCountryFlag(countryCode)}</span>
                <span>{countryName}</span>
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{items.length}</Badge>
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
                      "w-full text-left p-3 rounded-lg transition-all duration-200 group",
                      "hover:bg-accent/50 hover:scale-[1.01] hover:shadow-sm",
                      isSelected
                        ? "bg-primary/10 border border-primary/30 shadow-sm shadow-primary/10"
                        : "border border-transparent"
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className={cn(
                        "w-8 h-8 rounded-lg flex items-center justify-center shrink-0 transition-colors",
                        isSelected ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"
                      )}>
                        <Building2 className="w-4 h-4" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5">
                          <span className="font-medium text-sm truncate">{companyDisplay}</span>
                          {activity.partners?.company_alias && activity.partners?.company_alias !== activity.partners?.company_name && (
                            <Badge variant="outline" className="text-[9px] h-4 shrink-0">alias</Badge>
                          )}
                        </div>
                        {contact ? (
                          <div className="flex items-center gap-1 mt-0.5">
                            <User className="w-3 h-3 text-muted-foreground" />
                            <span className="text-xs text-muted-foreground truncate">
                              {displayName}
                              {contact.title && ` · ${contact.title}`}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[11px] text-warning">Nessun contatto selezionato</span>
                        )}
                        <div className="flex items-center gap-1.5 mt-1">
                          {hasEmail && <Mail className="w-3 h-3 text-primary/60" />}
                          {(contact?.direct_phone || contact?.mobile) && (
                            <Phone className="w-3 h-3 text-primary/60" />
                          )}
                        </div>
                      </div>
                      <ChevronRight className={cn(
                        "w-4 h-4 shrink-0 transition-transform text-muted-foreground",
                        isSelected && "text-primary rotate-90"
                      )} />
                    </div>
                  </button>
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
    </div>
  );
}
