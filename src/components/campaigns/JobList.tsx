import { useState, useMemo } from "react";
import { Mail, Phone, Search, CheckCircle2, Clock, Circle, Users } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { getCountryFlag } from "@/lib/countries";
import type { CampaignJob, PartnerContact } from "@/hooks/useCampaignJobs";
import { cn } from "@/lib/utils";

interface JobListProps {
  jobs: CampaignJob[];
  selectedJobId: string | null;
  onSelectJob: (id: string) => void;
  contactsByPartner?: Record<string, PartnerContact[]>;
}

const STATUS_ICONS: Record<string, React.ReactNode> = {
  pending: <Circle className="w-3.5 h-3.5 text-slate-400" />,
  in_progress: <Clock className="w-3.5 h-3.5 text-amber-400" />,
  completed: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />,
  skipped: <Circle className="w-3.5 h-3.5 text-slate-600" />,
};

export function JobList({ jobs, selectedJobId, onSelectJob, contactsByPartner = {} }: JobListProps) {
  const [search, setSearch] = useState("");
  const [filterType, setFilterType] = useState<"all" | "email" | "call">("all");
  const [filterStatus, setFilterStatus] = useState<"all" | "pending" | "completed">("all");

  const filtered = useMemo(() => {
    return jobs.filter(j => {
      if (filterType !== "all" && j.job_type !== filterType) return false;
      if (filterStatus === "pending" && (j.status === "completed" || j.status === "skipped")) return false;
      if (filterStatus === "completed" && j.status !== "completed") return false;
      if (search) {
        const s = search.toLowerCase();
        return j.company_name.toLowerCase().includes(s) || j.country_name.toLowerCase().includes(s) || (j.city || "").toLowerCase().includes(s);
      }
      return true;
    });
  }, [jobs, search, filterType, filterStatus]);

  const emailCount = jobs.filter(j => j.email).length;
  const phoneCount = jobs.filter(j => j.phone).length;
  const completedCount = jobs.filter(j => j.status === "completed").length;

  return (
    <div className="h-full flex flex-col border-r border-border">
      {/* Stats */}
      <div className="px-4 pt-4 pb-2 space-y-3 flex-shrink-0">
        <div className="flex items-center gap-2 text-xs flex-wrap">
          <Badge variant="secondary" className="gap-1">
            {jobs.length} totali
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Mail className="w-3 h-3" /> {emailCount}
          </Badge>
          <Badge variant="outline" className="gap-1">
            <Phone className="w-3 h-3" /> {phoneCount}
          </Badge>
          <Badge variant="outline" className="gap-1 text-emerald-600">
            <CheckCircle2 className="w-3 h-3" /> {completedCount}
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

        {/* Filters */}
        <div className="flex gap-1.5 text-xs">
          {(["all", "email", "call"] as const).map(t => (
            <button
              key={t}
              onClick={() => setFilterType(t)}
              className={cn(
                "px-2 py-1 rounded-md transition-colors",
                filterType === t ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {t === "all" ? "Tutti" : t === "email" ? "Email" : "Call"}
            </button>
          ))}
          <div className="w-px bg-border mx-1" />
          {(["all", "pending", "completed"] as const).map(s => (
            <button
              key={s}
              onClick={() => setFilterStatus(s)}
              className={cn(
                "px-2 py-1 rounded-md transition-colors",
                filterStatus === s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground hover:bg-accent"
              )}
            >
              {s === "all" ? "Tutti" : s === "pending" ? "Aperti" : "Fatti"}
            </button>
          ))}
        </div>
      </div>

      {/* List */}
      <ScrollArea className="flex-1">
        <div className="px-2 pb-2 space-y-0.5">
          {filtered.map(job => {
            const pContacts = contactsByPartner[job.partner_id] || [];
            const contactsWithEmail = pContacts.filter(c => c.email).length;
            const contactsWithPhone = pContacts.filter(c => c.direct_phone || c.mobile).length;

            return (
              <button
                key={job.id}
                onClick={() => onSelectJob(job.id)}
                className={cn(
                  "w-full flex items-center gap-2 px-3 py-2.5 rounded-lg text-left transition-colors text-sm",
                  selectedJobId === job.id
                    ? "bg-primary/10 border border-primary/30"
                    : "hover:bg-accent border border-transparent"
                )}
              >
                {STATUS_ICONS[job.status]}
                <span className="text-base leading-none">{getCountryFlag(job.country_code)}</span>
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate text-foreground">{job.company_name}</p>
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <span className="truncate">{job.city}, {job.country_name}</span>
                    {pContacts.length > 0 && (
                      <span className="flex items-center gap-0.5 shrink-0">
                        <Users className="w-3 h-3" /> {pContacts.length}
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 flex-shrink-0">
                  {contactsWithEmail > 0 ? (
                    <span className="flex items-center gap-0.5 text-emerald-500 text-[10px] font-medium">
                      <Mail className="w-3 h-3" />{contactsWithEmail}
                    </span>
                  ) : job.email ? (
                    <Mail className="w-3 h-3 text-emerald-500/50" />
                  ) : null}
                  {contactsWithPhone > 0 ? (
                    <span className="flex items-center gap-0.5 text-blue-500 text-[10px] font-medium">
                      <Phone className="w-3 h-3" />{contactsWithPhone}
                    </span>
                  ) : job.phone ? (
                    <Phone className="w-3 h-3 text-blue-500/50" />
                  ) : null}
                </div>
              </button>
            );
          })}
          {filtered.length === 0 && (
            <p className="text-center text-sm text-muted-foreground py-8">Nessun job trovato</p>
          )}
        </div>
      </ScrollArea>
    </div>
  );
}
