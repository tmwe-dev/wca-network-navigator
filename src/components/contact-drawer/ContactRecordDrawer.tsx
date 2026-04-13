import { useContactDrawer } from "@/contexts/ContactDrawerContext";
import { useContactRecord, useUpdateContactRecord } from "@/hooks/useContactRecord";
import { ContactRecordHeader } from "./ContactRecordHeader";
import { ContactRecordFields } from "./ContactRecordFields";
import { ContactRecordInteractions } from "./ContactRecordInteractions";
import { ContactRecordActions } from "./ContactRecordActions";
import { ContactRecordAgent } from "./ContactRecordAgent";
import { ContactEnrichmentCard } from "@/components/contacts/ContactEnrichmentCard";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "@/hooks/use-toast";
import { AnimatePresence, motion } from "framer-motion";
import { useEffect, forwardRef, type ReactNode } from "react";

export const ContactRecordDrawer = forwardRef<HTMLDivElement>(function ContactRecordDrawer(_props, _ref) {
  const { isOpen, target, list, currentIndex, close, goNext, goPrev } = useContactDrawer();
  const { data: record, isLoading } = useContactRecord(target?.sourceType ?? null, target?.sourceId ?? null);
  const updateMutation = useUpdateContactRecord();
  // Keyboard navigation
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      if (e.key === "ArrowRight" || e.key === "ArrowDown") { e.preventDefault(); goNext(); }
      if (e.key === "ArrowLeft" || e.key === "ArrowUp") { e.preventDefault(); goPrev(); }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, close, goNext, goPrev]);

  const handleSave = (updates: Record<string, any>) => {
    if (!target) return;
    updateMutation.mutate(
      { sourceType: target.sourceType, sourceId: target.sourceId, updates },
      {
        onSuccess: () => toast({ title: "Salvato ✓" }),
        onError: () => toast({ title: "Errore nel salvataggio", variant: "destructive" }),
      }
    );
  };

  const ed = record?.enrichmentData as Record<string, unknown> | null | undefined;
  const hasEnrichment = Boolean(ed && (
    ed.contact_profile ||
    ed.company_profile ||
    ed.linkedin_url ||
    ed.linkedin_profile_url
  ));

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 bg-black/30 backdrop-blur-sm"
            onClick={close}
          />

          {/* Drawer */}
          <motion.div
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", damping: 30, stiffness: 300 }}
            className="fixed right-0 top-0 bottom-0 z-50 w-full max-w-xl bg-card border-l border-border shadow-2xl flex flex-col"
          >
            {record && target ? (
              <>
                <ContactRecordHeader
                  sourceType={target.sourceType}
                  companyName={record.companyName}
                  contactName={record.contactName}
                  currentIndex={currentIndex}
                  totalCount={list.length}
                  onPrev={goPrev}
                  onNext={goNext}
                  onClose={close}
                />

                <ScrollArea className="flex-1">
                  <div className="p-6 space-y-5">
                    {/* Editable fields + status */}
                    <ContactRecordFields
                      record={record}
                      onSave={handleSave}
                      isSaving={updateMutation.isPending}
                    />

                    {/* Communication actions */}
                    {(<ContactRecordActions record={record} />) as ReactNode}

                    {/* Agent assignment */}
                    <ContactRecordAgent sourceId={record.sourceId} sourceType={record.sourceType} />

                    {/* Enrichment data */}
                    {hasEnrichment && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                          <Sparkles className="w-3.5 h-3.5 text-amber-400" />
                          Dati Arricchimento AI
                        </div>
                        <ContactEnrichmentCard
                          enrichmentData={record.enrichmentData as Record<string, unknown>}
                          deepSearchAt={record.deepSearchAt}
                        />
                      </div>
                    )}

                    {/* Interactions timeline */}
                    <ContactRecordInteractions
                      sourceType={target.sourceType}
                      sourceId={target.sourceId}
                      partnerId={record.partnerId}
                    />
                  </div>
                </ScrollArea>
              </>
            ) : isLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : (
              <div className="flex-1 flex items-center justify-center text-sm text-muted-foreground">
                Record non trovato
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
});