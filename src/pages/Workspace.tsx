import { useState, useCallback, useMemo, useRef } from "react";
import GoalBar from "@/components/workspace/GoalBar";
import ContactListPanel from "@/components/workspace/ContactListPanel";
import EmailCanvas from "@/components/workspace/EmailCanvas";
import { type AllActivity, useAllActivities, useDeleteActivities } from "@/hooks/useActivities";
import { useWorkspaceDocuments } from "@/hooks/useWorkspaceDocuments";
import { useEmailGenerator } from "@/hooks/useEmailGenerator";
import { supabase } from "@/integrations/supabase/client";
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
  const { documents, uploading, upload, remove } = useWorkspaceDocuments();

  // Multi-select
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Batch email state
  const [generatedEmails, setGeneratedEmails] = useState<Map<string, StoredEmail>>(new Map());
  const [currentEmailIndex, setCurrentEmailIndex] = useState(0);
  const [batchGenerating, setBatchGenerating] = useState(false);
  const [batchProgress, setBatchProgress] = useState<{ current: number; total: number } | null>(null);

  // Deep search state
  const [deepSearching, setDeepSearching] = useState(false);
  const [deepSearchProgress, setDeepSearchProgress] = useState<{ current: number; total: number } | null>(null);
  const deepSearchAbortRef = useRef(false);

  const { data: activities } = useAllActivities();
  const { generate } = useEmailGenerator();
  const deleteActivities = useDeleteActivities();

  const emailActivities = useMemo(() =>
    (activities || []).filter(
      (a) => a.activity_type === "send_email" && a.status !== "completed"
    ), [activities]);

  const handleToggleSelect = useCallback((id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  const handleSelectAll = useCallback(() => {
    setSelectedIds(new Set(emailActivities.map((a) => a.id)));
  }, [emailActivities]);

  const handleDeselectAll = useCallback(() => {
    setSelectedIds(new Set());
  }, []);

  const handleEmailGenerated = useCallback((activityId: string, email: StoredEmail) => {
    setGeneratedEmails((prev) => {
      const next = new Map(prev);
      next.set(activityId, email);
      return next;
    });
  }, []);

  // ── Delete ──
  const handleDelete = async () => {
    const ids = Array.from(selectedIds);
    if (!ids.length) return;
    try {
      await deleteActivities.mutateAsync(ids);
      if (selectedActivity && selectedIds.has(selectedActivity.id)) {
        setSelectedActivity(null);
      }
      setSelectedIds(new Set());
      toast({ title: `${ids.length} attività eliminate` });
    } catch {
      toast({ title: "Errore durante l'eliminazione", variant: "destructive" });
    }
  };

  // ── Deep Search ──
  const handleDeepSearch = async () => {
    const targets = selectedIds.size > 0
      ? emailActivities.filter((a) => selectedIds.has(a.id))
      : emailActivities;
    const uniquePartnerIds = [...new Set(targets.map((a) => a.partner_id))];
    if (!uniquePartnerIds.length) return;

    deepSearchAbortRef.current = false;
    setDeepSearching(true);
    setDeepSearchProgress({ current: 0, total: uniquePartnerIds.length });

    let done = 0;
    for (const partnerId of uniquePartnerIds) {
      if (deepSearchAbortRef.current) break;
      setDeepSearchProgress({ current: done + 1, total: uniquePartnerIds.length });
      try {
        await supabase.functions.invoke("deep-search-partner", {
          body: { partner_id: partnerId },
        });
      } catch {
        // continue
      }
      done++;
      if (done < uniquePartnerIds.length && !deepSearchAbortRef.current) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setDeepSearching(false);
    setDeepSearchProgress(null);
    if (deepSearchAbortRef.current) {
      toast({ title: `Deep Search interrotta (${done}/${uniquePartnerIds.length})` });
    } else {
      toast({ title: `Deep Search completata su ${done} partner` });
    }
  };

  const handleGenerateAll = async () => {
    const targets = selectedIds.size > 0
      ? emailActivities.filter((a) => selectedIds.has(a.id))
      : emailActivities;
    const toGenerate = targets.slice(0, 20);
    if (toGenerate.length === 0) return;

    setBatchGenerating(true);
    setBatchProgress({ current: 0, total: toGenerate.length });

    let generated = 0;
    for (const activity of toGenerate) {
      setBatchProgress({ current: generated + 1, total: toGenerate.length });
      try {
        const result = await generate({
          activity_id: activity.id,
          goal,
          base_proposal: baseProposal,
          document_ids: documents.map((d) => d.id),
          reference_urls: referenceLinks,
        });
        if (result) {
          const stored: StoredEmail = {
            subject: result.subject,
            body: result.body,
            contactEmail: result.contact_email,
            partnerName: result.partner_name,
            contactName: result.contact_name,
            activityId: activity.id,
          };
          handleEmailGenerated(activity.id, stored);
        }
      } catch {
        // continue batch
      }
      generated++;
      if (generated < toGenerate.length) {
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    setBatchGenerating(false);
    setBatchProgress(null);
    setCurrentEmailIndex(0);
    toast({ title: `${generated} email generate con successo` });
  };

  // Navigate emails by index through the Map
  const emailKeys = Array.from(generatedEmails.keys());
  const handleIndexChange = (idx: number) => {
    setCurrentEmailIndex(idx);
    const activityId = emailKeys[idx];
    if (activityId) {
      const act = emailActivities.find((a) => a.id === activityId);
      if (act) setSelectedActivity(act);
    }
  };

  const selectedCount = selectedIds.size;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] overflow-hidden bg-stone-50/80">
      {/* Header */}
      <div className="px-5 pt-3 pb-2 flex items-center justify-between">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-violet-100 flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-violet-500" />
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-stone-800">Email Workspace</h1>
            <p className="text-[11px] text-stone-400">
              Genera email personalizzate con AI
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Deep Search progress */}
          {deepSearching && deepSearchProgress && (
            <div className="flex items-center gap-2 mr-1">
              <span className="text-[11px] text-violet-600 font-medium whitespace-nowrap">
                Deep Search {deepSearchProgress.current}/{deepSearchProgress.total}
              </span>
              <Progress
                value={(deepSearchProgress.current / deepSearchProgress.total) * 100}
                className="w-20 h-1.5"
              />
            </div>
          )}
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca partner..."
              className="pl-8 h-8 w-52 text-xs bg-white/80 border-stone-200 text-stone-600 placeholder:text-stone-400 focus:ring-violet-300/50"
            />
          </div>

          {/* Deep Search / Stop */}
          {deepSearching ? (
            <Button
              onClick={() => { deepSearchAbortRef.current = true; }}
              size="sm"
              variant="destructive"
              className="h-8 gap-1.5 text-xs shadow-sm"
            >
              <Square className="w-3.5 h-3.5" />
              Stop
            </Button>
          ) : (
            <Button
              onClick={handleDeepSearch}
              disabled={batchGenerating || emailActivities.length === 0}
              size="sm"
              variant="outline"
              className="h-8 gap-1.5 text-xs border-violet-200 text-violet-600 hover:bg-violet-50 shadow-sm"
            >
              <Sparkles className="w-3.5 h-3.5" />
              {selectedCount > 0 ? `Deep Search (${selectedCount})` : "Deep Search"}
            </Button>
          )}

          {/* Delete */}
          {selectedCount > 0 && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  size="sm"
                  variant="destructive"
                  className="h-8 gap-1.5 text-xs shadow-sm"
                  disabled={deleteActivities.isPending}
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Elimina ({selectedCount})
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Eliminare {selectedCount} attività?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Le attività selezionate verranno eliminate definitivamente.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annulla</AlertDialogCancel>
                  <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
                    Elimina
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}

          <Button
            onClick={handleGenerateAll}
            disabled={batchGenerating || deepSearching || emailActivities.length === 0}
            size="sm"
            className="h-8 gap-1.5 bg-violet-500 hover:bg-violet-600 text-white text-xs shadow-sm"
          >
            <Zap className="w-3.5 h-3.5" />
            {selectedCount > 0 ? `Genera (${selectedCount})` : "Genera Tutte"}
          </Button>
        </div>
      </div>

      {/* Tabs bar */}
      <div className="px-5 pb-2">
        <GoalBar
          goal={goal}
          baseProposal={baseProposal}
          onGoalChange={setGoal}
          onBaseProposalChange={setBaseProposal}
          documents={documents}
          onUploadDocument={upload}
          onRemoveDocument={remove}
          uploading={uploading}
          referenceLinks={referenceLinks}
          onAddLink={(url) => setReferenceLinks((prev) => [...prev, url])}
          onRemoveLink={(idx) => setReferenceLinks((prev) => prev.filter((_, i) => i !== idx))}
        />
      </div>

      {/* Split panel */}
      <div className="flex-1 flex overflow-hidden px-5 pb-4 gap-3">
        {/* Left: Contact list */}
        <div className="w-[320px] shrink-0 rounded-xl border border-stone-200/60 bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col shadow-sm">
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

        {/* Right: Email canvas */}
        <div className="flex-1 rounded-xl border border-stone-200/60 bg-white/80 backdrop-blur-sm overflow-hidden flex flex-col shadow-sm">
          <EmailCanvas
            activity={selectedActivity}
            goal={goal}
            baseProposal={baseProposal}
            documentIds={documents.map((d) => d.id)}
            referenceUrls={referenceLinks}
            generatedEmails={generatedEmails}
            onEmailGenerated={handleEmailGenerated}
            currentEmailIndex={currentEmailIndex}
            onIndexChange={handleIndexChange}
            totalEmails={emailKeys.length}
            batchGenerating={batchGenerating}
            batchProgress={batchProgress}
          />
        </div>
      </div>
    </div>
  );
}
