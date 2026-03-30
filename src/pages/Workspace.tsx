import { useState, useCallback, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import ContactListPanel from "@/components/workspace/ContactListPanel";
import EmailCanvas from "@/components/workspace/EmailCanvas";
import { type AllActivity, useAllActivities, useDeleteActivities } from "@/hooks/useActivities";
import { useEmailGenerator } from "@/hooks/useEmailGenerator";
import { useDeepSearch } from "@/hooks/useDeepSearchRunner";
import { useMission } from "@/contexts/MissionContext";
import QualitySelector, { type EmailQuality } from "@/components/workspace/QualitySelector";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Sparkles, Search, Zap, Trash2, Square, Globe, Building2, Users, Mail } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { toast } from "@/hooks/use-toast";
import { cn } from "@/lib/utils";
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

const SOURCE_TABS = [
  { key: "partner" as const, icon: Globe, label: "WCA Partners", shortLabel: "WCA" },
  { key: "prospect" as const, icon: Building2, label: "Prospect RA", shortLabel: "Prospect" },
  { key: "contact" as const, icon: Users, label: "Contatti Import", shortLabel: "Contatti" },
];

export default function Workspace() {
  const { goal, baseProposal, documents, referenceLinks } = useMission();
  const [sourceTab, setSourceTab] = useState<"partner" | "prospect" | "contact">("partner");
  const [selectedActivity, setSelectedActivity] = useState<AllActivity | null>(null);
  const [search, setSearch] = useState("");
  const [quality, setQuality] = useState<EmailQuality>("standard");

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

  const activeSourceLabel = SOURCE_TABS.find(t => t.key === sourceTab)?.label ?? "";

  // (Preset handlers now in MissionContext)

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
    
    const withEmail = targets.filter(a => a.selected_contact?.email || a.partners?.email);
    const skippedEmail = targets.length - withEmail.length;
    
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
    <TooltipProvider delayDuration={200}>
    <div className="h-[calc(100vh-3.25rem)] relative overflow-hidden flex flex-col">
      {/* ═══ TOP ACTION BAR — same style as UnifiedActionBar ═══ */}
      <div className="h-10 flex items-center gap-2 px-4 border-b border-border/30 bg-background shrink-0 relative">
        <Mail className="w-4 h-4 text-primary" />
        <span className="text-xs font-semibold text-foreground">{activeSourceLabel}</span>
        <span className="bg-primary/10 text-primary text-xs font-mono px-2 py-0.5 rounded-full">
          {emailActivities.length}
        </span>

        {deepSearch.running && deepSearch.current && (
          <div className="flex items-center gap-2 ml-2">
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

      {/* ═══ RESIZABLE PANELS ═══ */}
      <ResizablePanelGroup direction="horizontal" className="flex-1 min-h-0">
        <ResizablePanel defaultSize={30} minSize={20} maxSize={45}>
          {/* ═══ LEFT PANEL ═══ */}
          <div className="h-full flex flex-col border-r border-border bg-background">
            {/* Source tabs — icon toggle bar like Rubrica */}
            <div className="h-[52px] flex items-center gap-3 px-4 border-b border-border/30 bg-background shrink-0">
              <div className="flex items-center gap-0.5 rounded-lg border border-border/40 p-0.5 shrink-0">
                {SOURCE_TABS.map((tab) => (
                  <Tooltip key={tab.key}>
                    <TooltipTrigger asChild>
                      <button
                        onClick={() => { setSourceTab(tab.key); setSelectedActivity(null); setSelectedIds(new Set()); }}
                        className={cn(
                          "flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md transition-all font-medium",
                          sourceTab === tab.key
                            ? "bg-accent text-accent-foreground"
                            : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                        )}
                      >
                        <tab.icon className="w-3.5 h-3.5 shrink-0" />
                        <span className="hidden sm:inline">{tab.shortLabel}</span>
                      </button>
                    </TooltipTrigger>
                    <TooltipContent side="bottom" className="text-xs">{tab.label}</TooltipContent>
                  </Tooltip>
                ))}
              </div>

            </div>

            {/* Contact list */}
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
        </ResizablePanel>

        <ResizableHandle withHandle />

        <ResizablePanel defaultSize={70} minSize={40}>
          {/* ═══ RIGHT PANEL: Config + Canvas ═══ */}
          <div className="h-full flex flex-col min-w-0 overflow-hidden">
            {/* Email Canvas (Mission Context è nel pannello globale) */}

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
        </ResizablePanel>
      </ResizablePanelGroup>
    </div>
    </TooltipProvider>
  );
}
