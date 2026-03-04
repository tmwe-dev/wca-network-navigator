import { useState, useMemo } from "react";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { useContacts } from "@/hooks/useContacts";

export default function Contacts() {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const { data: contacts = [] } = useContacts();

  const selectedContact = useMemo(
    () => (selectedId ? contacts.find((c: any) => c.id === selectedId) : null),
    [selectedId, contacts]
  );

  return (
    <div className="flex h-[calc(100vh-3.5rem)] overflow-hidden">
      {/* Left panel — list */}
      <div className="w-[420px] min-w-[320px] border-r border-border flex flex-col">
        <ContactListPanel selectedId={selectedId} onSelect={setSelectedId} />
      </div>

      {/* Right panel — detail */}
      <div className="flex-1 bg-card">
        {selectedContact ? (
          <ContactDetailPanel contact={selectedContact as any} />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-muted-foreground">
            Seleziona un contatto per visualizzare i dettagli
          </div>
        )}
      </div>
    </div>
  );
}
