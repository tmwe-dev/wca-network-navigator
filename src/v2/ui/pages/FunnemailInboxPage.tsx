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
import { FoldersSidebar } from "./funnemail-inbox/FoldersSidebar";
import { MailList } from "./funnemail-inbox/MailList";
import { MailReader } from "./funnemail-inbox/MailReader";
import { useFunnemailInbox } from "@/v2/hooks/useFunnemailInbox";

export default function FunnemailInboxPage(): React.ReactElement {
  const ctrl = useFunnemailInbox();

  React.useEffect(() => {
    const prev = document.title;
    document.title = "Funnemail Inbox · WCA";
    return () => { document.title = prev; };
  }, []);

  return (
    <div className="h-[calc(100vh-3.5rem)] flex overflow-hidden">
        <FoldersSidebar
          folders={ctrl.folders}
          counts={ctrl.counts}
          selectedSlug={ctrl.selectedFolder}
          onSelect={ctrl.setSelectedFolder}
          loading={ctrl.foldersLoading}
        />
        <MailList
          mails={ctrl.mails}
          loading={ctrl.mailsLoading}
          selectedId={ctrl.selectedMessageId}
          onSelect={ctrl.setSelectedMessageId}
          folderLabel={ctrl.selectedFolderLabel}
        />
        <MailReader
          mail={ctrl.selectedMail}
          folders={ctrl.folders}
          onOverrideFolder={ctrl.overrideFolder}
        />
    </div>
  );
}

export { FunnemailInboxPage };