import { useState, useCallback, useMemo } from "react";
import GoalBar from "@/components/workspace/GoalBar";
import ContactListPanel from "@/components/workspace/ContactListPanel";
import EmailCanvas from "@/components/workspace/EmailCanvas";
import { type AllActivity, useAllActivities, useDeleteActivities } from "@/hooks/useActivities";
import { useWorkspaceDocuments } from "@/hooks/useWorkspaceDocuments";
import { useWorkspacePresets, type WorkspacePreset } from "@/hooks/useWorkspacePresets";
import { useEmailGenerator } from "@/hooks/useEmailGenerator";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { Sparkles, Search, Zap, Trash2, Square } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { toast } from "@/hooks/use-toast";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface StoredEmail {
  subject: string;
  body: string;
  contactEmail: string | null;
  partnerName: string;
  contactName: string | null;
  activityId: string;
}

export default function Workspace() {
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);
  const [goal, setGoal] = useState("");
  const [baseProposal, setBaseProposal] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const { documents, uploading, upload, remove } = useWorkspaceDocuments();
  const { presets, save: savePreset, remove: removePreset } = useWorkspacePresets();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [generatedEmails, setGeneratedEmails] = useState<Map<string, StoredEmail>>(new Map());
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const deepSearch = useDeepSearch();
  const { data: activities } = useAllActivities();
  const { generate } = useEmailGenerator();
  const deleteActivities = useDeleteActivities();

  const emailActivities = useMemo(() =>
    (activities || []).filter(
      (a) => a.activity_type === "send_email" && a.status !== "completed"
    ), [activities]);

  // Preset handlers
  const handleLoadPreset = useCallback((preset: WorkspacePreset) => {
    setGoal(preset.goal || "");
    setBaseProposal(preset.base_proposal || "");
    setReferenceLinks(preset.reference_links || []);
    setActivePresetId(preset.id);
  }, []);

  const handleSavePreset = useCallback((name: string, id?: string) => {
    savePreset.mutate({
      id,
      name,
      goal,
      base_proposal: baseProposal,
      document_ids: documents.map((d) => d.id),
      reference_links: referenceLinks,
    });
  }, [goal, baseProposal, documents, referenceLinks, savePreset]);

  const handleDeletePreset = useCallback((id: string) => {
    removePreset.mutate(id);
    if (activePresetId === id) setActivePresetId(null);
  }, [removePreset, activePresetId]);

  // Selection handlers
  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }, []);
  const handleSelectAll = useCallback(() => setSelectedIds(new Set(emailActivities.map((a) => a.id))), [emailActivities]);
  const handleDeselectAll = useCallback(() => setSelectedIds(new Set()), []);

  const handleEmailGenerated = useCallback((activityId: string, email: StoredEmail) => {
    setGeneratedEmails((prev) => { const next = new Map(prev); next.set(activityId, email); return next; });
  }, []);

  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await deleteActivities.mutateAsync(ids);
      if (selectedActivity && selectedIds.has(selectedActivity.id)) setSelectedActivity(null);
      setSelectedIds(new Set());
      toast({ title: `${ids.length} attività eliminate` });
    } catch { toast({ title: "Errore durante l'eliminazione", variant: "destructive" }); }
  };

  const handleDeepSearch = () => {
    const targets = selectedIds.size > 0 ? emailActivities.filter((a) => selectedIds.has(a.id)) : emailActivities;
    const uniquePartnerIds = [...new Set(targets.map((a) => a.partner_id))];
    if (!uniquePartnerIds.length) return;
    deepSearch.start(uniquePartnerIds);
  };

  const handleGenerateAll = async () => {
    const targets = selectedIds.size > 0 ? emailActivities.filter((a) => selectedIds.has(a.id)) : emailActivities;
    const toGenerate = targets.slice(0, 20);
    if (toGenerate.length === 0) return;
    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: toGenerate.length });
    let generated = 0;
    for (const activity of toGenerate) {
      setBatchProgress({ current: generated + 1, total: toGenerate.length });
      try {
        const result = await generate({ activity_id: activity.id, goal, base_proposal: baseProposal, document_ids: documents.map((d) => d.id), reference_urls: referenceLinks });
        if (result) {
          handleEmailGenerated(activity.id, { subject: result.subject, body: result.body, contactEmail: result.contact_email, partnerName: result.partner_name, contactName: result.contact_name, activityId: activity.id });
        }
      } catch { /* continue */ }
      generated++;
      if (generated < toGenerate.length) await new Promise((r) => setTimeout(r, 500));
    }
    setBatchGenerating(false);
    setBatchProgress(null);
    setCurrentEmailIndex(0);
    toast({ title: `${generated} email generate con successo` });
  };

  const emailKeys = Array.from(generatedEmails.keys());
  const handleIndexChange = (idx: number) => {
    setCurrentEmailIndex(idx);
    const activityId = emailKeys[idx];
    if (activityId) { const act = emailActivities.find((a) => a.id === activityId); if (act) setSelectedActivity(act); }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden bg-stone-50/80">
      {/* Left: Contact list — full height */}
      <div className="w-[320px] shrink-0 border-r border-stone-200/60 bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col">
        {/* Header inside contact list */}
        <div className="px-3 py-2.5 border-b border-stone-200/60 space-y-2">
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-violet-100 flex items-center justify-center">
              <Sparkles className="w-3.5 h-3.5 text-violet-500" />
            </div>
            <h1 className="text-sm font-bold tracking-tight text-stone-800">Email Workspace</h1>
          </div>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca partner..."
              className="pl-8 h-7 text-xs bg-white/80 border-stone-200 text-stone-600 placeholder:text-stone-400 focus:ring-violet-300/50"
            />
          </div>
        </div>
        <ContactListPanel
          selectedActivityId={selectedActivity?.id || null}
          onSelect={setSelectedActivity}
          search={search}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
        />
      </div>

      {/* Right: Config + Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top action bar */}
        <div className="px-4 py-2 border-b border-stone-200/60 flex items-center gap-2 bg-white/60 backdrop-blur-sm shrink-0">
          {deepSearch.running && deepSearch.current && (
            <div className="flex items-center gap-2 mr-1">
              <span className="text-[11px] text-violet-600 font-medium whitespace-nowrap">
                Deep Search {deepSearch.current.index}/{deepSearch.current.total}
              </span>
              <Progress value={(deepSearch.current.index / deepSearch.current.total) * 100} className="w-20 h-1.5" />
            </div>
          )}
          <div className="flex-1" />

          {deepSearch.running ? (
            <Button onClick={() => deepSearch.stop()} size="sm" variant="destructive" className="h-7 gap-1.5 text-xs">
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          ) : (
            <Button onClick={handleDeepSearch} disabled={batchGenerating || emailActivities.length === 0} size="sm" variant="outline" className="h-7 gap-1.5 text-xs border-violet-200 text-violet-600 hover:bg-violet-50">
              <Sparkles className="w-3.5 h-3.5" />
              {selectedCount > 0 ? `Deep Search (${selectedCount})` : "Deep Search"}
            </Button>
          )}

          {selectedCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="destructive" className="h-7 gap-1.5 text-xs" disabled={deleteActivities.isPending}>
                  <Trash2 className="w-3.5 h-3.5" /> Elimina ({selectedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare {selectedCount} attività?</AlertDialogTitle>
                  <AlertDialogDescription>Le attività selezionate verranno eliminate definitivamente.</AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">Elimina</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button onClick={handleGenerateAll} disabled={batchGenerating || deepSearch.running || emailActivities.length === 0} size="sm" className="h-7 gap-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs">
            <Zap className="w-3.5 h-3.5" />
            {selectedCount > 0 ? `Genera (${selectedCount})` : "Genera Tutte"}
          </Button>
        </div>

        {/* GoalBar config area */}
        <div className="px-4 py-2.5 border-b border-stone-200/60 bg-white/40 shrink-0">
          <GoalBar
            goal={goal} baseProposal={baseProposal}
            onGoalChange={setGoal} onBaseProposalChange={setBaseProposal}
            documents={documents} onUploadDocument={upload} onRemoveDocument={remove} uploading={uploading}
            referenceLinks={referenceLinks}
            onAddLink={(url) => setReferenceLinks((prev) => [...prev, url])}
            onRemoveLink={(idx) => setReferenceLinks((prev) => prev.filter((_, i) => i !== idx))}
            presets={presets} activePresetId={activePresetId}
            onLoadPreset={handleLoadPreset} onSavePreset={handleSavePreset} onDeletePreset={handleDeletePreset}
          />
        </div>

        {/* Email Canvas — fills remaining space */}
        <div className="flex-1 overflow-hidden">
          <EmailCanvas
            activity={selectedActivity} goal={goal} baseProposal={baseProposal}
            documentIds={documents.map((d) => d.id)} referenceUrls={referenceLinks}
            generatedEmails={generatedEmails} onEmailGenerated={handleEmailGenerated}
            currentEmailIndex={currentEmailIndex} onIndexChange={handleIndexChange}
            totalEmails={emailKeys.length} batchGenerating={batchGenerating} batchProgress={batchProgress}
          />
        </div>
      </div>
    </div>
  );
}
