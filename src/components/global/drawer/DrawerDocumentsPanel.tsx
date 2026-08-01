import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FileText, Paperclip, Link2, Plus, X, Upload, ExternalLink } from "lucide-react";

interface Document { id: string; file_name: string }

interface Props {
  documents: Document[];
  referenceLinks: string[];
  uploading: boolean;
  docsOpen: boolean;
  linksOpen: boolean;
  onDocsOpenChange: (open: boolean) => void;
  onLinksOpenChange: (open: boolean) => void;
  onUpload: (file: File) => void;
  onRemoveDocument: (id: string) => void;
  onSetReferenceLinks: (fn: (prev: string[]) => string[]) => void;
}

export function DrawerDocumentsPanel(props: Props) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [newLink, setNewLink] = useState("");

  const addLink = () => {
    const url = newLink.trim();
    if (!url) return;
    props.onSetReferenceLinks(prev => [...prev, url]);
    setNewLink("");
  };

  return (
    <>
      <Dialog open={props.docsOpen} onOpenChange={props.onDocsOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Paperclip className="w-4 h-4 text-primary" /> Documenti ({props.documents.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {props.documents.map(doc => (
              <div key={doc.id} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20 group">
                <FileText className="w-4 h-4 text-muted-foreground shrink-0" />
                <span className="text-sm text-foreground truncate flex-1">{doc.file_name}</span>
                <button onClick={() => props.onRemoveDocument(doc.id)} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded">
                  <X className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
            {props.documents.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nessun documento</p>}
          </div>
          <input ref={fileRef} type="file" className="hidden" onChange={e => { if (e.target.files?.[0]) props.onUpload(e.target.files[0]); }} />
          <Button variant="outline" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={props.uploading}>
            <Upload className="w-4 h-4" /> {props.uploading ? "Caricamento..." : "Carica documento"}
          </Button>
        </DialogContent>
      </Dialog>

      <Dialog open={props.linksOpen} onOpenChange={props.onLinksOpenChange}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-sm flex items-center gap-2"><Link2 className="w-4 h-4 text-emerald-500" /> Link ({props.referenceLinks.length})</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 max-h-[300px] overflow-y-auto">
            {props.referenceLinks.map((url, i) => (
              <div key={i} className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border border-border/20 group">
                <ExternalLink className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                <span className="text-xs truncate flex-1">{url}</span>
                <button onClick={() => props.onSetReferenceLinks(prev => prev.filter((_, j) => j !== i))} className="opacity-0 group-hover:opacity-100 p-1 hover:bg-destructive/10 rounded">
                  <X className="w-3.5 h-3.5 text-destructive" />
                </button>
              </div>
            ))}
            {props.referenceLinks.length === 0 && <p className="text-xs text-muted-foreground text-center py-4">Nessun link</p>}
          </div>
          <div className="flex gap-2">
            <Input value={newLink} onChange={e => setNewLink(e.target.value)} placeholder="https://..." className="h-9 text-sm flex-1" onKeyDown={e => e.key === "Enter" && addLink()} />
            <Button size="sm" variant="outline" onClick={addLink} className="h-9 px-3"><Plus className="w-4 h-4" /></Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
