import { useState, useMemo } from "react";
import { Mail, Phone, Search, CheckCircle2, Clock, Circle, Users, ChevronDown, ChevronRight } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import { getCountryFlag } from "@/lib/countries";
import type { CampaignJob } from "@/hooks/useCampaignJobs";
import type { PartnerContactRecord } from "@/hooks/useActivities";
import { cn } from "@/lib/utils";

interface JobListProps {
  jobs: CampaignJob[];
  contactsByPartner: Record<string, PartnerContactRecord[]>;
  focusedContactId: string | null;
  onFocusContact: (id: string) => void;
  selectedContactIds: Set<string>;
  onToggleContact: (id: string) => void;
  onSelectAll: () => void;
  onSelectAllWithEmail: () => void;
  onSelectAllWithPhone: () => void;
  onDeselectAll: () => void;
  totalContacts: number;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="w-3 h-3 text-muted-foreground/50" />,
  in_progress: <Clock className="w-3 h-3 text-amber-400" />,
  completed: <CheckCircle2 className="w-3 h-3 text-emerald-400" />,
  skipped: <Circle className="w-3 h-3 text-muted-foreground/30" />,
};

export function JobList({
  jobs, contactsByPartner, focusedContactId, onFocusContact,
  selectedContactIds, onToggleContact,
  onSelectAll, onSelectAllWithEmail, onSelectAllWithPhone, onDeselectAll,
  totalContacts,
}: JobListProps) {
  const [search, setSearch] = useState("");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");
  const [collapsedPartners, setCollapsedPartners] = useState<Set<string>>(new Set());

  // Filter jobs first
  const filteredJobs = useMemo(() => {
    return jobs.filter(j => {
      if (filterStatus === "pending" && (j.status === "completed" || j.status === "skipped")) return false;
      if (filterStatus === "completed" && j.status !== "completed") return false;
      if (search) {
        const s = search.toLowerCase();
        return j.company_name.toLowerCase().includes(s) || j.country_name.toLowerCase().includes(s) || (j.city || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [jobs, search, filterStatus]);

  const completedCount = jobs.filter(j => j.status === "completed").length;

  const toggleCollapse = (partnerId: string) => {
    setCollapsedPartners(prev => {
      const next = new Set(prev);
      if (next.has(partnerId)) next.delete(partnerId);
      else next.add(partnerId);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col border-r border-border">
      {/* Stats & Selection toolbar */}
      <div className="px-4 pt-4 pb-2 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant="secondary" className="gap-1">
            {selectedContactIds.size} / {totalContacts} selezionati
          </Badge>
          <Badge variant="outline" className="gap-1 text-emerald-600">
            <CheckCircle2 className="w-3 h-3" /> {completedCount} fatti
          </Badge>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            placeholder="Cerca azienda..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="pl-8 h-8 text-xs"
          />
        </div>

        {/* Quick selection buttons */}
        <div className="flex gap-1 text-xs flex-wrap">
          <Button variant="outline" size="sm" className="h-6 text-[11px] px-2" onClick={onSelectAll}>
            Tutti
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 gap-1" onClick={onSelectAllWithEmail}>
            <Mail className="w-3 h-3" /> Email
          </Button>
          <Button variant="outline" size="sm" className="h-6 text-[11px] px-2 gap-1" onClick={onSelectAllWithPhone}>
            <Phone className="w-3 h-3" /> Telefono
          </Button>
          <Button variant="ghost" size="sm" className="h-6 text-[11px] px-2" onClick={onDeselectAll}>
            Nessuno
          </Button>
          <div className="w-px bg-border mx-0.5" />
          {(["all", "pending", "completed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-2 py-0.5 rounded-md transition-colors",
                filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {s === "all" ? "Tutti" : s === "pending" ? "Aperti" : "Fatti"}
            </button>
          ))}
        </div>
      </div>

      {/* Grouped contact list */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-0.5">
          {filteredJobs.map(job => {
            const contacts = contactsByPartner[job.partner_id] || [];
            const isCollapsed = collapsedPartners.has(job.partner_id);

            return (
              <div key={job.id}>
                {/* Company header */}
                <button
                  onClick={() => toggleCollapse(job.partner_id)}
                  className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left text-xs font-semibold text-muted-foreground hover:bg-accent transition-colors"
                >
                  {isCollapsed
                    ? <ChevronRight className="w-3.5 h-3.5 shrink-0" />
                    : <ChevronDown className="w-3.5 h-3.5 shrink-0" />
                  }
                  {STATUS_ICONS[job.status]}
                  <span className="text-base leading-none">{getCountryFlag(job.country_code)}</span>
                  <span className="flex-1 truncate text-foreground">{job.company_name}</span>
                  <span className="text-[10px] text-muted-foreground shrink-0">
                    {job.city}
                  </span>
                  {contacts.length > 0 && (
                    <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground shrink-0">
                      <Users className="w-3 h-3" /> {contacts.length}
                    </span>
                  )}
                </button>

                {/* Contact rows */}
                {!isCollapsed && contacts.length > 0 && (
                  <div className="ml-3 space-y-0.5">
                    {contacts.map(contact => {
                      const hasEmail = !!contact.email;
                      const hasPhone = !!(contact.direct_phone || contact.mobile);
                      const isFocused = focusedContactId === contact.id;
                      const isSelected = selectedContactIds.has(contact.id);

                      return (
                        <div
                          key={contact.id}
                          className={cn(
                            "flex items-center gap-2 px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer",
                            isFocused
                              ? "bg-primary/10 border border-primary/30"
                              : "hover:bg-accent border border-transparent"
                          )}
                        >
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => onToggleContact(contact.id)}
                            className="shrink-0"
                            onClick={(e) => e.stopPropagation()}
                          />
                          <div
                            className="flex-1 min-w-0 flex items-center gap-2"
                            onClick={() => onFocusContact(contact.id)}
                          >
                            <span className="font-medium text-foreground truncate">{contact.name}</span>
                            {contact.contact_alias && <span className="text-[10px] px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 dark:bg-violet-900/30 dark:text-violet-400 shrink-0">{contact.contact_alias}</span>}
                            {contact.title && (
                              <span className="text-muted-foreground truncate hidden sm:inline">· {contact.title}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            {hasEmail && (
                              <Mail className="w-3 h-3 text-emerald-500" />
                            )}
                            {hasPhone && (
                              <Phone className="w-3 h-3 text-blue-500" />
                            )}
                            {!hasEmail && !hasPhone && (
                              <span className="text-[10px] text-muted-foreground/40">—</span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* No contacts fallback */}
                {!isCollapsed && contacts.length === 0 && (
                  <p className="ml-8 text-[11px] text-muted-foreground/50 py-1">Nessun contatto</p>
                )}
              </div>
            );
          })}
          {filteredJobs.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nessun job trovato</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
