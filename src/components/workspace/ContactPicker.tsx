import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useUpdateActivity } from "@/hooks/useActivities";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { User, AlertTriangle, CheckCircle2, Mail, ArrowRightLeft } from "lucide-react";
import { cn } from "@/lib/utils";

interface ContactPickerProps {
  activityId: string;
  partnerId: string | null;
  selectedContactId: string | null;
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

  const otherContacts = useMemo(
    () => contacts.filter((c) => c.id !== selectedContactId),
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

  // Compact mode with selected contact
  if (compact && selectedContact) {
    return (
      <div className="flex items-center gap-1 text-[11px]">
        <CheckCircle2 className="w-3 h-3 text-emerald-500" />
        <span className="text-muted-foreground truncate max-w-[120px]">
          {selectedContact.contact_alias || selectedContact.name}
        </span>
        {otherContacts.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <button className="text-[10px] text-primary hover:underline font-medium">
                +{otherContacts.length}
              </button>
            </PopoverTrigger>
            <PopoverContent className="w-64 p-2" align="start">
              <ContactList
                contacts={contacts}
                selectedId={selectedContactId}
                onSelect={handleSelect}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // Selected contact — show prominently with swap option
  if (selectedContact) {
    return (
      <div className="flex items-center gap-2 w-full">
        <div className="flex items-center gap-1.5 flex-1 min-w-0">
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
          <span className="text-xs font-medium truncate">
            {selectedContact.contact_alias || selectedContact.name}
          </span>
          {selectedContact.email && (
            <span className="text-[10px] text-muted-foreground truncate flex items-center gap-0.5">
              <Mail className="w-2.5 h-2.5" />
              {selectedContact.email}
            </span>
          )}
        </div>
        {otherContacts.length > 0 && (
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" size="sm" className="h-6 text-[10px] gap-1 px-2 border-primary/20 hover:bg-primary/10">
                <ArrowRightLeft className="w-3 h-3" />
                +{otherContacts.length}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-72 p-2" align="end">
              <p className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider mb-1.5 px-1">
                Cambia contatto
              </p>
              <ContactList
                contacts={contacts}
                selectedId={selectedContactId}
                onSelect={handleSelect}
              />
            </PopoverContent>
          </Popover>
        )}
      </div>
    );
  }

  // No contact selected — show all for selection
  if (!selectedContactId && contacts.length > 0) {
    return (
      <div className="w-full space-y-1">
        <div className="flex items-center gap-1.5">
          <User className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">Seleziona contatto:</span>
          <Badge variant="outline" className="text-[10px] text-warning border-warning/30 shrink-0">
            Richiesto
          </Badge>
        </div>
        <div className="border border-border/60 rounded-lg p-1 space-y-0.5 max-h-[160px] overflow-y-auto">
          {contacts.map((c) => (
            <ContactRow key={c.id} contact={c} isSelected={false} onSelect={() => handleSelect(c.id)} />
          ))}
        </div>
      </div>
    );
  }

  return null;
}

/* ═══ Sub-components ═══ */

function ContactList({
  contacts,
  selectedId,
  onSelect,
}: {
  contacts: PartnerContact[];
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  return (
    <div className="space-y-0.5 max-h-[200px] overflow-y-auto">
      {contacts.map((c) => (
        <ContactRow
          key={c.id}
          contact={c}
          isSelected={c.id === selectedId}
          onSelect={() => onSelect(c.id)}
        />
      ))}
    </div>
  );
}

function ContactRow({
  contact: c,
  isSelected,
  onSelect,
}: {
  contact: PartnerContact;
  isSelected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      onClick={onSelect}
      className={cn(
        "w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors",
        isSelected
          ? "bg-primary/10 border border-primary/20"
          : "hover:bg-muted/50 border border-transparent"
      )}
    >
      <div className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 bg-muted">
        {isSelected ? (
          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
        ) : (
          <User className="w-3 h-3 text-muted-foreground" />
        )}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1">
          <span className="text-xs font-medium truncate">
            {c.contact_alias || c.name}
          </span>
          {c.title && <span className="text-[10px] text-muted-foreground">· {c.title}</span>}
        </div>
        {c.email ? (
          <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
            <Mail className="w-2.5 h-2.5" /> {c.email}
          </span>
        ) : (
          <span className="text-[10px] text-destructive">no email</span>
        )}
      </div>
      {!isSelected && (
        <span className="text-[10px] text-primary font-medium shrink-0">Usa</span>
      )}
    </button>
  );
}
