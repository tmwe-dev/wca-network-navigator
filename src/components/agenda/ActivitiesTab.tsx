import { useState, useMemo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter
} from "@/components/ui/dialog";
import {
  Mail, Phone, Users, RotateCcw, MoreHorizontal,
  ChevronDown, ChevronRight, Check, Circle, Clock, User, Trash2, Wand2, Loader2
} from "lucide-react";
import { useAllActivities, useUpdateActivity, useContactsForPartners, useDeleteActivities, type AllActivity } from "@/hooks/useActivities";
import { useTeamMembers } from "@/hooks/useTeamMembers";
import { getCountryFlag } from "@/lib/countries";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { useQueryClient } from "@tanstack/react-query";

const ACTIVITY_TYPE_ICONS: Record<string, typeof Mail> = {
  send_email: Mail,
  phone_call: Phone,
  add_to_campaign: Users,
  meeting: Users,
  follow_up: RotateCcw,
  other: MoreHorizontal,
};

const ACTIVITY_TYPE_LABELS: Record<string, string> = {
  send_email: "Email",
  phone_call: "Telefono",
  add_to_campaign: "Campagna",
  meeting: "Meeting",
  follow_up: "Follow-up",
  other: "Altro",
};

const STATUS_LABELS: Record<string, string> = {
  pending: "Da fare",
  in_progress: "In corso",
  completed: "Completata",
  cancelled: "Annullata",
};

