import { useState, useCallback, useEffect } from "react";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { ContactListPanel } from "@/components/contacts/ContactListPanel";
import { ContactDetailPanel } from "@/components/contacts/ContactDetailPanel";
import { Users, X } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

export default function Contacts() {
  const [selectedContact, setSelectedContact] = useState<any | null>(null);

  const handleContactUpdated = useCallback((updated: any) => {
    setSelectedContact(updated);
  }, []);

  const handleCloseDetail = useCallback(() => {
    setSelectedContact(null);
  }, []);

  useEffect(() => {
    const handler = async (e: Event) => {
      const contactId = (e as CustomEvent).detail?.contactId;
      if (!contactId) return;
      try {
        const { data } = await supabase
          .from("imported_contacts")
          .select("*")
          .eq("id", contactId)
          .single();
        if (data) setSelectedContact(data);
      } catch { /* intentionally ignored: best-effort cleanup */ }
    };
    window.addEventListener("crm-select-contact", handler);
    return () => window.removeEventListener("crm-select-contact", handler);
  }, []);

  const hasDetail = !!selectedContact;

  return (
    <div className="h-full overflow-hidden">
      <ResizablePanelGroup direction="horizontal" className="h-full">
        {/* Column 1 — Contact list: always gets majority of space */}
        <ResizablePanel defaultSize={hasDetail ? 55 : 100} minSize={40} maxSize={80}>
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
            {/* Column 2 — Detail: starts small, max 55% */}
            <ResizablePanel defaultSize={45} minSize={20} maxSize={55}>
              <div className="h-full bg-card relative">
                <button
                  onClick={handleCloseDetail}
                  className="absolute top-2 right-2 z-10 p-1.5 rounded-md bg-muted/80 hover:bg-destructive/20 text-muted-foreground hover:text-destructive transition-colors"
                  title="Chiudi dettaglio"
                >
                  <X className="w-4 h-4" />
                </button>
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
            <ResizablePanel defaultSize={0} minSize={0} maxSize={0}>
              <div className="flex flex-col items-center justify-center h-full text-muted-foreground/40 bg-card/30">
                <Users className="w-10 h-10 mb-3 opacity-30" />
                <p className="text-sm font-medium">Seleziona un contatto</p>
                <p className="text-xs mt-1 opacity-60">Clicca 🔍 per visualizzare i dettagli</p>
              </div>
            </ResizablePanel>
          </>
        )}
      </ResizablePanelGroup>
    </div>
  );
}
