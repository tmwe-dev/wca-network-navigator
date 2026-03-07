import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import GoalBar from "@/components/workspace/GoalBar";
import ContactListPanel from "@/components/workspace/ContactListPanel";
import EmailCanvas from "@/components/workspace/EmailCanvas";
import { type AllActivity, useAllActivities, useDeleteActivities } from "@/hooks/useActivities";
import { useWorkspaceDocuments } from "@/hooks/useWorkspaceDocuments";
import { useWorkspacePresets, type WorkspacePreset } from "@/hooks/useWorkspacePresets";
import { useEmailGenerator } from "@/hooks/useEmailGenerator";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import QualitySelector, { type EmailQuality } from "@/components/workspace/QualitySelector";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Sparkles, Search, Zap, Trash2, Square, Globe, Building2, Users } from "lucide-react";
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
  const [sourceTab, setSourceTab] = useState<"partner" | "prospect" | "contact">("partner");
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);
  const [goal, setGoal] = useState("");
  const [baseProposal, setBaseProposal] = useState("");
  const [referenceLinks, setReferenceLinks] = useState<string[]>([]);
  const [search, setSearch] = useState("");
  const [activePresetId, setActivePresetId] = useState<string | null>(null);
  const [quality, setQuality] = useState<EmailQuality>("standard");
  const { documents, uploading, upload, remove } = useWorkspaceDocuments();
  const { presets, save: savePreset, remove: removePreset } = useWorkspacePresets();

  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [filteredIds, setFilteredIds] = useState<string[]>([]);
  const [generatedEmails, setGeneratedEmails] = useState<Map<string, StoredEmail>>(new Map());
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  const queryClient = useQueryClient();
  const deepSearch = useDeepSearch();
  const { data: activities } = useAllActivities();
  const { generate } = useEmailGenerator();
  const deleteActivities = useDeleteActivities();

  const emailActivities = useMemo(() =>
    (activities || []).filter(
      (a) => a.activity_type === "send_email" && a.status !== "completed" && a.status !== "cancelled" && a.source_type === sourceTab
    ), [activities, sourceTab]);

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
  const handleSelectAll = useCallback((ids: string[]) => setSelectedIds(new Set(ids)), []);
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
    const targets = selectedIds.size > 0 ? emailActivities.filter((a) => selectedIds.has(a.id)) : emailActivities.filter((a) => filteredIds.includes(a.id));

    if (sourceTab === "contact") {
      // For contacts, use source_id (which points to imported_contacts)
      const contactIds = [...new Set(targets.map((a) => a.source_id).filter(Boolean))] as string[];
      if (!contactIds.length) {
        toast({ title: "Nessun contatto trovato per la Deep Search", variant: "destructive" });
        return;
      }
      deepSearch.start(contactIds, false, "contact");
    } else {
      const uniquePartnerIds = [...new Set(targets.map((a) => a.partner_id).filter(Boolean))] as string[];
      if (!uniquePartnerIds.length) {
        toast({ title: "Deep Search disponibile solo per partner WCA", variant: "destructive" });
        return;
      }
      deepSearch.start(uniquePartnerIds);
    }
  };

  const handleGenerateAll = async () => {
    const targets = selectedIds.size > 0
      ? emailActivities.filter((a) => selectedIds.has(a.id))
      : emailActivities.filter((a) => filteredIds.includes(a.id));
    
    // Filter: must have email
    const withEmail = targets.filter(a => a.selected_contact?.email || a.partners?.email);
    const skippedEmail = targets.length - withEmail.length;
    
    // Filter: partner-source must have selected_contact_id
    const withContact = withEmail.filter(a => a.source_type !== "partner" || !!a.selected_contact_id);
    const skippedContact = withEmail.length - withContact.length;
    
    if (skippedEmail > 0) {
      toast({ title: `${skippedEmail} esclusi`, description: "Nessun indirizzo email disponibile" });
    }
    if (skippedContact > 0) {
      toast({ title: `${skippedContact} esclusi`, description: "Nessun contatto selezionato" });
    }
    
    const toGenerate = withContact.slice(0, 20);
    if (toGenerate.length === 0) return;
    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: toGenerate.length });
    let generated = 0;
    let failed = 0;
    for (const activity of toGenerate) {
      setBatchProgress({ current: generated + failed + 1, total: toGenerate.length });
      try {
        const result = await generate({ activity_id: activity.id, goal, base_proposal: baseProposal, document_ids: documents.map((d) => d.id), reference_urls: referenceLinks, quality });
        if (result) {
          handleEmailGenerated(activity.id, { subject: result.subject, body: result.body, contactEmail: result.contact_email, partnerName: result.partner_name, contactName: result.contact_name, activityId: activity.id });
          generated++;
        } else {
          failed++;
        }
      } catch {
        failed++;
      }
      if (generated + failed < toGenerate.length) await new Promise((r) => setTimeout(r, 500));
    }
    setBatchGenerating(false);
    setBatchProgress(null);
    setCurrentEmailIndex(0);
    queryClient.invalidateQueries({ queryKey: ["sorting-jobs"] });
    queryClient.invalidateQueries({ queryKey: ["all-activities"] });
    if (generated > 0 && failed === 0) {
      toast({ title: `${generated} email generate con successo` });
    } else if (generated > 0) {
      toast({ title: `${generated} email generate, ${failed} fallite`, variant: "destructive" });
    } else {
      toast({ title: `Generazione fallita per tutte le ${failed} email`, variant: "destructive" });
    }
  };

  const emailKeys = Array.from(generatedEmails.keys());
  const handleIndexChange = (idx: number) => {
    setCurrentEmailIndex(idx);
    const activityId = emailKeys[idx];
    if (activityId) { const act = emailActivities.find((a) => a.id === activityId); if (act) setSelectedActivity(act); }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex h-[calc(100vh-3rem)] overflow-hidden bg-background">
      {/* Left: Contact list */}
      <div className="w-[320px] shrink-0 border-r border-border bg-background overflow-hidden flex flex-col">
        {/* Source tabs */}
        <div className="px-2 pt-2 pb-1 border-b border-border shrink-0">
          <Tabs value={sourceTab} onValueChange={(v) => { setSourceTab(v as any); setSelectedActivity(null); setSelectedIds(new Set()); }}>
            <TabsList className="w-full h-8">
              <TabsTrigger value="partner" className="flex-1 text-[11px] gap-1 h-7">
                <Globe className="w-3 h-3" /> WCA
              </TabsTrigger>
              <TabsTrigger value="prospect" className="flex-1 text-[11px] gap-1 h-7">
                <Building2 className="w-3 h-3" /> Prospect
              </TabsTrigger>
              <TabsTrigger value="contact" className="flex-1 text-[11px] gap-1 h-7">
                <Users className="w-3 h-3" /> Contatti
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
        <div className="h-[42px] flex items-center gap-2.5 px-3 border-b border-border shrink-0">
          <Sparkles className="w-3.5 h-3.5 text-primary" />
          <span className="text-xs font-semibold text-foreground">
            {sourceTab === "partner" ? "WCA Partners" : sourceTab === "prospect" ? "Prospect RA" : "Contatti Import"}
          </span>
          <span className="bg-primary/10 text-primary text-xs font-mono px-2 py-0.5 rounded-full">
            {emailActivities.length}
          </span>
          <div className="flex-1" />
          <div className="relative">
            <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search} onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca..."
              className="pl-7 h-7 w-32 text-xs bg-muted/50 border-border placeholder:text-muted-foreground/50 focus:border-primary/50 focus:ring-0 rounded-md"
            />
          </div>
        </div>
        <ContactListPanel
          selectedActivityId={selectedActivity?.id || null}
          onSelect={setSelectedActivity}
          search={search}
          sourceType={sourceTab}
          selectedIds={selectedIds}
          onToggleSelect={handleToggleSelect}
          onSelectAll={handleSelectAll}
          onDeselectAll={handleDeselectAll}
          onFilteredIdsChange={setFilteredIds}
        />
      </div>

      {/* Right: Config + Canvas */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top action bar */}
        <div className="px-4 h-10 flex items-center gap-2 border-b border-border bg-background shrink-0 relative">
          {deepSearch.running && deepSearch.current && (
            <div className="flex items-center gap-2 mr-1">
              <span className="text-[11px] text-primary font-medium whitespace-nowrap">
                Deep Search {deepSearch.current.index}/{deepSearch.current.total}
              </span>
              <Progress value={(deepSearch.current.index / deepSearch.current.total) * 100} className="w-20 h-1.5" />
            </div>
          )}
          <div className="flex-1" />
          <QualitySelector value={quality} onChange={setQuality} disabled={batchGenerating || deepSearch.running} />

          {deepSearch.running ? (
            <Button onClick={() => deepSearch.stop()} size="sm" variant="destructive" className="h-7 gap-1.5 text-xs">
              <Square className="w-3.5 h-3.5" /> Stop
            </Button>
          ) : (
            <Button onClick={handleDeepSearch} disabled={batchGenerating || emailActivities.length === 0} size="sm" variant="outline" className="h-7 gap-1.5 text-xs">
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

          <Button onClick={handleGenerateAll} disabled={batchGenerating || deepSearch.running || emailActivities.length === 0} size="sm" className="h-7 gap-1.5 text-xs bg-primary hover:bg-primary/90 text-primary-foreground">
            <Zap className="w-3.5 h-3.5" />
            {selectedCount > 0 ? `Genera (${selectedCount})` : "Genera Tutte"}
          </Button>

          {/* Progress shimmer bar */}
          {(batchGenerating || deepSearch.running) && (
            <div
              className="progress-shimmer-bar"
              style={{
                width: batchProgress
                  ? `${(batchProgress.current / batchProgress.total) * 100}%`
                  : deepSearch.current
                    ? `${(deepSearch.current.index / deepSearch.current.total) * 100}%`
                    : '30%',
              }}
            />
          )}
          {!batchGenerating && !deepSearch.running && batchProgress === null && generatedEmails.size > 0 && (
            <div className="progress-shimmer-bar fade-out" style={{ width: '100%' }} />
          )}
        </div>

        {/* GoalBar */}
        <div className="px-4 py-2.5 border-b border-border shrink-0">
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

        {/* Email Canvas */}
        <div className="flex-1 overflow-hidden">
          <EmailCanvas
            activity={selectedActivity} goal={goal} baseProposal={baseProposal}
            documentIds={documents.map((d) => d.id)} referenceUrls={referenceLinks}
            generatedEmails={generatedEmails} onEmailGenerated={handleEmailGenerated}
            currentEmailIndex={currentEmailIndex} onIndexChange={handleIndexChange}
            totalEmails={emailKeys.length} batchGenerating={batchGenerating} batchProgress={batchProgress}
            quality={quality}
          />
        </div>
      </div>
    </div>
  );
}
