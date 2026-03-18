import { useState } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";

export default function Contacts() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  return (
    <div className="h-[calc(100vh-3.5rem)] overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Left panel — list */}
        <ResizablePanel defaultSize={38} minSize={25} maxSize={55}>
          <div className="flex flex-col h-full border-r border-border">
            <ContactListPanel
              selectedId={selectedContact?.id ?? null}
              onSelect={(contact: any) => setSelectedContact(contact)}
            />
          </div>
        </ResizablePanel>

        <ResizableHandle withHandle />

        {/* Right panel — detail */}
        <ResizablePanel defaultSize={62}>
          <div className="h-full bg-card">
            {selectedContact ? (
              <ContactDetailPanel contact={selectedContact} />
            ) : (
              <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
                Seleziona un contatto per visualizzare i dettagli
              </div>
            )}
          </div>
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
  );
}
