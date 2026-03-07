import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateActivity } from "@/hooks/useActivities";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { User, AlertTriangle, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactPickerProps {
  activityId: string;
  partnerId: string | null;
  selectedContactId: string | null;
  /** Compact inline mode (for list items) */
  compact?: boolean;
  onContactSelected?: (contactId: string) => void;
}

interface PartnerContact {
  id: string;
  name: string;
  email: string | null;
  title: string | null;
  contact_alias: string | null;
  is_primary: boolean | null;
}

export default function ContactPicker({
  activityId, partnerId, selectedContactId, compact = false, onContactSelected,
}: ContactPickerProps) {
  const updateActivity = useUpdateActivity();

  const { data: contacts = [], isLoading } = useQuery({
    queryKey: ["partner-contacts-picker", partnerId],
    queryFn: async () => {
      if (!partnerId) return [];
      const { data, error } = await supabase
        .from("partner_contacts")
        .select("id, name, email, title, contact_alias, is_primary")
        .eq("partner_id", partnerId)
        .order("is_primary", { ascending: false });
      if (error) throw error;
      return (data || []) as PartnerContact[];
    },
    enabled: !!partnerId,
    staleTime: 30_000,
  });

  // Auto-select if only 1 contact and none selected
  useEffect(() => {
    if (contacts.length === 1 && !selectedContactId) {
      const c = contacts[0];
      updateActivity.mutate({ id: activityId, selected_contact_id: c.id });
      onContactSelected?.(c.id);
    }
  }, [contacts, selectedContactId, activityId]);

  const handleSelect = (contactId: string) => {
    updateActivity.mutate({ id: activityId, selected_contact_id: contactId });
    onContactSelected?.(contactId);
  };

  const selectedContact = useMemo(
    () => contacts.find((c) => c.id === selectedContactId),
    [contacts, selectedContactId]
  );

  if (!partnerId) return null;

  // No contacts available
  if (!isLoading && contacts.length === 0) {
    return (
      <Badge variant="outline" className="text-[10px] text-warning border-warning/30 gap-1">
        <AlertTriangle className="w-3 h-3" /> Nessun contatto
      </Badge>
    );
  }

  // Already selected and compact mode — just show the name
  if (compact && selectedContact) {
    return (
      <div className="flex items-center gap-1 text-[11px]">
        <CheckCircle2 className="w-3 h-3 text-success" />
        <span className="text-muted-foreground truncate max-w-[120px]">
          {selectedContact.contact_alias || selectedContact.name}
        </span>
      </div>
    );
  }

  // 1 contact, auto-selected
  if (contacts.length === 1 && selectedContactId) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <User className="w-3 h-3" />
        <span>{contacts[0].contact_alias || contacts[0].name}</span>
        {contacts[0].email && <span className="text-[10px] opacity-60">&lt;{contacts[0].email}&gt;</span>}
      </div>
    );
  }

  // Multiple contacts — show picker
  return (
    <div className={cn("flex items-center gap-2", !compact && "w-full")}>
      <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
      <Select value={selectedContactId || "none"} onValueChange={(v) => v !== "none" && handleSelect(v)}>
        <SelectTrigger className={cn("h-7 text-xs", compact ? "w-[160px]" : "flex-1")}>
          <SelectValue placeholder="Seleziona contatto..." />
        </SelectTrigger>
        <SelectContent>
          {contacts.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              <div className="flex items-center gap-2">
                <span className="font-medium">{c.contact_alias || c.name}</span>
                {c.title && <span className="text-muted-foreground text-[10px]">· {c.title}</span>}
                {c.email ? (
                  <span className="text-[10px] text-muted-foreground">&lt;{c.email}&gt;</span>
                ) : (
                  <span className="text-[10px] text-destructive">no email</span>
                )}
              </div>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {!selectedContactId && (
        <Badge variant="outline" className="text-[10px] text-warning border-warning/30 shrink-0">
          Richiesto
        </Badge>
      )}
    </div>
  );
}
