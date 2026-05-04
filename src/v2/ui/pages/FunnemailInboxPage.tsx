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
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { EmailDetailView } from "@/components/outreach/EmailDetailView";
import { useFunnemailInbox } from "@/v2/hooks/useFunnemailInbox";
import { useGlobalFilters } from "@/contexts/GlobalFiltersContext";
import { FunnemailMailList } from "./funnemail-inbox/FunnemailMailList";

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
        <div className="flex-shrink-0 border-b border-border px-3 py-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={g.filters.funnemailSearch}
              onChange={(event) => g.setFilter("funnemailSearch", event.target.value)}
              placeholder="Cerca email..."
              className="h-7 pl-8 text-xs"
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[10px] text-muted-foreground">
            <span className="font-semibold text-foreground">{ctrl.selectedFolderLabel}</span>
            <span><strong className="text-foreground">{ctrl.filteredMails.length}</strong> visibili</span>
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