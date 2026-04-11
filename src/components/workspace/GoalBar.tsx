import { useRef, useState } from "react";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Target, FileText, Paperclip, Link2, X, Plus, Loader2, Save, Trash2,
  ExternalLink,
} from "lucide-react";
import { type WorkspaceDoc } from "@/hooks/useWorkspaceDocuments";
import { type WorkspacePreset } from "@/hooks/useWorkspacePresets";
import { toast } from "@/hooks/use-toast";
import ContentPicker from "@/components/shared/ContentPicker";
import { createLogger } from "@/lib/log";

const log = createLogger("GoalBar");

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
  presets: WorkspacePreset[];
  activePresetId: string | null;
  onLoadPreset: (preset: WorkspacePreset) => void;
  onSavePreset: (name: string, id?: string) => void;
  onDeletePreset: (id: string) => void;
}

function getFileIcon(name: string) {
  const ext = name.split(".").pop()?.toLowerCase();
  if (ext === "pdf") return "📄";
  if (ext === "doc" || ext === "docx") return "📝";
  if (ext === "txt" || ext === "md") return "📃";
  return "📎";
}

function formatSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function tryHostname(url: string) {
  try { return new URL(url).hostname; } catch (e) { log.debug("fallback used after parse failure", { error: e instanceof Error ? e.message : String(e) }); return url; }
}

