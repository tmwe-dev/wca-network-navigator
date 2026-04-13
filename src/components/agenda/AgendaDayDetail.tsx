import { useMemo } from "react";
import { Link } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Mail, MessageCircle, Linkedin, Phone, StickyNote,
  MoreVertical, CheckCircle2, Clock, Calendar as CalendarIcon, ArrowUpRight,
} from "lucide-react";
import { useAgendaDayActivities } from "@/hooks/useAgendaDayActivities";
import { useSelection } from "@/hooks/useSelection";
import { getCountryFlag } from "@/lib/countries";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { it } from "date-fns/locale";
import AgendaBulkBar from "./AgendaBulkBar";
import type { ActivityTypeFilter, ResponseFilter } from "./AgendaCalendarPage";
import type { AllActivity } from "@/hooks/useActivities";

interface AgendaDayDetailProps {
  selectedDay: Date;
  filters: {
    activityType: ActivityTypeFilter;
    responseStatus: ResponseFilter;
  };
}

const typeIcons: Record<string, typeof Mail> = {
  send_email: Mail,
  follow_up: Mail,
  whatsapp: MessageCircle,
  linkedin: Linkedin,
  phone_call: Phone,
  note: StickyNote,
};

const typeLabels: Record<string, string> = {
  send_email: "Email",
  follow_up: "Follow-up",
  phone_call: "Chiamata",
  meeting: "Meeting",
  add_to_campaign: "Campagna",
  other: "Altro",
};

