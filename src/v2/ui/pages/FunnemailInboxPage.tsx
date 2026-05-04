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
import { MailList } from "./funnemail-inbox/MailList";
import { MailReader } from "./funnemail-inbox/MailReader";
import { useFunnemailInbox } from "@/v2/hooks/useFunnemailInbox";

/**
 * FunnemailInboxPage — client di posta governato da Funnemail.
 *
 * Layout 2 colonne: lista mail (cartella + filtri dalla sidebar globale) +
 * lettore. Le cartelle, la ricerca e la vista sono nella sidebar filtri.
 */
export default function FunnemailInboxPage(): React.ReactElement {
  const ctrl = useFunnemailInbox();

  React.useEffect(() => {
    const prev = document.title;
    document.title = "Funnemail Inbox · WCA";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden">
      <MailList
        mails={ctrl.filteredMails}
        loading={ctrl.mailsLoading}
        selectedId={ctrl.selectedMessageId}
        onSelect={ctrl.setSelectedMessageId}
        folderLabel={ctrl.selectedFolderLabel}
      />
      <MailReader
        mail={ctrl.selectedMail}
        folders={ctrl.folders}
        onOverrideFolder={ctrl.overrideFolder}
        onReclassify={ctrl.reclassify}
        reclassifying={ctrl.reclassifying}
      />
    </div>
  );
}

export { FunnemailInboxPage };