export default function GoalBar({
  goal, baseProposal, onGoalChange, onBaseProposalChange,
  documents, onUploadDocument, onRemoveDocument, uploading,
  referenceLinks, onAddLink, onRemoveLink,
  presets, activePresetId, onLoadPreset, onSavePreset, onDeletePreset,
}: GoalBarProps) {
  const safeDocuments = documents ?? [];
  const safeLinks = referenceLinks ?? [];
  const fileRef = useRef<HTMLInputElement>(null);
  const [linkInput, setLinkInput] = useState("");
  const [presetName, setPresetName] = useState("");
  const [showSave, setShowSave] = useState(false);


  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) { onUploadDocument(file); e.target.value = ""; }
  };

  const handleAddLink = () => {
    const url = linkInput.trim();
    if (!url) return;
    onAddLink(url.startsWith("http") ? url : `https://${url}`);
    setLinkInput("");
  };

  const handlePresetSelect = (value: string) => {
    if (value === "__save__") { setShowSave(true); return; }
    const preset = presets.find((p) => p.id === value);
    if (preset) onLoadPreset(preset);
  };

  const handleSavePreset = () => {
    const name = presetName.trim();
    if (!name) { toast({ title: "Inserisci un nome", variant: "destructive" }); return; }
    onSavePreset(name, activePresetId || undefined);
    setShowSave(false);
    setPresetName("");
    toast({ title: "Preset salvato" });
  };

  return (
    <div className="space-y-2">
      <Tabs defaultValue="goal" className="w-full">
        <TabsList className="h-8 bg-transparent border-0 rounded-none p-0 gap-1">
          <TabsTrigger value="goal" className="mission-tab h-6 gap-1.5">
            <Target className="w-3.5 h-3.5" /> Goal
          </TabsTrigger>
          <TabsTrigger value="proposal" className="mission-tab h-6 gap-1.5">
            <FileText className="w-3.5 h-3.5" /> Proposta
          </TabsTrigger>
          <TabsTrigger value="docs" className="mission-tab h-6 gap-1.5">
            <Paperclip className="w-3.5 h-3.5" /> Documenti
            {safeDocuments.length > 0 && <Badge className="h-4 px-1 text-[9px] bg-violet-500/20 text-violet-300 hover:bg-violet-500/20">{safeDocuments.length}</Badge>}
          </TabsTrigger>
          <TabsTrigger value="links" className="mission-tab h-6 gap-1.5">
            <Link2 className="w-3.5 h-3.5" /> Link
            {safeLinks.length > 0 && <Badge className="h-4 px-1 text-[9px] bg-violet-500/20 text-violet-300 hover:bg-violet-500/20">{safeLinks.length}</Badge>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="goal" className="mt-2 space-y-1.5">
          <ContentPicker type="goals" onSelect={onGoalChange} selectedText={goal} className="w-full" />
          <Textarea value={goal} onChange={(e) => onGoalChange(e.target.value)}
            placeholder="Es. Proporre una collaborazione per spedizioni via mare FCL verso il Far East..."
            className="min-h-[120px] max-h-[200px] text-sm bg-muted/20 border-border text-foreground placeholder:text-muted-foreground" />
        </TabsContent>

        <TabsContent value="proposal" className="mt-2 space-y-1.5">
          <ContentPicker type="proposals" onSelect={onBaseProposalChange} selectedText={baseProposal} className="w-full" />
          <Textarea value={baseProposal} onChange={(e) => onBaseProposalChange(e.target.value)}
            placeholder="Es. Offriamo transit time competitivi di 25 giorni, servizio door-to-door con tracking..."
            className="min-h-[120px] max-h-[200px] text-sm bg-muted/20 border-border text-foreground placeholder:text-muted-foreground" />
        </TabsContent>

        <TabsContent value="docs" className="mt-2">
          <div className="space-y-2">
            {safeDocuments.length > 0 && (
              <div className="grid grid-cols-3 gap-2">
                {safeDocuments.map((doc) => (
                  <div key={doc.id} className="relative group border border-border rounded-lg p-2.5 hover:border-primary/30 transition-colors bg-card">
                    <button onClick={() => onRemoveDocument(doc.id)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive/20 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/30">
                      <X className="w-3 h-3" />
                    </button>
                    <div className="flex flex-col items-center gap-1.5">
                      <span className="text-2xl">{getFileIcon(doc.file_name)}</span>
                      <span className="text-[10px] text-foreground truncate w-full text-center font-medium">
                        {doc.file_name.length > 18 ? doc.file_name.slice(0, 16) + "…" : doc.file_name}
                      </span>
                      <span className="text-[9px] text-muted-foreground">{formatSize(doc.file_size)}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
            <input ref={fileRef} type="file" accept=".pdf,.docx,.doc,.txt,.md" className="hidden" onChange={handleFileChange} />
            <Button variant="outline" size="sm" className="h-7 text-xs gap-1 w-full"
              onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
              Allega documento
            </Button>
          </div>
        </TabsContent>

        <TabsContent value="links" className="mt-2">
          <div className="space-y-2">
            {safeLinks.length > 0 && (
              <div className="grid grid-cols-2 gap-2">
                {safeLinks.map((link, idx) => (
                  <div key={idx} className="relative group border border-border rounded-lg p-2 hover:border-primary/30 transition-colors bg-card">
                    <button onClick={() => onRemoveLink(idx)}
                      className="absolute -top-1.5 -right-1.5 w-5 h-5 rounded-full bg-destructive/20 text-destructive flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-destructive/30">
                      <X className="w-3 h-3" />
                    </button>
                    <a href={link} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 min-w-0">
                      <img src={`https://www.google.com/s2/favicons?domain=${tryHostname(link)}&sz=32`} alt="" className="w-5 h-5 rounded shrink-0"
                        onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }} />
                      <div className="min-w-0">
                        <p className="text-[11px] font-medium text-foreground truncate">{tryHostname(link)}</p>
                        <p className="text-[9px] text-muted-foreground truncate">{link}</p>
                      </div>
                      <ExternalLink className="w-3 h-3 text-muted-foreground/50 shrink-0" />
                    </a>
                  </div>
                ))}
              </div>
            )}
            <div className="flex items-center gap-1">
              <Input value={linkInput} onChange={(e) => setLinkInput(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleAddLink()}
                placeholder="https://..." className="h-7 text-xs border-border flex-1" />
              <Button variant="outline" size="sm" className="h-7 text-xs" onClick={handleAddLink}>
                <Plus className="w-3 h-3" />
              </Button>
            </div>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  );
}
