/**
 * FunnemailInboxPage — il client di posta governato da Funnemail.
 *
 * Layout: tre colonne. Sidebar cartelle (operative + archive + sorting),
 * lista mail della cartella selezionata, pannello di lettura con decisioni.
 *
 * Logic-less: tutta la logica vive in `useFunnemailInbox` + DAL `funnemailInbox`.
 * Le cartelle e il classificatore sono governati da DB (zero hardcode).
 */
import * as React from "react";
import { Loader2, Sparkles } from "lucide-react";
import { PageTitleHeader } from "@/v2/ui/templates/PageTitleHeader";
import { EmailDetailView } from "@/components/outreach/EmailDetailView";
import { useFunnemailInbox } from "@/v2/hooks/useFunnemailInbox";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FunnemailMailList } from "./funnemail-inbox/FunnemailMailList";
import { MessageClaimBanner } from "./funnemail-inbox/MessageClaimBanner";
import { cn } from "@/lib/utils";
import { PersistentResizablePanelGroup } from "@/v2/ui/atoms/PersistentResizablePanelGroup";
import { ResizableHandle, ResizablePanel } from "@/components/ui/resizable";

type ViewKey = "all" | "unread";
// NOTA: i tab "Urgenti / In agenda / Commerciali" sono nascosti finché
// non avranno un signal DB dedicato (vedi audit 2026-05-05).
const VIEW_TABS: Array<{ value: ViewKey; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "unread", label: "Non lette" },
];

/**
 * FunnemailInboxPage — client di posta governato da Funnemail.
 *
 * Layout 2 colonne: lista mail (cartella + filtri dalla sidebar globale) +
 * lettore. Le cartelle, la ricerca e la vista sono nella sidebar filtri.
 */
export default function FunnemailInboxPage(): React.ReactElement {
  const ctrl = useFunnemailInbox();
  const g = useGlobalFilters();

  React.useEffect(() => {
    const prev = document.title;
    document.title = "Funnemail Inbox · WCA";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="flex flex-col h-full min-h-0 overflow-hidden">
      <PageTitleHeader icon={Sparkles} title="Funnemail" subtitle="Inbox classificata AI" />
      <PersistentResizablePanelGroup
        storageId="funnemail-inbox:list-vs-reader"
        direction="horizontal"
        className="flex min-h-0 flex-1"
      >
        <ResizablePanel defaultSize={32} minSize={22} maxSize={60} className="flex min-h-0 flex-col overflow-hidden border-r border-border">
        {/* Tab vista lette/non lette — dimensioni standard, ben visibili */}
        <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 py-2">
          <div className="flex items-center gap-2 overflow-x-auto">
            <div className="inline-flex shrink-0 rounded-md border border-border bg-background p-0.5">
              {VIEW_TABS.map((tab) => {
                const active = g.filters.funnemailView === tab.value;
                return (
                  <button
                    key={tab.value}
                    type="button"
                    onClick={() => g.setFilter("funnemailView", tab.value)}
                    className={cn(
                      "shrink-0 rounded px-3 py-1.5 text-sm font-medium transition-colors",
                      active
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {tab.label}
                  </button>
                );
              })}
            </div>
            <span className="ml-auto shrink-0 text-xs text-muted-foreground">
              <strong className="text-foreground">{ctrl.filteredMails.length}</strong> · {ctrl.selectedFolderLabel}
            </span>
          </div>
        </div>

        {ctrl.mailsLoading ? (
          <div className="flex h-32 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
          </div>
        ) : (
          <FunnemailMailList
            messages={ctrl.filteredMails}
            selectedId={ctrl.selectedMessageId}
            onSelect={(message) => ctrl.setSelectedMessageId(message.id)}
            bulkMarkRead={ctrl.bulkMarkRead}
            bulkArchive={ctrl.bulkArchive}
            bulkDelete={ctrl.bulkDelete}
            bulkAssignGroup={ctrl.bulkAssignGroup}
            bulkBusy={ctrl.bulkBusy}
            onReclassify={ctrl.reclassify}
            reclassifying={ctrl.reclassifying}
          />
        )}
        </ResizablePanel>
        <ResizableHandle withHandle />
        <ResizablePanel defaultSize={68} minSize={40} className="flex min-h-0 flex-col overflow-hidden">
          {ctrl.selectedMail ? (
            <div className="flex min-h-0 flex-1 flex-col">
              <MessageClaimBanner messageId={ctrl.selectedMail.id} />
              <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
                <EmailDetailView message={ctrl.selectedMail} onClose={() => ctrl.setSelectedMessageId(null)} />
              </div>
            </div>
          ) : (
            <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
              Seleziona una mail per leggerla
            </div>
          )}
        </ResizablePanel>
      </PersistentResizablePanelGroup>
    </div>
  );
}

export { FunnemailInboxPage };