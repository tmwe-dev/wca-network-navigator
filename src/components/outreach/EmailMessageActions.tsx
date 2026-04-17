/**
 * EmailMessageActions — Dropdown azioni singole per un messaggio email.
 * Usato dentro EmailDetailView.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuSub, DropdownMenuSubTrigger, DropdownMenuSubContent,
} from "@/components/ui/dropdown-menu";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Archive, ShieldBan, EyeOff, FolderInput, MoreHorizontal, Sparkles, MailOpen } from "lucide-react";
import {
  useBulkEmailAction, useCreateRuleFromSender, useImapFolders,
} from "@/hooks/useEmailFolderActions";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import type { ChannelMessage } from "@/hooks/useChannelMessages";

const RULE_ACTIONS = [
  { value: "mark_read", label: "Segna come letta" },
  { value: "archive", label: "Archivia" },
  { value: "hide", label: "Nascondi (solo UI)" },
  { value: "spam", label: "Spam" },
  { value: "move_to_folder", label: "Sposta in cartella" },
];

export function EmailMessageActions({ message }: { message: ChannelMessage }) {
  const [ruleOpen, setRuleOpen] = useState(false);
  const [moveOpen, setMoveOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const bulk = useBulkEmailAction();
  const markRead = useMarkAsRead();
  const { data: folders = [] } = useImapFolders();

  const minimal = [{ id: message.id, imap_uid: message.imap_uid }];

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1">
            <MoreHorizontal className="h-3.5 w-3.5" />Azioni
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          {!message.read_at && (
            <DropdownMenuItem onClick={() => markRead.mutate({ id: message.id, channel: message.channel, user_id: message.user_id })}>
              <MailOpen className="h-3.5 w-3.5 mr-2" />Segna come letto
            </DropdownMenuItem>
          )}
          <DropdownMenuItem onClick={() => bulk.mutate({ messages: minimal, action: "archive" })}>
            <Archive className="h-3.5 w-3.5 mr-2" />Archivia
          </DropdownMenuItem>
          <DropdownMenuSub>
            <DropdownMenuSubTrigger>
              <FolderInput className="h-3.5 w-3.5 mr-2" />Sposta in…
            </DropdownMenuSubTrigger>
            <DropdownMenuSubContent>
              {folders.length === 0 && <DropdownMenuItem disabled>Caricamento cartelle…</DropdownMenuItem>}
              {folders.map(f => (
                <DropdownMenuItem key={f}
                  onClick={() => bulk.mutate({ messages: minimal, action: "move", targetFolder: f })}>
                  {f}
                </DropdownMenuItem>
              ))}
            </DropdownMenuSubContent>
          </DropdownMenuSub>
          <DropdownMenuItem onClick={() => bulk.mutate({ messages: minimal, action: "hide" })}>
            <EyeOff className="h-3.5 w-3.5 mr-2" />Nascondi
          </DropdownMenuItem>
          <DropdownMenuItem className="text-destructive" onClick={() => bulk.mutate({ messages: minimal, action: "spam" })}>
            <ShieldBan className="h-3.5 w-3.5 mr-2" />Sposta in spam
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => setRuleOpen(true)}>
            <Sparkles className="h-3.5 w-3.5 mr-2" />Crea regola per questo mittente
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <CreateRuleDialog
        open={ruleOpen}
        onClose={() => setRuleOpen(false)}
        emailAddress={message.from_address || ""}
        folders={folders}
      />
    </>
  );
}

interface CreateRuleProps {
  open: boolean;
  onClose: () => void;
  emailAddress: string;
  folders: string[];
}

function CreateRuleDialog({ open, onClose, emailAddress, folders }: CreateRuleProps) {
  const [action, setAction] = useState("mark_read");
  const [target, setTarget] = useState("");
  const [autoExec, setAutoExec] = useState(true);
  const [applyHistory, setApplyHistory] = useState(true);
  const createRule = useCreateRuleFromSender();

  const handleSave = () => {
    createRule.mutate({
      email_address: emailAddress,
      auto_action: action,
      auto_execute: autoExec,
      target_folder: target || undefined,
      apply_to_history: applyHistory,
    }, { onSuccess: onClose });
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader><DialogTitle className="text-sm">Crea regola per {emailAddress}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div>
            <Label className="text-xs">Azione automatica</Label>
            <Select value={action} onValueChange={setAction}>
              <SelectTrigger className="h-8 text-xs mt-1"><SelectValue /></SelectTrigger>
              <SelectContent>
                {RULE_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          {action === "move_to_folder" && (
            <div>
              <Label className="text-xs">Cartella destinazione</Label>
              <Select value={target} onValueChange={setTarget}>
                <SelectTrigger className="h-8 text-xs mt-1"><SelectValue placeholder="Scegli cartella" /></SelectTrigger>
                <SelectContent>
                  {folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
          <div className="flex items-center gap-3">
            <Switch checked={autoExec} onCheckedChange={setAutoExec} />
            <Label className="text-xs">Auto-esegui sui prossimi messaggi</Label>
          </div>
          <div className="flex items-center gap-3">
            <Switch checked={applyHistory} onCheckedChange={setApplyHistory} />
            <Label className="text-xs">Applica retroattivamente alle email esistenti</Label>
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleSave} disabled={createRule.isPending || (action === "move_to_folder" && !target)}>
            Crea regola
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
