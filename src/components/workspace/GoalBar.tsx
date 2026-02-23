import { useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
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
  const safeDocuments = documents ?? [];
  const safeLinks = referenceLinks ?? [];
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
    <Tabs defaultValue="goal" className="w-full">
      <TabsList className="h-9 bg-stone-100/80 border border-stone-200/60 rounded-lg p-0.5 gap-0.5">
        <TabsTrigger
          value="goal"
          className="h-7 px-3 text-xs gap-1.5 rounded-md data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none text-stone-500"
        >
          <Target className="w-3.5 h-3.5" />
          Goal
        </TabsTrigger>
        <TabsTrigger
          value="proposal"
          className="h-7 px-3 text-xs gap-1.5 rounded-md data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none text-stone-500"
        >
          <FileText className="w-3.5 h-3.5" />
          Proposta
        </TabsTrigger>
        <TabsTrigger
          value="docs"
          className="h-7 px-3 text-xs gap-1.5 rounded-md data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none text-stone-500"
        >
          <Paperclip className="w-3.5 h-3.5" />
          Documenti
          {safeDocuments.length > 0 && (
            <Badge className="h-4 px-1 text-[9px] bg-violet-200 text-violet-700 hover:bg-violet-200">{safeDocuments.length}</Badge>
          )}
        </TabsTrigger>
        <TabsTrigger
          value="links"
          className="h-7 px-3 text-xs gap-1.5 rounded-md data-[state=active]:bg-violet-50 data-[state=active]:text-violet-700 data-[state=active]:shadow-none text-stone-500"
        >
          <Link2 className="w-3.5 h-3.5" />
          Link
          {safeLinks.length > 0 && (
            <Badge className="h-4 px-1 text-[9px] bg-violet-200 text-violet-700 hover:bg-violet-200">{safeLinks.length}</Badge>
          )}
        </TabsTrigger>
      </TabsList>

      <TabsContent value="goal" className="mt-2">
        <Textarea
          value={goal}
          onChange={(e) => onGoalChange(e.target.value)}
          placeholder="Es. Proporre una collaborazione per spedizioni via mare FCL verso il Far East..."
          className="min-h-[56px] max-h-[80px] text-sm bg-white/80 border-stone-200 resize-none focus:ring-violet-300/50 text-stone-700 placeholder:text-stone-400"
        />
      </TabsContent>

      <TabsContent value="proposal" className="mt-2">
        <Textarea
          value={baseProposal}
          onChange={(e) => onBaseProposalChange(e.target.value)}
          placeholder="Es. Offriamo transit time competitivi di 25 giorni, servizio door-to-door con tracking..."
          className="min-h-[56px] max-h-[80px] text-sm bg-white/80 border-stone-200 resize-none focus:ring-violet-300/50 text-stone-700 placeholder:text-stone-400"
        />
      </TabsContent>

      <TabsContent value="docs" className="mt-2">
        <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] p-2 rounded-lg bg-white/80 border border-stone-200">
          {safeDocuments.map((doc) => (
            <Badge key={doc.id} className="gap-1 text-xs pr-1 bg-violet-100 text-violet-700 hover:bg-violet-150 border-0">
              {doc.file_name.length > 20 ? doc.file_name.slice(0, 18) + "…" : doc.file_name}
              <button onClick={() => onRemoveDocument(doc.id)} className="ml-0.5 hover:text-red-500">
                <X className="w-3 h-3" />
              </button>
            </Badge>
          ))}
          <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={handleFileChange} />
          <Button
            variant="outline"
            size="sm"
            className="h-6 text-xs gap-1 border-stone-200 text-stone-500 hover:bg-violet-50 hover:text-violet-600"
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
            Allega
          </Button>
        </div>
      </TabsContent>

      <TabsContent value="links" className="mt-2">
        <div className="flex flex-wrap items-center gap-1.5 min-h-[40px] p-2 rounded-lg bg-white/80 border border-stone-200">
          {safeLinks.map((link, idx) => (
            <Badge key={idx} className="gap-1 text-xs pr-1 bg-amber-100 text-amber-800 hover:bg-amber-150 border-0">
              {new URL(link).hostname}
              <button onClick={() => onRemoveLink(idx)} className="ml-0.5 hover:text-red-500">
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
              className="h-6 text-xs w-40 bg-white border-stone-200"
            />
            <Button
              variant="outline"
              size="sm"
              className="h-6 text-xs border-stone-200 text-stone-500 hover:bg-violet-50"
              onClick={handleAddLink}
            >
              <Plus className="w-3 h-3" />
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  );
}
