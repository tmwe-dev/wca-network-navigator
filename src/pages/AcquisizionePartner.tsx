import { Play, Pause, Square, AlertTriangle, Plug, Mail, Phone, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { AcquisitionToolbar } from "@/components/acquisition/AcquisitionToolbar";
import { PartnerQueue } from "@/components/acquisition/PartnerQueue";
import { PartnerCanvas } from "@/components/acquisition/PartnerCanvas";
import { AcquisitionBin } from "@/components/acquisition/AcquisitionBin";
import { NetworkPerformanceBar } from "@/components/acquisition/NetworkPerformanceBar";
import { useAcquisitionPipeline } from "@/hooks/useAcquisitionPipeline";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogAction,
} from "@/components/ui/alert-dialog";

export default function AcquisizionePartner() {
  const pipeline = useAcquisitionPipeline();

  const {
    selectedCountries, setSelectedCountries,
    selectedNetworks, setSelectedNetworks,
    delaySeconds, setDelaySeconds,
    includeEnrich, setIncludeEnrich,
    includeDeepSearch, setIncludeDeepSearch,
    pipelineStatus,
    queue,
    activeIndex,
    canvasData, canvasPhase,
    isAnimatingOut,
    completedCount, qualityComplete, qualityIncomplete,
    showComet,
    showSessionAlert, setShowSessionAlert,
    selectedIds, setSelectedIds,
    liveStats,
    networkStats, excludedNetworks,
    networkRegressions,
    scanStats,
    sessionHealth, extensionAvailable,
    handleScan, startPipeline,
    handleExcludeNetwork, handleReincludeNetwork,
    handlePartnerClick,
    togglePause, cancelPipeline,
    pauseRef,
  } = pipeline;

  return (
    <div className="flex flex-col h-[calc(100vh-4rem)] gap-3 -m-6 relative overflow-hidden">
      {/* Ambient gradient backgrounds */}
      <div className="absolute inset-0 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 dark:block hidden" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-violet-500/[0.06] via-transparent to-transparent dark:block hidden" />
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_bottom_left,_var(--tw-gradient-stops))] from-sky-500/[0.05] via-transparent to-transparent dark:block hidden animate-pulse" style={{ animationDuration: '8s' }} />
      <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-white to-violet-50/30 dark:hidden" />

      <div className="relative z-10 flex flex-col h-full gap-2 p-3">
      {/* TWO-COLUMN LAYOUT */}
      <div className="flex-1 grid grid-cols-[35%_1fr] gap-3 min-h-0">
        {/* LEFT COLUMN: Controls + Queue */}
        <div className="flex flex-col gap-2 min-h-0">
          {/* Toolbar */}
          <div className="p-3 bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 rounded-2xl shadow-lg shadow-black/[0.05]">
            <AcquisitionToolbar
              selectedCountries={selectedCountries}
              onCountriesChange={setSelectedCountries}
              selectedNetworks={selectedNetworks}
              onNetworksChange={setSelectedNetworks}
              delaySeconds={delaySeconds}
              onDelayChange={setDelaySeconds}
              includeEnrich={includeEnrich}
              onIncludeEnrichChange={setIncludeEnrich}
              includeDeepSearch={includeDeepSearch}
              onIncludeDeepSearchChange={setIncludeDeepSearch}
            />

            {/* Scan + Extension + Session */}
            <div className="flex flex-wrap items-center gap-2 mt-2">
              <Button
                onClick={handleScan}
                disabled={selectedCountries.length === 0 || pipelineStatus === "scanning" || pipelineStatus === "running"}
                variant="outline"
                size="sm"
                className="text-xs"
              >
                {pipelineStatus === "scanning" ? "Scansione..." : "Scansiona"}
              </Button>

              <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${extensionAvailable ? 'bg-emerald-500/10 text-emerald-500' : 'bg-muted text-muted-foreground'}`}>
                <Plug className="w-3 h-3" />
                <span>{extensionAvailable ? "Ext ✓" : "Ext ✗"}</span>
              </div>

              {(pipelineStatus === "running" || pipelineStatus === "paused") && (
                <div className={`flex items-center gap-1 text-[10px] px-1.5 py-0.5 rounded ${
                  sessionHealth === "active" ? "bg-emerald-500/10 text-emerald-500" :
                  sessionHealth === "dead" ? "bg-destructive/10 text-destructive" :
                  "bg-muted text-muted-foreground"
                }`}>
                  <span className={`w-1.5 h-1.5 rounded-full ${
                    sessionHealth === "active" ? "bg-emerald-500" :
                    sessionHealth === "checking" || sessionHealth === "recovering" ? "bg-amber-500 animate-pulse" :
                    sessionHealth === "dead" ? "bg-destructive" : "bg-muted-foreground"
                  }`} />
                  <span>{
                    sessionHealth === "active" ? "WCA ✓" :
                    sessionHealth === "checking" ? "Verifica..." :
                    sessionHealth === "recovering" ? "Ripristino..." :
                    sessionHealth === "dead" ? "Sessione ✗" : "WCA ?"
                  }</span>
                </div>
              )}
            </div>

            {/* Scan stats */}
            {scanStats && (
              <div className="flex items-center gap-3 mt-1.5 text-[10px] text-muted-foreground">
                <span>Trovati: <strong className="text-foreground">{scanStats.total}</strong></span>
                <span>Già: <strong className="text-emerald-500">{scanStats.existing}</strong></span>
                <span>Nuovi: <strong className="text-primary">{scanStats.missing}</strong></span>
              </div>
            )}
          </div>

          {/* Live Stats */}
          {(pipelineStatus === "running" || pipelineStatus === "paused" || pipelineStatus === "done") && liveStats.processed > 0 && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 px-3 py-2 rounded-xl bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 text-[10px]">
              <div className="flex items-center gap-1 text-muted-foreground">
                <strong className="text-foreground">{liveStats.processed}/{queue.filter(q => selectedIds.has(q.wca_id)).length}</strong>
              </div>
              <div className="h-1.5 flex-1 min-w-[60px] max-w-[120px] bg-muted rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all duration-500"
                  style={{ width: `${(liveStats.processed / Math.max(queue.filter(q => selectedIds.has(q.wca_id)).length, 1)) * 100}%` }}
                />
              </div>
              <span className="text-sky-500 flex items-center gap-0.5"><Mail className="w-3 h-3" />{liveStats.withEmail}</span>
              <span className="text-violet-500 flex items-center gap-0.5"><Phone className="w-3 h-3" />{liveStats.withPhone}</span>
              <span className="text-emerald-500 flex items-center gap-0.5"><CheckCircle2 className="w-3 h-3" />{liveStats.complete}</span>
              {liveStats.empty > 0 && <span className="text-destructive flex items-center gap-0.5"><XCircle className="w-3 h-3" />{liveStats.empty}</span>}
              {liveStats.failedLoads > 0 && <span className="text-amber-500 flex items-center gap-0.5"><AlertTriangle className="w-3 h-3" />{liveStats.failedLoads}</span>}
            </div>
          )}

          {/* Network Performance */}
          {Object.keys(networkStats).length > 0 && (
            <div className="px-3 py-1.5 rounded-xl bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60">
              <NetworkPerformanceBar
                stats={networkStats}
                excludedNetworks={excludedNetworks}
                onExclude={handleExcludeNetwork}
                onReinclude={handleReincludeNetwork}
                regressions={networkRegressions}
              />
            </div>
          )}

          {/* Partner Queue */}
          <div className="flex-1 flex flex-col bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 rounded-2xl overflow-hidden shadow-lg shadow-black/[0.05] min-h-0">
            <PartnerQueue
              items={queue}
              activeIndex={activeIndex}
              selectedIds={selectedIds}
              onToggle={(wcaId) => {
                setSelectedIds((prev) => {
                  const next = new Set(prev);
                  if (next.has(wcaId)) next.delete(wcaId);
                  else next.add(wcaId);
                  return next;
                });
              }}
              onSelectAll={() => setSelectedIds(new Set(queue.map((q) => q.wca_id)))}
              onDeselectAll={() => setSelectedIds(new Set())}
              onPartnerClick={handlePartnerClick}
            />
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-2">
            {queue.length > 0 && pipelineStatus !== "running" && selectedIds.size > 0 && (
              <Button onClick={startPipeline} size="sm" className="flex-1 gap-1.5 text-xs">
                <Play className="w-3.5 h-3.5" />
                Avvia ({selectedIds.size})
              </Button>
            )}
            {pipelineStatus === "running" && (
              <>
                <Button variant="outline" size="sm" className="flex-1 text-xs" onClick={togglePause}>
                  {pauseRef.current ? <><Play className="w-3.5 h-3.5 mr-1" /> Riprendi</> : <><Pause className="w-3.5 h-3.5 mr-1" /> Pausa</>}
                </Button>
                <Button variant="destructive" size="sm" className="text-xs" onClick={cancelPipeline}>
                  <Square className="w-3.5 h-3.5 mr-1" /> Stop
                </Button>
              </>
            )}
          </div>
        </div>

        {/* RIGHT COLUMN: Canvas */}
        <div className="flex flex-col gap-2 min-h-0">
          <div className="flex-1 flex flex-col bg-white/[0.04] dark:bg-white/[0.04] bg-white/60 backdrop-blur-xl border border-white/[0.08] dark:border-white/[0.08] border-slate-200/60 rounded-2xl overflow-hidden shadow-lg shadow-black/[0.05]">
            <PartnerCanvas
              data={canvasData}
              phase={canvasPhase}
              isAnimatingOut={isAnimatingOut}
            />
          </div>
        </div>
      </div>

      {/* BOTTOM: Acquisition Bin */}
      <div className="flex justify-center">
        <AcquisitionBin
          count={completedCount}
          total={queue.filter((q) => selectedIds.has(q.wca_id)).length}
          showComet={showComet}
          completeCount={qualityComplete}
          incompleteCount={qualityIncomplete}
        />
      </div>

      {/* WCA Session Alert */}
      <AlertDialog open={showSessionAlert} onOpenChange={setShowSessionAlert}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-destructive" />
              Sessione WCA Non Attiva
            </AlertDialogTitle>
            <AlertDialogDescription>
              La sessione WCA non è attiva o è scaduta. Per scaricare i dati completi (email, telefoni) è necessario
              avere una sessione autenticata. Vai nelle Impostazioni per aggiornare il cookie di sessione.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogAction onClick={() => setShowSessionAlert(false)}>
              Ho capito
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      </div>
    </div>
  );
}
