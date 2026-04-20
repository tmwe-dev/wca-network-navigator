/**
 * KnowledgeBaseTab — list/edit/toggle/insert KB entries by category set.
 */
import * as React from "react";
import { useForgeKb, type ForgeKbEntry } from "@/v2/hooks/useForgeKb";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Loader2, Plus, Pencil, BookOpen } from "lucide-react";
import { RegenerateBanner } from "../RegenerateBanner";

interface Props {
  categories: string[] | null;
}

export function KnowledgeBaseTab({ categories }: Props) {
  const { entries, loading, savingId, update, toggleActive, insert } = useForgeKb(categories);
  const [editing, setEditing] = React.useState<ForgeKbEntry | null>(null);
  const [creating, setCreating] = React.useState(false);
  const [savedAt, setSavedAt] = React.useState(0);

  return (
    <div className="space-y-2 text-xs">
      <div className="flex items-center justify-between">
        <div className="text-[11px] text-muted-foreground">
          {categories?.length ? <>Categorie: <span className="font-mono">{categories.join(", ")}</span></> : "Tutte le categorie"}
          {" · "}
          <span>{entries.length} voci</span>
        </div>
        <Button size="sm" variant="outline" onClick={() => setCreating(true)} className="h-7 text-[10px]">
          <Plus className="w-3 h-3 mr-1" /> Aggiungi voce
        </Button>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-4 text-[11px] text-muted-foreground gap-1.5">
          <Loader2 className="w-3 h-3 animate-spin" /> Caricamento…
        </div>
      )}

      {!loading && entries.length === 0 && (
        <div className="text-center py-6 text-[11px] text-muted-foreground">
          <BookOpen className="w-6 h-6 mx-auto mb-2 opacity-40" />
          Nessuna voce KB per queste categorie.
        </div>
      )}

      <div className="space-y-1">
        {entries.map((e) => (
          <div key={e.id} className="rounded border border-border/40 bg-card p-2">
            <div className="flex items-start gap-2">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="font-medium text-xs truncate">{e.title}</span>
                  <Badge variant="outline" className="text-[9px]">{e.category}</Badge>
                  <Badge variant="outline" className="text-[9px]">P{e.priority}</Badge>
                  <span className="text-[10px] text-muted-foreground">{e.content.length.toLocaleString()} char</span>
                </div>
                <div className="text-[10px] text-muted-foreground line-clamp-2 mt-1">{e.content}</div>
              </div>
              <div className="flex items-center gap-1.5 shrink-0">
                <Switch checked={e.is_active} onCheckedChange={(v) => toggleActive(e.id, v)} disabled={savingId === e.id} />
                <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setEditing(e)}>
                  <Pencil className="w-3 h-3" />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>

      {editing && (
        <EditEntryDialog
          entry={editing}
          saving={savingId === editing.id}
          onClose={() => setEditing(null)}
          onSave={async (patch) => { await update(editing.id, patch); setEditing(null); }}
        />
      )}

      {creating && (
        <CreateEntryDialog
          defaultCategory={categories?.[0] ?? "vendita"}
          onClose={() => setCreating(false)}
          onCreate={async (input) => { const r = await insert(input); if (r) setCreating(false); }}
        />
      )}
    </div>
  );
}

function EditEntryDialog({
  entry, saving, onClose, onSave,
}: {
  entry: ForgeKbEntry;
  saving: boolean;
  onClose: () => void;
  onSave: (patch: Partial<Pick<ForgeKbEntry, "title" | "content" | "priority">>) => Promise<void>;
}) {
  const [title, setTitle] = React.useState(entry.title);
  const [content, setContent] = React.useState(entry.content);
  const [priority, setPriority] = React.useState(entry.priority);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Modifica voce KB · {entry.category}</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" placeholder="Titolo" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[260px] text-xs font-mono" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Priorità</span>
            <Input type="number" min={0} max={10} value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} className="h-7 w-20 text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button onClick={() => onSave({ title, content, priority })} disabled={saving}>
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Salva
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateEntryDialog({
  defaultCategory, onClose, onCreate,
}: {
  defaultCategory: string;
  onClose: () => void;
  onCreate: (input: { title: string; content: string; category: string; priority: number }) => Promise<void>;
}) {
  const [title, setTitle] = React.useState("");
  const [content, setContent] = React.useState("");
  const [category, setCategory] = React.useState(defaultCategory);
  const [priority, setPriority] = React.useState(5);
  const [saving, setSaving] = React.useState(false);

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-sm">Nuova voce KB</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <Input value={title} onChange={(e) => setTitle(e.target.value)} className="h-8 text-xs" placeholder="Titolo" />
          <Input value={category} onChange={(e) => setCategory(e.target.value)} className="h-8 text-xs" placeholder="Categoria (es. vendita, negoziazione)" />
          <Textarea value={content} onChange={(e) => setContent(e.target.value)} className="min-h-[200px] text-xs font-mono" placeholder="Contenuto della voce KB…" />
          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Priorità</span>
            <Input type="number" min={0} max={10} value={priority} onChange={(e) => setPriority(Number(e.target.value) || 0)} className="h-7 w-20 text-xs" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Annulla</Button>
          <Button
            onClick={async () => {
              if (!title.trim() || !content.trim()) return;
              setSaving(true);
              await onCreate({ title: title.trim(), content: content.trim(), category: category.trim(), priority });
              setSaving(false);
            }}
            disabled={saving || !title.trim() || !content.trim()}
          >
            {saving && <Loader2 className="w-3 h-3 mr-1 animate-spin" />}
            Crea
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
