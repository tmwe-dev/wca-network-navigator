import { useState, useCallback } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { Users } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Contacts() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const handleContactUpdated = useCallback((updated: any) => {
    setSelectedContact(updated);
  }, []);

  const hasDetail = !!selectedContact;

  return (
    <div className="h-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left panel — list */}
        <ResizablePanel defaultSize={hasDetail ? 38 : 100} minSize={25} maxSize={55}>
          <div className="flex flex-col h-full border-r border-border">
            <ContactListPanel
              selectedId={selectedContact?.id ?? null}
              onSelect={(contact: any) => setSelectedContact(contact)}
            />
          </div>
        </ResizablePanel>

        {hasDetail && (
          <>
            <ResizableHandle withHandle />

            {/* Right panel — detail */}
            <ResizablePanel defaultSize={62}>
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
            <ResizablePanel defaultSize={62}>
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