export default function ActivitiesTab({ initialBatchFilter }: { initialBatchFilter?: string }) {
  const { data: activities, isLoading } = useAllActivities();
  const { data: teamMembers } = useTeamMembers();
  const updateActivity = useUpdateActivity();
  const deleteActivities = useDeleteActivities();
  const queryClient = useQueryClient();

  const [filterType, setFilterType] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>(initialBatchFilter ? "all" : "pending");
  const [filterAssignee, setFilterAssignee] = useState<string>("all");
  const [filterCampaign, setFilterCampaign] = useState<"all" | "campaign" | "manual">(initialBatchFilter ? "campaign" : "all");
  const [filterBatch, setFilterBatch] = useState<string | undefined>(initialBatchFilter);
  const [filterContact, setFilterContact] = useState<string>("all");
  const [expandedCountries, setExpandedCountries] = useState<Set<string>>(new Set());
  const [generatingAliases, setGeneratingAliases] = useState(false);
  const [bulkDeleteOpen, setBulkDeleteOpen] = useState(false);

  // Get unique partner IDs for contacts query
  const partnerIds = useMemo(() => {
    if (!activities) return [];
    return [...new Set(activities.map((a) => a.partner_id))];
  }, [activities]);

  const { data: contactsMap } = useContactsForPartners(partnerIds);

  // Filter activities
  const filtered = useMemo(() => {
    if (!activities) return [];
    return activities.filter((a) => {
      if (filterType !== "all" && a.activity_type !== filterType) return false;
      if (filterStatus !== "all" && a.status !== filterStatus) return false;
      if (filterAssignee !== "all" && a.assigned_to !== filterAssignee) return false;
      if (filterCampaign === "campaign" && !a.campaign_batch_id) return false;
      if (filterCampaign === "manual" && a.campaign_batch_id) return false;
      if (filterBatch && a.campaign_batch_id !== filterBatch) return false;

      // Contact filters
      if (filterContact === "no_email") {
        const contacts = contactsMap?.[a.partner_id] || [];
        const hasEmail = contacts.some((c) => c.email);
        if (hasEmail) return false;
      }
      if (filterContact === "no_contact") {
        const contacts = contactsMap?.[a.partner_id] || [];
        if (contacts.length > 0) return false;
      }
      if (filterContact === "no_alias") {
        const hasCompanyAlias = !!a.partners?.company_alias;
        const hasContactAlias = !!a.selected_contact?.contact_alias;
        if (hasCompanyAlias && (hasContactAlias || !a.selected_contact)) return false;
      }

      return true;
    });
  }, [activities, filterType, filterStatus, filterAssignee, filterCampaign, filterBatch, filterContact, contactsMap]);

  // Group by country
  const grouped = useMemo(() => {
    const map: Record<string, { countryName: string; countryCode: string; activities: AllActivity[] }> = {};
    filtered.forEach((a) => {
      const code = a.partners?.country_code || "??";
      if (!map[code]) {
        map[code] = { countryName: a.partners?.country_name || "Sconosciuto", countryCode: code, activities: [] };
      }
      map[code].activities.push(a);
    });
    return Object.values(map).sort((a, b) => b.activities.length - a.activities.length);
  }, [filtered]);

  const toggleCountry = (code: string) => {
    setExpandedCountries((prev) => {
      const next = new Set(prev);
      if (next.has(code)) next.delete(code); else next.add(code);
      return next;
    });
  };

  const cycleStatus = (activity: AllActivity) => {
    const order = ["pending", "in_progress", "completed"] as const;
    const idx = order.indexOf(activity.status as any);
    const next = order[(idx + 1) % order.length];
    updateActivity.mutate({
      id: activity.id,
      status: next,
      completed_at: next === "completed" ? new Date().toISOString() : null,
    });
  };

  const selectContact = (activityId: string, contactId: string) => {
    updateActivity.mutate({ id: activityId, selected_contact_id: contactId });
  };

  const handleDeleteSingle = (id: string) => {
    deleteActivities.mutate([id]);
  };

  const handleBulkDelete = () => {
    const ids = filtered.map((a) => a.id);
    deleteActivities.mutate(ids, {
      onSuccess: () => {
        setBulkDeleteOpen(false);
        toast({ title: `${ids.length} attività cancellate` });
      },
    });
  };

  const handleGenerateAliases = async () => {
    const countryCodes = [...new Set(grouped.map((g) => g.countryCode))];
    if (!countryCodes.length) return;
    setGeneratingAliases(true);
    try {
      const { data, error } = await supabase.functions.invoke("generate-aliases", {
        body: { country_codes: countryCodes },
      });
      if (error) throw error;
      queryClient.invalidateQueries({ queryKey: ["all-activities"] });
      queryClient.invalidateQueries({ queryKey: ["partner-contacts-map"] });
      toast({ title: "Alias generati", description: data?.message || "Completato" });
    } catch (err: any) {
      toast({ title: "Errore", description: err.message, variant: "destructive" });
    } finally {
      setGeneratingAliases(false);
    }
  };

  const showBulkDelete = filterContact === "no_email" || filterContact === "no_contact";

  if (isLoading) {
    return <div className="space-y-4">{Array.from({ length: 4 }).map((_, i) => <Skeleton key={i} className="h-20 w-full" />)}</div>;
  }

  return (
    <div className="space-y-4">
      {/* Top bar: Genera Alias */}
      <div className="flex items-center gap-3">
        <Button variant="outline" size="sm" onClick={handleGenerateAliases} disabled={generatingAliases}>
          {generatingAliases ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : <Wand2 className="w-4 h-4 mr-1" />}
          Genera Alias
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti i tipi</SelectItem>
            <SelectItem value="send_email">Email</SelectItem>
            <SelectItem value="phone_call">Telefono</SelectItem>
            <SelectItem value="meeting">Meeting</SelectItem>
            <SelectItem value="follow_up">Follow-up</SelectItem>
            <SelectItem value="other">Altro</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Stato" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti gli stati</SelectItem>
            <SelectItem value="pending">Da fare</SelectItem>
            <SelectItem value="in_progress">In corso</SelectItem>
            <SelectItem value="completed">Completate</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterAssignee} onValueChange={setFilterAssignee}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Assegnatario" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            {teamMembers?.map((tm) => (
              <SelectItem key={tm.id} value={tm.id}>{tm.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={filterCampaign} onValueChange={(v) => { setFilterCampaign(v as any); if (v !== "campaign") setFilterBatch(undefined); }}>
          <SelectTrigger className="w-[150px]"><SelectValue placeholder="Origine" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutte</SelectItem>
            <SelectItem value="campaign">Campagna</SelectItem>
            <SelectItem value="manual">Manuali</SelectItem>
          </SelectContent>
        </Select>

        <Select value={filterContact} onValueChange={setFilterContact}>
          <SelectTrigger className="w-[170px]"><SelectValue placeholder="Contatto" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Tutti</SelectItem>
            <SelectItem value="no_email">Senza email</SelectItem>
            <SelectItem value="no_contact">Senza contatto</SelectItem>
            <SelectItem value="no_alias">Senza alias</SelectItem>
          </SelectContent>
        </Select>

        {filterBatch && (
          <Button variant="outline" size="sm" onClick={() => setFilterBatch(undefined)} className="text-xs">
            Batch filtrato ✕
          </Button>
        )}
      </div>

      {/* Results count + bulk delete */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filtered.length} attività in {grouped.length} {grouped.length === 1 ? "paese" : "paesi"}
        </p>
        {showBulkDelete && filtered.length > 0 && (
          <Button variant="destructive" size="sm" onClick={() => setBulkDeleteOpen(true)}>
            <Trash2 className="w-4 h-4 mr-1" />
            Cancella filtrate ({filtered.length})
          </Button>
        )}
      </div>

      {/* Bulk delete confirmation */}
      <Dialog open={bulkDeleteOpen} onOpenChange={setBulkDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancella attività filtrate</DialogTitle>
            <DialogDescription>
              Stai per cancellare {filtered.length} attività. Questa azione è irreversibile.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setBulkDeleteOpen(false)}>Annulla</Button>
            <Button variant="destructive" onClick={handleBulkDelete} disabled={deleteActivities.isPending}>
              {deleteActivities.isPending ? <Loader2 className="w-4 h-4 mr-1 animate-spin" /> : null}
              Conferma cancellazione
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Grouped by country */}
      {grouped.length === 0 ? (
        <Card><CardContent className="py-8 text-center text-muted-foreground">Nessuna attività trovata</CardContent></Card>
      ) : (
        <div className="space-y-2">
          {grouped.map(({ countryCode, countryName, activities: countryActivities }) => {
            const isExpanded = expandedCountries.has(countryCode);
            return (
              <Collapsible key={countryCode} open={isExpanded} onOpenChange={() => toggleCountry(countryCode)}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto">
                    <div className="flex items-center gap-3">
                      {isExpanded ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                      <span className="text-xl">{getCountryFlag(countryCode)}</span>
                      <span className="font-medium">{countryName}</span>
                    </div>
                    <Badge variant="secondary">{countryActivities.length}</Badge>
                  </Button>
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <div className="space-y-2 pl-4 pr-2 pb-3">
                    {countryActivities.map((activity) => (
                      <ActivityRow
                        key={activity.id}
                        activity={activity}
                        contacts={contactsMap?.[activity.partner_id] || []}
                        onCycleStatus={() => cycleStatus(activity)}
                        onSelectContact={(contactId) => selectContact(activity.id, contactId)}
                        onDelete={() => handleDeleteSingle(activity.id)}
                      />
                    ))}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            );
          })}
        </div>
      )}
    </div>
  );
}

