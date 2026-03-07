import { useState } from "react";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";

export default function Contacts() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel — list */}
      <div className="w-[420px] min-w-[320px] border-r border-border flex flex-col">
        <ContactListPanel
          selectedId={selectedContact?.id ?? null}
          onSelect={(contact: any) => setSelectedContact(contact)}
        />
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 bg-card">
        {selectedContact ? (
          <ContactDetailPanel contact={selectedContact} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Seleziona un contatto per visualizzare i dettagli
          </div>
        )}
      </div>
    </div>
  );
}