export default function AgendaDayDetail({ selectedDay, filters }: AgendaDayDetailProps) {
  const { data, isLoading } = useAgendaDayActivities(selectedDay);
  const activities = data?.activities || [];
  const reminders = data?.reminders || [];
  const respondedIds = data?.respondedPartnerIds || new Set<string>();

  // Apply filters
  const filteredActivities = useMemo(() => {
    let list = activities;
    if (filters.activityType !== "all") {
      list = list.filter(a => a.activity_type === filters.activityType);
    }
    if (filters.responseStatus === "responded") {
      list = list.filter(a => a.partner_id && respondedIds.has(a.partner_id));
    } else if (filters.responseStatus === "no_response") {
      list = list.filter(a => a.partner_id && !respondedIds.has(a.partner_id));
    }
    return list;
  }, [activities, filters, respondedIds]);

  const { selectedIds, toggle, isAllSelected, toggleAll, clear, count } = useSelection(filteredActivities);

  const selectedActivities = filteredActivities.filter(a => selectedIds.has(a.id));

  // Tab counts
  const emailCount = activities.filter(a => ["send_email", "follow_up"].includes(a.activity_type)).length;
  const waCount = activities.filter(a => a.activity_type === "whatsapp").length;
  const liCount = activities.filter(a => a.activity_type === "linkedin").length;

  if (isLoading) {
    return (
      <div className="p-4 space-y-3">
        <Skeleton className="h-8 w-48" />
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-14 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Day header */}
      <div className="shrink-0 px-4 py-3 border-b border-border/30">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-bold capitalize">
              {format(selectedDay, "EEEE d MMMM yyyy", { locale: it })}
            </h2>
            <p className="text-[10px] text-muted-foreground">
              {activities.length} attività • {reminders.length} reminder
            </p>
          </div>
          <div className="flex items-center gap-2">
            {respondedIds.size > 0 && (
              <Badge variant="outline" className="text-[9px] border-emerald-500/30 text-emerald-500 bg-emerald-500/10">
                <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                {respondedIds.size} risposte
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Bulk bar */}
      <div className="shrink-0 px-4 pt-2">
        <AgendaBulkBar
          selectedCount={count}
          selectedActivities={selectedActivities}
          onClear={clear}
        />
      </div>

      {/* Sub-tabs */}
      <Tabs defaultValue="all" className="flex-1 flex flex-col min-h-0">
        <div className="shrink-0 px-4">
          <TabsList className="h-8">
            <TabsTrigger value="all" className="text-[10px] gap-1">
              Tutti ({filteredActivities.length})
            </TabsTrigger>
            <TabsTrigger value="email" className="text-[10px] gap-1">
              <Mail className="w-3 h-3" /> {emailCount}
            </TabsTrigger>
            <TabsTrigger value="whatsapp" className="text-[10px] gap-1">
              <MessageCircle className="w-3 h-3" /> {waCount}
            </TabsTrigger>
            <TabsTrigger value="linkedin" className="text-[10px] gap-1">
              <Linkedin className="w-3 h-3" /> {liCount}
            </TabsTrigger>
            <TabsTrigger value="reminders" className="text-[10px] gap-1">
              <CalendarIcon className="w-3 h-3" /> {reminders.length}
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="all" className="flex-1 m-0 overflow-hidden">
          <ActivityList
            activities={filteredActivities}
            respondedIds={respondedIds}
            selectedIds={selectedIds}
            onToggle={toggle}
            isAllSelected={isAllSelected}
            onToggleAll={toggleAll}
          />
        </TabsContent>

        <TabsContent value="email" className="flex-1 m-0 overflow-hidden">
          <ActivityList
            activities={filteredActivities.filter(a => ["send_email", "follow_up"].includes(a.activity_type))}
            respondedIds={respondedIds}
            selectedIds={selectedIds}
            onToggle={toggle}
            isAllSelected={false}
            onToggleAll={() => {}}
          />
        </TabsContent>

        <TabsContent value="whatsapp" className="flex-1 m-0 overflow-hidden">
          <ActivityList
            activities={filteredActivities.filter(a => a.activity_type === "whatsapp")}
            respondedIds={respondedIds}
            selectedIds={selectedIds}
            onToggle={toggle}
            isAllSelected={false}
            onToggleAll={() => {}}
          />
        </TabsContent>

        <TabsContent value="linkedin" className="flex-1 m-0 overflow-hidden">
          <ActivityList
            activities={filteredActivities.filter(a => a.activity_type === "linkedin")}
            respondedIds={respondedIds}
            selectedIds={selectedIds}
            onToggle={toggle}
            isAllSelected={false}
            onToggleAll={() => {}}
          />
        </TabsContent>

        <TabsContent value="reminders" className="flex-1 m-0 overflow-hidden">
          <ReminderList reminders={reminders} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function ActivityList({
  activities,
  respondedIds,
  selectedIds,
  onToggle,
  isAllSelected,
  onToggleAll,
}: {
  activities: AllActivity[];
  respondedIds: Set<string>;
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  isAllSelected: boolean;
  onToggleAll: (checked: boolean) => void;
}) {
  if (activities.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
        <Mail className="w-6 h-6 mb-2 opacity-30" />
        <p className="text-xs">Nessuna attività</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      {/* Select all header */}
      <div className="flex items-center gap-2 px-4 py-1.5 border-b border-border/20">
        <Checkbox
          checked={isAllSelected}
          onCheckedChange={(c) => onToggleAll(!!c)}
          className="w-3.5 h-3.5"
        />
        <span className="text-[10px] text-muted-foreground">{activities.length} elementi</span>
      </div>

      <div className="p-3 space-y-1">
        {activities.map((a) => {
          const hasResponded = a.partner_id ? respondedIds.has(a.partner_id) : false;
          const Icon = typeIcons[a.activity_type] || Mail;

          return (
            <div
              key={a.id}
              className={cn(
                "flex items-center gap-2.5 px-3 py-2 rounded-xl border transition-all",
                "bg-card/40 border-border/30 hover:bg-card/60",
                selectedIds.has(a.id) && "bg-primary/5 border-primary/20",
                hasResponded && "border-l-2 border-l-emerald-500"
              )}
            >
              <Checkbox
                checked={selectedIds.has(a.id)}
                onCheckedChange={() => onToggle(a.id)}
                className="shrink-0 w-3.5 h-3.5"
              />

              {a.partners && (
                <span className="text-sm shrink-0">{getCountryFlag(a.partners.country_code)}</span>
              )}

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Icon className="w-3 h-3 text-muted-foreground shrink-0" />
                  <span className="text-xs font-medium truncate">{a.title}</span>
                  {hasResponded && (
                    <Badge variant="outline" className="text-[8px] px-1 py-0 h-3.5 border-emerald-500/30 text-emerald-500 bg-emerald-500/10 shrink-0">
                      Risposto
                    </Badge>
                  )}
                </div>
                <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                  {a.partners && <span className="truncate">{a.partners.company_name}</span>}
                  {a.selected_contact && (
                    <>
                      <span className="opacity-30">•</span>
                      <span className="truncate">{a.selected_contact.name}</span>
                    </>
                  )}
                  <span className="opacity-30">•</span>
                  <span className="shrink-0">{format(new Date(a.created_at), "HH:mm")}</span>
                </div>
              </div>

              <Badge
                variant="outline"
                className={cn(
                  "text-[8px] px-1.5 py-0 h-4 shrink-0",
                  a.status === "completed" ? "border-emerald-500/20 text-emerald-500 bg-emerald-500/10" :
                  a.status === "pending" ? "border-amber-500/20 text-amber-500 bg-amber-500/10" :
                  "border-blue-500/20 text-blue-500 bg-blue-500/10"
                )}
              >
                {typeLabels[a.activity_type] || a.activity_type}
              </Badge>

              {/* 3-dot menu */}
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button variant="ghost" size="icon" className="h-6 w-6 shrink-0" aria-label="Altre azioni">
                    <MoreVertical className="w-3 h-3" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  {a.partner_id && (
                    <DropdownMenuItem asChild>
                      <Link to={`/partners/${a.partner_id}`} className="text-xs gap-2">
                        <ArrowUpRight className="w-3 h-3" /> Vai al partner
                      </Link>
                    </DropdownMenuItem>
                  )}
                  <DropdownMenuItem className="text-xs gap-2">
                    <Phone className="w-3 h-3" /> Chiama
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2">
                    <StickyNote className="w-3 h-3" /> Aggiungi nota
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2">
                    <Mail className="w-3 h-3" /> Nuova email
                  </DropdownMenuItem>
                  <DropdownMenuItem className="text-xs gap-2">
                    <MessageCircle className="w-3 h-3" /> WhatsApp
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
    </ScrollArea>
  );
}

function ReminderList({ reminders }: { reminders: any[] }) {
  if (reminders.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground/50">
        <CalendarIcon className="w-6 h-6 mb-2 opacity-30" />
        <p className="text-xs">Nessun reminder</p>
      </div>
    );
  }

  return (
    <ScrollArea className="h-full">
      <div className="p-3 space-y-1">
        {reminders.map((r) => (
          <Link
            key={r.id}
            to={`/partners/${r.partner_id}`}
            className="flex items-center gap-2.5 px-3 py-2 rounded-xl border bg-card/40 border-border/30 hover:bg-card/60 transition-all"
          >
            <CalendarIcon className="w-3.5 h-3.5 text-primary shrink-0" />
            {r.partners && (
              <span className="text-sm shrink-0">{getCountryFlag(r.partners.country_code)}</span>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-xs font-medium truncate">{r.title}</p>
              <p className="text-[10px] text-muted-foreground truncate">{r.partners?.company_name}</p>
            </div>
            <Badge
              variant="outline"
              className={cn(
                "text-[8px] shrink-0",
                r.status === "completed" ? "border-emerald-500/20 text-emerald-500" : "border-amber-500/20 text-amber-500"
              )}
            >
              {r.status === "completed" ? "Completato" : "In attesa"}
            </Badge>
          </Link>
        ))}
      </div>
    </ScrollArea>
  );
}
