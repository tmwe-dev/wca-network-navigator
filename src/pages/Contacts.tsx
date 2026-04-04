import { useState, useCallback, useMemo } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { Users, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useContactGroupCounts } from "@/hooks/useContactGroups";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Badge } from "@/components/ui/badge";

/** Column 1 — Group/Origin sidebar, like Network's country list */
function GroupsSidebar({ groups, loading, selectedGroup, onSelect, groupBy }: {
  groups: any[];
  loading: boolean;
  selectedGroup: string | null;
  onSelect: (key: string | null) => void;
  groupBy: string;
}) {
  const total = useMemo(() => groups.reduce((s, g) => s + g.contact_count, 0), [groups]);

  return (
    <div className="flex flex-col h-full border-r border-border/40 bg-muted/10">
      <div className="px-3 py-2 border-b border-border/30 shrink-0">
        <p className="text-[10px] font-bold uppercase text-muted-foreground tracking-wider">
          {groupBy === "country" ? "Paesi" : groupBy === "origin" ? "Origini" : groupBy === "lead_status" ? "Stati" : "Gruppi"}
        </p>
        <p className="text-xs text-muted-foreground">{total} contatti</p>
      </div>

      {/* "All" option */}
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "flex items-center justify-between px-3 py-2 text-xs transition-colors border-b border-border/20",
          selectedGroup === null
            ? "bg-primary/10 text-primary font-semibold"
            : "text-muted-foreground hover:bg-muted/30"
        )}
      >
        <span>Tutti</span>
        <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{total}</Badge>
      </button>

      <ScrollArea className="flex-1">
        {loading ? (
          <div className="flex items-center justify-center py-8">
            <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
          </div>
        ) : (
          groups.map((g) => (
            <button
              key={g.group_key}
              onClick={() => onSelect(g.group_key)}
              className={cn(
                "flex items-center justify-between w-full px-3 py-2 text-xs transition-colors border-b border-border/10",
                selectedGroup === g.group_key
                  ? "bg-primary/10 text-primary font-semibold"
                  : "text-foreground/80 hover:bg-muted/30"
              )}
            >
              <span className="truncate">{g.group_label}</span>
              <div className="flex items-center gap-1.5 shrink-0 ml-1">
                {g.with_email > 0 && (
                  <span className="text-[9px] text-emerald-500">✉ {g.with_email}</span>
                )}
                <Badge variant="secondary" className="text-[9px] h-4 px-1.5">{g.contact_count}</Badge>
              </div>
            </button>
          ))
        )}
      </ScrollArea>
    </div>
  );
}

export default function Contacts() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string | null>(null);
  const { filters: gf } = useGlobalFilters();

  const currentGroupBy = gf.groupBy || "country";
  const { data: allGroupCounts, isLoading: groupsLoading } = useContactGroupCounts();

  const groups = useMemo(() => {
    if (!allGroupCounts) return [];
    return allGroupCounts
      .filter((g) => g.group_type === currentGroupBy)
      .sort((a, b) => b.contact_count - a.contact_count);
  }, [allGroupCounts, currentGroupBy]);

  const handleContactUpdated = useCallback((updated: any) => {
    setSelectedContact(updated);
  }, []);

  const hasDetail = !!selectedContact;

  return (
    <div className="h-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Column 1 — Groups sidebar */}
        <ResizablePanel defaultSize={18} minSize={12} maxSize={25}>
          <GroupsSidebar
            groups={groups}
            loading={groupsLoading}
            selectedGroup={selectedGroup}
            onSelect={setSelectedGroup}
            groupBy={currentGroupBy}
          />
        </ResizablePanel>

        <ResizableHandle />

        {/* Column 2 — Contact list */}
        <ResizablePanel defaultSize={hasDetail ? 32 : 82} minSize={22} maxSize={60}>
          <div className="flex flex-col h-full border-r border-border">
            <ContactListPanel
              selectedId={selectedContact?.id ?? null}
              onSelect={(contact: any) => setSelectedContact(contact)}
              filterGroupKey={selectedGroup}
              filterGroupType={currentGroupBy}
            />
          </div>
        </ResizablePanel>

        {hasDetail && (
          <>
            <ResizableHandle withHandle />
            {/* Column 3 — Detail */}
            <ResizablePanel defaultSize={50}>
              <div className="h-full bg-card">
                <ContactDetailPanel
                  key={selectedContact.id}
                  contact={selectedContact}
                  onContactUpdated={handleContactUpdated}
                />
              </div>
            </ResizablePanel>
          </>
        )}

        {!hasDetail && (
          <>
            <ResizableHandle withHandle />
            <ResizablePanel defaultSize={50}>
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 bg-card/30">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Seleziona un contatto</p>
                <p className="text-xs mt-1 opacity-60">per visualizzare i dettagli</p>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