function ActivityRow({
  activity,
  contacts,
  onCycleStatus,
  onSelectContact,
  onDelete,
}: {
  activity: AllActivity;
  contacts: { id: string; name: string; email: string | null; direct_phone: string | null; mobile: string | null; title: string | null }[];
  onCycleStatus: () => void;
  onSelectContact: (id: string) => void;
  onDelete: () => void;
}) {
  const Icon = ACTIVITY_TYPE_ICONS[activity.activity_type] || MoreHorizontal;
  const selectedContact = activity.selected_contact;
  const isCompleted = activity.status === "completed";

  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg border bg-card",
      isCompleted && "opacity-50"
    )}>
      {/* Status toggle */}
      <Button variant="ghost" size="icon" className="shrink-0 h-8 w-8" onClick={onCycleStatus}>
        {activity.status === "completed" ? (
          <Check className="w-4 h-4 text-primary" />
        ) : activity.status === "in_progress" ? (
          <Clock className="w-4 h-4 text-warning" />
        ) : (
          <Circle className="w-4 h-4 text-muted-foreground" />
        )}
      </Button>

      {/* Type icon */}
      <Icon className="w-4 h-4 shrink-0 text-muted-foreground" />

      {/* Company & title with alias */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <p className={cn("font-medium text-sm truncate", isCompleted && "line-through")}>
            {activity.partners?.company_name}
          </p>
          {activity.partners?.company_alias && (
            <Badge variant="outline" className="text-[10px] shrink-0 bg-accent/50">
              {activity.partners.company_alias}
            </Badge>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{activity.title}</p>
      </div>

      {/* Selected contact or selector */}
      <div className="shrink-0 max-w-[220px]">
        {selectedContact ? (
          <div className="flex items-center gap-1.5 px-2 py-1 rounded bg-primary/10 border border-primary/20">
            <Check className="w-3 h-3 text-primary shrink-0" />
            <div className="text-xs truncate">
              <span className="font-medium">{selectedContact.name}</span>
              {selectedContact.contact_alias && (
                <span className="text-primary ml-1">({selectedContact.contact_alias})</span>
              )}
              {selectedContact.email && (
                <span className="text-muted-foreground ml-1">{selectedContact.email}</span>
              )}
            </div>
          </div>
        ) : contacts.length > 0 ? (
          <Select onValueChange={onSelectContact}>
            <SelectTrigger className="h-7 text-xs w-[160px]">
              <SelectValue placeholder="Seleziona contatto..." />
            </SelectTrigger>
            <SelectContent>
              {contacts.map((c) => (
                <SelectItem key={c.id} value={c.id} className="text-xs">
                  <span className="font-medium">{c.name}</span>
                  {c.email && <span className="text-muted-foreground ml-1">({c.email})</span>}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <span className="text-xs text-muted-foreground">Nessun contatto</span>
        )}
      </div>

      {/* Due date */}
      {activity.due_date && (
        <span className="text-xs text-muted-foreground shrink-0">
          {format(new Date(activity.due_date), "dd/MM")}
        </span>
      )}

      {/* Assignee */}
      {activity.team_members && (
        <div className="flex items-center gap-1 shrink-0">
          <User className="w-3 h-3 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{activity.team_members.name}</span>
        </div>
      )}

      {/* Type label */}
      <Badge variant="outline" className="text-[10px] shrink-0">
        {ACTIVITY_TYPE_LABELS[activity.activity_type] || activity.activity_type}
      </Badge>

      {/* Delete */}
      <Button variant="ghost" size="icon" className="shrink-0 h-7 w-7 text-muted-foreground hover:text-destructive" onClick={onDelete}>
        <Trash2 className="w-3.5 h-3.5" />
      </Button>
    </div>
  );
}
