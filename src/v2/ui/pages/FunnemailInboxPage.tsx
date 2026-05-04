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
import { Loader2 } from "lucide-react";
import { EmailDetailView } from "@/components/outreach/EmailDetailView";
import { useFunnemailInbox } from "@/v2/hooks/useFunnemailInbox";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FunnemailMailList } from "./funnemail-inbox/FunnemailMailList";
import { cn } from "@/lib/utils";

type ViewKey = "all" | "unread" | "urgent" | "agenda" | "commercial";
const VIEW_TABS: Array<{ value: ViewKey; label: string }> = [
  { value: "all", label: "Tutte" },
  { value: "unread", label: "Non lette" },
  { value: "urgent", label: "Urgenti" },
  { value: "agenda", label: "In agenda" },
  { value: "commercial", label: "Commerciali" },
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
    <div className="flex h-[calc(100vh-3.5rem)] min-h-0 overflow-hidden">
      <section className="flex min-h-0 w-[440px] shrink-0 flex-col overflow-hidden border-r border-border">
        {/* Tab vista — sostituiscono il vecchio header search/titolo */}
        <div className="flex-shrink-0 border-b border-border bg-muted/30 px-2 py-1">
          <div className="flex items-center gap-1 overflow-x-auto">
            {VIEW_TABS.map((tab) => {
              const active = g.filters.funnemailView === tab.value;
              return (
                <button
                  key={tab.value}
                  type="button"
                  onClick={() => g.setFilter("funnemailView", tab.value)}
                  className={cn(
                    "shrink-0 rounded px-2 py-1 text-[11px] font-medium transition-colors",
                    active
                      ? "bg-primary/15 text-primary"
                      : "text-muted-foreground hover:bg-muted/60 hover:text-foreground",
                  )}
                >
                  {tab.label}
                </button>
              );
            })}
            <span className="ml-auto shrink-0 px-1 text-[10px] text-muted-foreground">
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
          />
        )}
      </section>

      {ctrl.selectedMail ? (
        <EmailDetailView message={ctrl.selectedMail} onClose={() => ctrl.setSelectedMessageId(null)} />
      ) : (
        <div className="flex min-h-0 flex-1 items-center justify-center text-sm text-muted-foreground">
          Seleziona una mail per leggerla
        </div>
      )}
    </div>
  );
}

export { FunnemailInboxPage };