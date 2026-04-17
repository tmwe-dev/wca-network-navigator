/**
 * EmailFolderSidebar — Lista cartelle email per filtraggio inbox.
 * Mostra cartelle derivate da channel_messages.folder (DISTINCT) per l'operatore corrente.
 */
import { Inbox, Folder, Archive, ShieldBan, EyeOff } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { useDbFolders } from "@/hooks/useEmailFolderActions";

interface Props {
  selected: string;
  onSelect: (folder: string) => void;
  showHidden: boolean;
  onToggleHidden: (v: boolean) => void;
}

function folderIcon(name: string) {
  const lower = name.toLowerCase();
  if (lower === "inbox") return Inbox;
  if (lower.includes("archive")) return Archive;
  if (lower.includes("junk") || lower.includes("spam")) return ShieldBan;
  return Folder;
}

export function EmailFolderSidebar({ selected, onSelect, showHidden, onToggleHidden }: Props) {
  const { data: folders = [], isLoading } = useDbFolders();

  return (
    <div className="w-40 shrink-0 border-r border-border bg-card/30 p-2 space-y-1 overflow-y-auto">
      <p className="text-[10px] uppercase font-semibold text-muted-foreground px-2 py-1">Cartelle</p>
      {isLoading ? (
        <div className="space-y-1">
          {[1, 2, 3].map(i => <Skeleton key={i} className="h-7 w-full" />)}
        </div>
      ) : folders.length === 0 ? (
        <button
          onClick={() => onSelect("INBOX")}
          className={cn(
            "w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors",
            selected === "INBOX" ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40"
          )}
        >
          <Inbox className="h-3.5 w-3.5" />
          INBOX
        </button>
      ) : (
        folders.map(({ folder, count }) => {
          const Icon = folderIcon(folder);
          return (
            <button
              key={folder}
              onClick={() => onSelect(folder)}
              className={cn(
                "w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors",
                selected === folder ? "bg-primary/10 text-primary font-medium" : "text-muted-foreground hover:bg-muted/40"
              )}
            >
              <Icon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate flex-1">{folder}</span>
              <span className="text-[10px] font-mono">{count}</span>
            </button>
          );
        })
      )}
      <div className="pt-2 mt-2 border-t border-border">
        <button
          onClick={() => onToggleHidden(!showHidden)}
          className={cn(
            "w-full text-left text-xs px-2 py-1.5 rounded-md flex items-center gap-2 transition-colors",
            showHidden ? "bg-warning/10 text-warning font-medium" : "text-muted-foreground hover:bg-muted/40"
          )}
        >
          <EyeOff className="h-3.5 w-3.5" />
          Nascoste {showHidden && "(on)"}
        </button>
      </div>
    </div>
  );
}
