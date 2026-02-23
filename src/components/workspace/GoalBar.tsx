import { useRef, useState } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Target, FileText, Paperclip, Link2, X, Plus, Loader2 } from "lucide-react";
import { type WorkspaceDoc } from "@/hooks/useWorkspaceDocuments";

interface GoalBarProps {
  goal: string;
  baseProposal: string;
  onGoalChange: (v: string) => void;
  onBaseProposalChange: (v: string) => void;
  documents: WorkspaceDoc[];
  onUploadDocument: (file: File) => void;
  onRemoveDocument: (id: string) => void;
  uploading?: boolean;
  referenceLinks: string[];
  onAddLink: (url: string) => void;
  onRemoveLink: (idx: number) => void;
}

export default function GoalBar({
  goal, baseProposal, onGoalChange, onBaseProposalChange,
  documents, onUploadDocument, onRemoveDocument, uploading,
  referenceLinks, onAddLink, onRemoveLink,
}: GoalBarProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState("");

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onUploadDocument(file);
      e.target.value = "";
    }
  };

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    onAddLink(url.startsWith("http") ? url : `https://${url}`);
    setLinkInput("");
  };

  return (
    <div className="space-y-3 p-4 rounded-xl border border-border/50 bg-card/60 backdrop-blur-xl">
      {/* Row 1: Goal + Proposta */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Target className="w-3.5 h-3.5 text-primary" />
            Goal della comunicazione
          </Label>
          <Textarea
            value={goal}
            onChange={(e) => onGoalChange(e.target.value)}
            placeholder="Es. Proporre una collaborazione per spedizioni via mare FCL verso il Far East..."
            className="min-h-[60px] text-sm bg-background/50 border-border/30 resize-none focus:ring-primary/30"
          />
        </div>
        <div className="flex-1 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <FileText className="w-3.5 h-3.5 text-primary" />
            Proposta di base
          </Label>
          <Textarea
            value={baseProposal}
            onChange={(e) => onBaseProposalChange(e.target.value)}
            placeholder="Es. Offriamo transit time competitivi di 25 giorni, servizio door-to-door con tracking..."
            className="min-h-[60px] text-sm bg-background/50 border-border/30 resize-none focus:ring-primary/30"
          />
        </div>
      </div>

      {/* Row 2: Documenti KB + Link di riferimento */}
      <div className="flex gap-4">
        {/* Documenti */}
        <div className="flex-1 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Paperclip className="w-3.5 h-3.5 text-primary" />
            Documenti Knowledge Base
          </Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {documents.map((doc) => (
              <Badge key={doc.id} variant="secondary" className="gap-1 text-xs pr-1">
                {doc.file_name.length > 20 ? doc.file_name.slice(0, 18) + "…" : doc.file_name}
                <button onClick={() => onRemoveDocument(doc.id)} className="ml-0.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <input
              ref={fileRef}
              type="file"
              accept=".pdf,.docx,.doc,.txt,.md"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs gap-1"
              onClick={() => fileRef.current?.click()}
              disabled={uploading}
            >
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Allega
            </Button>
          </div>
        </div>

        {/* Link */}
        <div className="flex-1 space-y-1.5">
          <Label className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
            <Link2 className="w-3.5 h-3.5 text-primary" />
            Link di riferimento
          </Label>
          <div className="flex flex-wrap items-center gap-1.5">
            {referenceLinks.map((link, idx) => (
              <Badge key={idx} variant="secondary" className="gap-1 text-xs pr-1">
                {new URL(link).hostname}
                <button onClick={() => onRemoveLink(idx)} className="ml-0.5 hover:text-destructive">
                  <X className="w-3 h-3" />
                </button>
              </Badge>
            ))}
            <div className="flex items-center gap-1">
              <Input
                value={linkInput}
                onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                placeholder="https://..."
                className="h-6 text-xs w-40 bg-background/50 border-border/30"
              />
              <Button variant="outline" size="sm" className="h-6 text-xs" onClick={handleAddLink}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
