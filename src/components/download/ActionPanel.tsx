import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Slider } from "@/components/ui/slider";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Switch } from "@/components/ui/switch";
import { Loader2, Timer, Zap, ChevronDown, RefreshCw, Square, FolderDown } from "lucide-react";
import { WCA_NETWORKS } from "@/data/wcaFilters";
import { getCountryFlag } from "@/lib/countries";
import { useTheme, t } from "./theme";
import { useActionPanelLogic } from "@/hooks/useActionPanelLogic";

interface ActionPanelProps {
  selectedCountries: { code: string; name: string }[];
  directoryOnly?: boolean;
  onDirectoryOnlyChange?: (v: boolean) => void;
  onJobCreated?: (jobId: string) => void;
}

export function ActionPanel({ selectedCountries, directoryOnly: directoryOnlyProp, onDirectoryOnlyChange, onJobCreated }: ActionPanelProps) {
  const isDark = useTheme();
  const th = t(isDark);
  const [selectedNetwork, setSelectedNetwork] = useState<string>("__all__");
  const networks = selectedNetwork === "__all__" ? [] : [selectedNetwork];
  const networkKeys = networks.length > 0 ? networks : [""];
  const [delay, setDelay] = useState(15);
  const directoryOnly = directoryOnlyProp ?? false;
  const setDirectoryOnly = onDirectoryOnlyChange ?? (() => {});

  const logic = useActionPanelLogic({
    selectedCountries, networks, networkKeys, delay, directoryOnly, onJobCreated,
  });

  if (selectedCountries.length === 0) {
    return (
      <div className={`${th.panel} border ${th.panelSlate} rounded-2xl p-6 text-center`}>
        <p className={`text-sm ${th.sub}`}>← Seleziona uno o più paesi per iniziare</p>
      </div>
    );
  }

  if (logic.isLoading) {
    return (
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6 flex items-center justify-center`}>
        <Loader2 className={`w-5 h-5 animate-spin ${th.sub}`} />
        <span className={`ml-2 text-sm ${th.sub}`}>Caricamento...</span>
      </div>
    );
  }

  if (logic.isScanning) {
    return (
      <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-6 space-y-4 text-center`}>
        <Loader2 className={`w-8 h-8 animate-spin mx-auto ${th.acAmber}`} />
        <div>
          <h3 className={`text-lg mb-1 ${th.h2}`}>Scansione directory...</h3>
          <p className={`text-sm ${th.sub}`}>
            {selectedCountries.length > 1 && `Paese ${logic.currentCountryIdx + 1}/${selectedCountries.length}: `}
            {selectedCountries[logic.currentCountryIdx]?.name} — Pagina {logic.currentPage}
          </p>
          {logic.scannedMembers.length > 0 && (
            <p className={`text-lg font-mono mt-2 ${th.hi}`}>{logic.scannedMembers.length} partner trovati</p>
          )}
        </div>
        {logic.scanError && (
          <div className="p-3 rounded-lg border text-sm text-left bg-destructive/10 border-destructive/30 text-destructive">
            ⚠️ {logic.scanError}
          </div>
        )}
        <Button variant="ghost" onClick={logic.abortScan} className={th.btnStop}>
          <Square className="w-4 h-4 mr-1" /> Interrompi
        </Button>
      </div>
    );
  }

  const countryLabel = selectedCountries.length === 1
    ? `${getCountryFlag(selectedCountries[0].code)} ${selectedCountries[0].name}`
    : `${selectedCountries.length} paesi`;

  return (
    <div className={`${th.panel} border ${th.panelAmber} rounded-2xl p-5 space-y-4`}>
      <div>
        <div className="flex items-center justify-between">
          <h3 className={`text-lg font-semibold ${th.h2}`}>Scarica Partner</h3>
          <label className={`flex items-center gap-2 text-xs cursor-pointer ${th.body}`}>
            <Switch checked={directoryOnly} onCheckedChange={v => setDirectoryOnly(v)} />
            <span className="flex items-center gap-1"><FolderDown className="w-3.5 h-3.5" /> Solo Directory</span>
          </label>
        </div>
        <p className={`text-sm ${th.sub}`}>{countryLabel}</p>
        {directoryOnly && (
          <div className="p-2 rounded-lg border text-xs bg-muted border-border text-muted-foreground">
            💡 Scarica solo l'elenco aziende dalla directory WCA senza aprire i singoli profili
          </div>
        )}
      </div>

      <div>
        <label className={`text-xs mb-1.5 block ${th.label}`}>Network</label>
        <Select value={selectedNetwork} onValueChange={setSelectedNetwork}>
          <SelectTrigger className={th.selTrigger}><SelectValue /></SelectTrigger>
          <SelectContent className={th.selContent}>
            <SelectItem value="__all__">Tutti i network</SelectItem>
            {WCA_NETWORKS.map(n => <SelectItem key={n} value={n}>{n}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {/* Stats box */}
      <div className={`p-3 rounded-xl border space-y-1 ${th.infoBox}`}>
        <div onClick={() => !directoryOnly && logic.setDownloadMode("all")}
          className={`flex items-center justify-between px-2 py-1.5 rounded-lg transition-all ${!directoryOnly ? "cursor-pointer hover:opacity-80" : ""} ${
            !directoryOnly && logic.downloadMode === "all" ? "bg-primary/15 border-l-2 border-primary" : ""
          }`}>
          <span className={`text-sm ${th.body}`}>Nella directory</span>
          <span className={`font-mono font-bold ${th.hi}`}>{logic.totalCount}</span>
        </div>
        {!directoryOnly && (
          <>
             <div className="h-px bg-border" />
             <div className="flex items-center justify-between px-2 py-1.5">
              <span className={`text-sm font-medium ${th.acEm}`}>✓ Con profilo</span>
              <span className={`font-mono font-bold ${th.acEm}`}>{logic.downloadedCount - logic.noProfileInDirectoryCount}</span>
            </div>
            {logic.noProfileInDirectoryCount > 0 && (
              <div onClick={() => logic.setDownloadMode("no_profile")}
                 className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80 ${
                   logic.downloadMode === "no_profile" ? "bg-primary/15 border-l-2 border-primary" : ""
                 }`}>
                 <span className="text-sm font-medium text-primary">⚠ Senza profilo</span>
                 <span className="font-mono font-bold text-primary">{logic.noProfileInDirectoryCount}</span>
              </div>
            )}
            {logic.missingIds.length > 0 && (
              <div onClick={() => logic.setDownloadMode("new")}
                 className={`flex items-center justify-between px-2 py-1.5 rounded-lg cursor-pointer transition-all hover:opacity-80 ${
                   logic.downloadMode === "new" ? "bg-muted border-l-2 border-muted-foreground" : ""
                }`}>
                <span className={`text-sm font-medium ${th.hi}`}>↓ Mai scaricati</span>
                <span className={`font-mono font-bold ${th.hi}`}>{logic.missingIds.length}</span>
              </div>
            )}
          </>
        )}
      </div>

      {directoryOnly ? (
        <>
          {logic.hasCache && logic.totalCount > 0 && (
             <div className="p-3 rounded-lg border text-sm bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              ✅ Directory già scaricata: {logic.totalCount} aziende trovate
            </div>
          )}
          <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
            <Switch checked={logic.skipCachedDirs} onCheckedChange={logic.setSkipCachedDirs} /> Salta directory già scaricate
          </label>
          <label className={`flex items-center gap-2 text-sm cursor-pointer ${th.body}`}>
            <Switch checked={logic.dirThenDownload} onCheckedChange={logic.setDirThenDownload} />
            <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5" /> Scarica dopo scansione</span>
          </label>
          <Button onClick={() => { if (logic.dirThenDownload) logic.setAutoDownloadPending(true); logic.handleStartScan(); }}
            disabled={logic.isScanning} className={`w-full ${th.btnPri}`}>
            <FolderDown className="w-4 h-4 mr-2" />
            {logic.dirThenDownload
              ? (logic.hasCache ? "Aggiorna e Scarica" : "Scansiona e Scarica")
              : (logic.hasCache ? "Aggiorna Directory" : "Scarica Directory")}
          </Button>
        </>
      ) : (
        <>
          <div>
            <label className={`text-xs mb-1.5 block ${th.label}`}>Modalità download</label>
            <Select value={logic.downloadMode} onValueChange={v => logic.setDownloadMode(v as any)}>
              <SelectTrigger className={th.selTrigger}><SelectValue /></SelectTrigger>
              <SelectContent className={th.selContent}>
                <SelectItem value="new">Mai scaricati ({logic.missingIds.length})</SelectItem>
                <SelectItem value="no_profile">Senza profilo ({logic.noProfileInDirectoryCount})</SelectItem>
                <SelectItem value="all">Riscansiona tutti ({logic.totalCount})</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {logic.missingIds.length === 0 && logic.downloadMode === "new" && (
            <div className="p-3 rounded-lg border text-sm bg-emerald-500/10 border-emerald-500/30 text-emerald-400">
              ✅ Tutti scaricati! Cambia modalità per aggiornare.
            </div>
          )}

          {logic.idsToDownload.length > 0 && (
            <div>
              <label className={`text-xs flex items-center gap-1.5 mb-2 ${th.label}`}>
                <Timer className="w-3.5 h-3.5" /> Delay: <span className={`font-mono font-bold ${th.hi}`}>{delay}s</span>
              </label>
              <Slider value={[delay]} onValueChange={([v]) => setDelay(v)} min={10} max={60} step={1} />
              <div className={`flex justify-between text-xs mt-1 ${th.dim}`}><span>Veloce</span><span>Lento</span></div>
            </div>
          )}

          {logic.idsToDownload.length > 0 && (
            <div className={`p-2 rounded-lg border text-center ${th.infoBox}`}>
              <p className={`text-xs ${th.dim}`}>Tempo stimato</p>
              <p className={`text-lg font-mono ${th.hi}`}>{logic.estimateLabel}</p>
            </div>
          )}

          <Button onClick={logic.executeDownload} disabled={logic.idsToDownload.length === 0 || logic.createJob.isPending} className={`w-full ${th.btnPri}`}>
            {logic.createJob.isPending ? (
              <><Loader2 className="w-4 h-4 animate-spin mr-2" /> Avvio...</>
            ) : (
              <><Zap className="w-4 h-4 mr-2" />
                {logic.downloadMode === "new" && `Scarica ${logic.idsToDownload.length} partner (nuovi)`}
                {logic.downloadMode === "no_profile" && `Scarica ${logic.idsToDownload.length} partner (profili)`}
                {logic.downloadMode === "all" && `Riscansiona ${logic.idsToDownload.length} partner`}
              </>
            )}
          </Button>
        </>
      )}

      {logic.skippedCountries.length > 0 && (
        <Collapsible>
          <CollapsibleTrigger className={`flex items-center gap-1 text-xs ${th.dim}`}>
            <ChevronDown className="w-3 h-3" /> {logic.skippedCountries.length} paesi saltati
          </CollapsibleTrigger>
          <CollapsibleContent className={`mt-1 text-xs space-y-0.5 ${th.dim}`}>
            {logic.skippedCountries.map(s => <p key={s}>• {s}</p>)}
            <Button size="sm" variant="ghost" onClick={logic.handleStartScan} className={`h-6 text-xs mt-1 ${th.dim}`}>
              <RefreshCw className="w-3 h-3 mr-1" /> Riprova
            </Button>
          </CollapsibleContent>
        </Collapsible>
      )}

      {logic.hasCache && !logic.scanComplete && (
        <div className="text-center">
          <Button size="sm" variant="ghost" onClick={logic.handleStartScan} className={`text-xs ${th.dim}`}>
            <RefreshCw className="w-3 h-3 mr-1" /> Aggiorna scansione
          </Button>
        </div>
      )}
    </div>
  );
}
