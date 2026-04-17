/**
 * EmailBulkToolbar — Toolbar contestuale per azioni bulk su email selezionate.
 * Mostra: segna lette, archivia, sposta in cartella, nascondi, crea regole per mittenti.
 */
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuTrigger, DropdownMenuContent, DropdownMenuItem,
} from "@/components/ui/dropdown-menu";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Archive, ShieldBan, EyeOff, Mail, FolderInput, X, Sparkles, ChevronDown,
} from "lucide-react";
import { useBulkEmailAction, useCreateRuleFromSender, useImapFolders } from "@/hooks/useEmailFolderActions";
import { useMarkAsRead } from "@/hooks/useEmailActions";
import type { ChannelMessage } from "@/hooks/useChannelMessages";
import { toast } from "sonner";

interface Props {
  selected: ChannelMessage[];
  onClear: () => void;
}

const RULE_ACTIONS = [
  { value: "mark_read", label: "Segna come letta" },
  { value: "archive", label: "Archivia" },
  { value: "hide", label: "Nascondi" },
  { value: "spam", label: "Spam" },
  { value: "move_to_folder", label: "Sposta in cartella" },
];

export function EmailBulkToolbar({ selected, onClear }: Props) {
  const [moveDialogOpen, setMoveDialogOpen] = useState(false);
  const [rulesDialogOpen, setRulesDialogOpen] = useState(false);
  const [moveTarget, setMoveTarget] = useState("");
  const bulk = useBulkEmailAction();
  const markRead = useMarkAsRead();
  const { data: folders = [] } = useImapFolders();

  if (selected.length === 0) return null;

  const minimal = selected.map(m => ({ id: m.id, imap_uid: m.imap_uid }));

  const handleMarkRead = async () => {
    const unread = selected.filter(m => !m.read_at);
    for (const m of unread) {
      await new Promise<void>((resolve) => {
        markRead.mutate({ id: m.id, channel: m.channel, user_id: m.user_id }, { onSettled: () => resolve() });
      });
    }
    toast.success(`Lette ${unread.length}`);
    onClear();
  };

  const handleMove = () => {
    if (!moveTarget) return;
    bulk.mutate(
      { messages: minimal, action: "move", targetFolder: moveTarget },
      { onSuccess: () => { setMoveDialogOpen(false); onClear(); } }
    );
  };

  return (
    <>
      <div className="flex-shrink-0 flex items-center gap-2 border-b border-primary/20 bg-primary/5 px-3 py-2">
        <Badge className="text-[10px] bg-primary text-primary-foreground">{selected.length} selezionate</Badge>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={handleMarkRead}>
          <Mail className="h-3.5 w-3.5" />Segna lette
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
          onClick={() => bulk.mutate({ messages: minimal, action: "archive" }, { onSuccess: onClear })}>
          <Archive className="h-3.5 w-3.5" />Archivia
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1"
          onClick={() => bulk.mutate({ messages: minimal, action: "hide" }, { onSuccess: onClear })}>
          <EyeOff className="h-3.5 w-3.5" />Nascondi
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-destructive"
          onClick={() => bulk.mutate({ messages: minimal, action: "spam" }, { onSuccess: onClear })}>
          <ShieldBan className="h-3.5 w-3.5" />Spam
        </Button>
        <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={() => setMoveDialogOpen(true)}>
          <FolderInput className="h-3.5 w-3.5" />Sposta…
        </Button>
        <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => setRulesDialogOpen(true)}>
          <Sparkles className="h-3.5 w-3.5" />Crea regole
        </Button>
        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 ml-auto" onClick={onClear}>
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>

      {/* Move dialog */}
      <Dialog open={moveDialogOpen} onOpenChange={setMoveDialogOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Sposta {selected.length} email in…</DialogTitle></DialogHeader>
          <Select value={moveTarget} onValueChange={setMoveTarget}>
            <SelectTrigger><SelectValue placeholder="Seleziona cartella" /></SelectTrigger>
            <SelectContent>
              {folders.length === 0 && <SelectItem value="__loading__" disabled>Caricamento cartelle…</SelectItem>}
              {folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setMoveDialogOpen(false)}>Annulla</Button>
            <Button onClick={handleMove} disabled={!moveTarget || bulk.isPending}>Sposta</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <BulkCreateRulesDialog open={rulesDialogOpen} onClose={() => { setRulesDialogOpen(false); onClear(); }} messages={selected} folders={folders} />
    </>
  );
}

/* ── Sub-dialog: bulk create rules grouped by sender ── */
interface RulesProps {
  open: boolean;
  onClose: () => void;
  messages: ChannelMessage[];
  folders: string[];
}

function BulkCreateRulesDialog({ open, onClose, messages, folders }: RulesProps) {
  const createRule = useCreateRuleFromSender();
  // Group by sender
  const grouped = new Map<string, number>();
  messages.forEach(m => {
    const addr = (m.from_address || "").toLowerCase();
    if (addr) grouped.set(addr, (grouped.get(addr) ?? 0) + 1);
  });
  const senders = Array.from(grouped.entries());

  // Per-sender action state
  const [actions, setActions] = useState<Record<string, { action: string; target: string }>>({});

  const handleCreate = async () => {
    let ok = 0;
    for (const [addr] of senders) {
      const sel = actions[addr];
      if (!sel || sel.action === "none") continue;
      try {
        await new Promise<void>((resolve, reject) => {
          createRule.mutate(
            {
              email_address: addr,
              auto_action: sel.action,
              auto_execute: true,
              target_folder: sel.target || undefined,
              apply_to_history: true,
            },
            { onSuccess: () => { ok++; resolve(); }, onError: () => reject() }
          );
        });
      } catch { /* already toasted */ }
    }
    toast.success(`${ok} regole create e applicate`);
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Crea regole per {senders.length} mittenti</DialogTitle></DialogHeader>
        <p className="text-xs text-muted-foreground">
          Per ciascun mittente scegli un'azione. La regola sarà applicata alle email storiche.
        </p>
        <div className="space-y-2">
          {senders.map(([addr, count]) => {
            const sel = actions[addr] ?? { action: "none", target: "" };
            return (
              <div key={addr} className="flex items-center gap-2 p-2 border border-border rounded-md">
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{addr}</p>
                  <p className="text-[10px] text-muted-foreground">{count} email</p>
                </div>
                <Select value={sel.action} onValueChange={(v) => setActions({ ...actions, [addr]: { ...sel, action: v } })}>
                  <SelectTrigger className="w-[160px] h-8 text-xs"><SelectValue placeholder="Nessuna" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="none">Nessuna</SelectItem>
                    {RULE_ACTIONS.map(a => <SelectItem key={a.value} value={a.value}>{a.label}</SelectItem>)}
                  </SelectContent>
                </Select>
                {sel.action === "move_to_folder" && (
                  <Select value={sel.target} onValueChange={(v) => setActions({ ...actions, [addr]: { ...sel, target: v } })}>
                    <SelectTrigger className="w-[120px] h-8 text-xs"><SelectValue placeholder="Cartella" /></SelectTrigger>
                    <SelectContent>
                      {folders.map(f => <SelectItem key={f} value={f}>{f}</SelectItem>)}
                    </SelectContent>
                  </Select>
                )}
              </div>
            );
          })}
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose}>Annulla</Button>
          <Button onClick={handleCreate} disabled={createRule.isPending}>
            <Sparkles className="h-3.5 w-3.5 mr-1" />Crea regole + applica
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
