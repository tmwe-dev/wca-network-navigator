import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Activity, Download, Play, Zap, AlertCircle, CheckCircle, Clock, Search, Pause } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ATECO_TREE } from "@/data/atecoCategories";
import { REGIONI_ITALIANE } from "@/data/italianProvinces";
import { useRAScrapingState } from "@/hooks/useRAScrapingState";

export default function RAScrapingEngine() {
  const s = useRAScrapingState();

  return (
    <div className="flex flex-col h-full overflow-hidden" style={{ background: "linear-gradient(135deg, #0f1419 0%, #1a1f2e 100%)" }}>
      {/* Header */}
      <div className="flex-shrink-0 border-b border-cyan-500/20 px-3 sm:px-4 py-3 sm:py-4" style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)" }}>
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-cyan-400 flex items-center gap-2">
            <Zap className="w-6 h-6 sm:w-7 sm:h-7" /> Motore Scraping RA
          </h1>
          <p className="text-xs sm:text-sm text-cyan-300/60 mt-1">Centro di controllo scraping per Report Aziende</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 border-b border-cyan-500/20 px-3 sm:px-4 py-2" style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.4)" }}>
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full animate-pulse ${s.isAvailable ? "bg-cyan-400" : "bg-red-500"}`} />
            <span className="font-medium text-cyan-300">{s.isAvailable ? "Connesso" : "Disconnesso"}</span>
          </div>
          <Badge className="text-xs bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">
            <Clock className="w-3 h-3 mr-1" /> {s.isScraping ? "In corso" : "Pronto"}
          </Badge>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
          <Tabs value={s.activeTab} onValueChange={s.setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3" style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
              <TabsTrigger value="search" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-300/60"><Search className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Ricerca</span></TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-300/60"><Activity className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Job</span></TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm data-[state=active]:bg-cyan-500/20 data-[state=active]:text-cyan-300 text-cyan-300/60"><Zap className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Config</span></TabsTrigger>
            </TabsList>

            <TabsContent value="search" className="space-y-4 mt-4">
              <SearchFilters s={s} />
              {s.searchPerformed && <SearchResults s={s} />}
            </TabsContent>

            <TabsContent value="jobs" className="space-y-4 mt-4">
              <JobsPanel s={s} />
              <LogsPanel s={s} />
            </TabsContent>

            <TabsContent value="settings" className="space-y-4 mt-4">
              <SettingsPanel s={s} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}

/* ── Sub-components ── */

function SearchFilters({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg text-cyan-300">Filtri di Ricerca</CardTitle>
        <CardDescription className="text-xs sm:text-sm text-cyan-300/60">Configura i criteri di ricerca per le aziende</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ATECO */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Codici ATECO</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
            {ATECO_TREE.filter(a => a.livello === 2).map(a => (
              <div key={a.codice} className="flex items-center gap-2">
                <Checkbox id={`ateco-${a.codice}`} checked={s.selectedAtecoCodes.has(a.codice)} onCheckedChange={() => s.toggleAteco(a.codice)} />
                <label htmlFor={`ateco-${a.codice}`} className="text-xs sm:text-sm cursor-pointer text-cyan-300/80 hover:text-cyan-300">{a.codice}</label>
              </div>
            ))}
          </div>
          {s.selectedAtecoCodes.size > 0 && <div className="text-xs text-cyan-300/60">{s.selectedAtecoCodes.size} ATECO selezionati</div>}
        </div>

        {/* Regioni */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Regioni</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
            {REGIONI_ITALIANE.map(r => (
              <div key={r} className="flex items-center gap-2">
                <Checkbox id={`region-${r}`} checked={s.selectedRegions.has(r)} onCheckedChange={() => s.toggleRegion(r)} />
                <label htmlFor={`region-${r}`} className="text-xs sm:text-sm cursor-pointer text-cyan-300/80 hover:text-cyan-300">{r}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Province */}
        {s.availableProvinces.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium text-cyan-300">Province (Opzionale)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.05)", borderRadius: "0.5rem", border: "1px solid rgba(34, 211, 238, 0.2)" }}>
              {s.availableProvinces.map(p => (
                <div key={p.nome} className="flex items-center gap-2">
                  <Checkbox id={`province-${p.nome}`} checked={s.selectedProvinces.has(p.nome)} onCheckedChange={() => s.toggleProvince(p.nome)} />
                  <label htmlFor={`province-${p.nome}`} className="text-xs sm:text-sm cursor-pointer text-cyan-300/80 hover:text-cyan-300">{p.nome} ({p.sigla})</label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sliders */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Fatturato: €{s.fatturatoBudget[0]}K - €{s.fatturatoBudget[1]}K</label>
          <Slider value={s.fatturatoBudget} onValueChange={v => s.setFatturatoBudget(v as [number, number])} min={0} max={100} step={5} />
        </div>
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Dipendenti: {s.dipendentiRange[0]} - {s.dipendentiRange[1]}</label>
          <Slider value={s.dipendentiRange} onValueChange={v => s.setDipendentiRange(v as [number, number])} min={0} max={500} step={10} />
        </div>

        {/* Contact Filters */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Filtri Contatti</label>
          <div className="space-y-2">
            {(["email", "pec", "phone"] as const).map(f => (
              <div key={f} className="flex items-center gap-2">
                <Checkbox id={`filter-${f}`} checked={s.contactFilters[f]} onCheckedChange={checked => s.setContactFilters({ ...s.contactFilters, [f]: !!checked })} />
                <label htmlFor={`filter-${f}`} className="text-xs sm:text-sm cursor-pointer text-cyan-300/80">Con {f === "email" ? "Email" : f === "pec" ? "PEC" : "Telefono"}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
          <Button onClick={s.handleSearch} disabled={s.isSearching || !s.isAvailable} className="h-8 sm:h-9 text-xs sm:text-sm bg-cyan-600 hover:bg-cyan-700 text-white">
            <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" /> {s.isSearching ? "Ricerca..." : "Cerca"}
          </Button>
          <Button onClick={s.handleScrapeFull} disabled={s.isScraping || !s.isAvailable} className="h-8 sm:h-9 text-xs sm:text-sm bg-amber-600 hover:bg-amber-700 text-white">
            <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" /> {s.isScraping ? "Scraping..." : "Scraping Completo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchResults({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base sm:text-lg text-cyan-300">Risultati Ricerca</CardTitle>
          <CardDescription className="text-xs sm:text-sm text-cyan-300/60">{s.searchResults.length} aziende trovate</CardDescription>
        </div>
        {s.selectedResults.size > 0 && <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">{s.selectedResults.size} selezionate</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 pb-2" style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
          <Checkbox id="select-all" checked={s.selectedResults.size === s.searchResults.length && s.searchResults.length > 0} onCheckedChange={s.handleSelectAll} />
          <label htmlFor="select-all" className="text-xs sm:text-sm font-medium text-cyan-300">Seleziona tutto</label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
                <th className="text-left py-2 px-2 font-medium w-8 text-cyan-300" />
                <th className="text-left py-2 px-2 font-medium min-w-[120px] text-cyan-300">Azienda</th>
                <th className="text-left py-2 px-2 font-medium min-w-[100px] text-cyan-300">P.IVA</th>
                <th className="text-left py-2 px-2 font-medium min-w-[80px] text-cyan-300">Città</th>
                <th className="text-left py-2 px-2 font-medium min-w-[80px] text-cyan-300">ATECO</th>
              </tr>
            </thead>
            <tbody>
              {s.searchResults.map(r => (
                <tr key={r.id} className="hover:bg-cyan-500/10" style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.1)" }}>
                  <td className="py-2 px-2"><Checkbox checked={s.selectedResults.has(r.id)} onCheckedChange={() => s.handleSelectResult(r.id)} /></td>
                  <td className="py-2 px-2 font-medium text-cyan-300">{r.name}</td>
                  <td className="py-2 px-2 text-cyan-300/60">{r.piva}</td>
                  <td className="py-2 px-2 text-cyan-300/80">{r.città}</td>
                  <td className="py-2 px-2 text-cyan-300/60">{r.ateco}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.selectedResults.size > 0 && (
          <div className="pt-2" style={{ borderTop: "1px solid rgba(34, 211, 238, 0.2)" }}>
            <Button onClick={s.handleScrapeSelected} disabled={s.isScraping || !s.isAvailable} className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-green-600 hover:bg-green-700 text-white">
              <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" /> {s.isScraping ? "Scraping..." : `Scraping Selezionati (${s.selectedResults.size})`}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function JobsPanel({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg text-cyan-300">Job in Esecuzione</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {s.jobsLoading ? <div className="text-center py-8 text-cyan-300/60">Caricamento job...</div>
        : (s.jobs as any[]).length === 0 ? <div className="text-center py-8 text-cyan-300/60">Nessun job in corso</div>
        : (s.jobs as any[]).map((job: any) => {
            const progress = job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0;
            return (
              <div key={job.id} className="space-y-3 pb-4 last:border-0 last:pb-0" style={{ borderBottom: "1px solid rgba(34, 211, 238, 0.2)" }}>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {job.status === "in_progress" ? <Activity className="w-4 h-4 text-cyan-400 animate-spin" /> : job.status === "completed" ? <CheckCircle className="w-4 h-4 text-green-400" /> : <AlertCircle className="w-4 h-4 text-red-400" />}
                    <span className="text-xs sm:text-sm font-medium text-cyan-300">{job.status === "in_progress" ? "In Elaborazione" : job.status === "completed" ? "Completato" : "Errore"}</span>
                  </div>
                  <Badge className="bg-cyan-500/20 text-cyan-300 border border-cyan-500/40">{Math.round(progress)}%</Badge>
                </div>
                <div className="space-y-2">
                  <div className="w-full rounded-full h-2 overflow-hidden" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                    <div className="bg-cyan-500 h-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[["Totali", job.total_items, "text-cyan-300"], ["Elaborati", job.processed_items, "text-cyan-400"], ["Salvati", job.saved_items, "text-green-400"], ["Errori", job.error_count, "text-red-400"]].map(([label, val, color]) => (
                      <div key={label as string} className="rounded p-2" style={{ backgroundColor: "rgba(34, 211, 238, 0.1)" }}>
                        <div className={`font-medium ${color}`}>{val as number}</div>
                        <div className="text-cyan-300/60">{label as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {job.status === "in_progress" && (
                  <Button onClick={s.handleStopScraping} size="sm" className="w-full h-7 text-xs bg-red-600/20 hover:bg-red-600/30 text-red-400 border border-red-500/40" variant="outline">
                    <Pause className="w-3 h-3 mr-1.5" /> Interrompi
                  </Button>
                )}
              </div>
            );
          })}
      </CardContent>
    </Card>
  );
}

function LogsPanel({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg text-cyan-300">Log Terminale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg p-3 sm:p-4 text-xs space-y-1 max-h-64 overflow-y-auto border" style={{ borderColor: "rgba(34, 211, 238, 0.2)", backgroundColor: "rgba(0, 0, 0, 0.3)", fontFamily: "'JetBrains Mono', monospace" }}>
          {s.statusLogs.length === 0 ? <div className="text-cyan-300/60 text-center py-4">Nessun log disponibile</div>
          : s.statusLogs.map((log, i) => <div key={i} className="text-cyan-300/80">{log}</div>)}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPanel({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card style={{ backdropFilter: "blur(10px)", backgroundColor: "rgba(15, 20, 25, 0.6)", borderColor: "rgba(34, 211, 238, 0.2)" }} className="border">
      <CardHeader>
        <CardTitle className="text-base sm:text-lg text-cyan-300">Configurazione</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Delay tra richieste: {s.delaySeconds}ms</label>
          <Slider value={[s.delaySeconds]} onValueChange={v => s.setDelaySeconds(v[0])} min={200} max={3000} step={100} />
        </div>
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-cyan-300">Batch size: {s.batchSize}</label>
          <Slider value={[s.batchSize]} onValueChange={v => s.setBatchSize(v[0])} min={5} max={100} step={5} />
        </div>
      </CardContent>
    </Card>
  );
}
