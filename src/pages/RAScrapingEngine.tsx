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
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border px-3 sm:px-4 py-3 sm:py-4 bg-card/60 backdrop-blur-md">
        <div className="max-w-7xl mx-auto">
          <h1 className="text-xl sm:text-2xl font-bold text-primary flex items-center gap-2">
            <Zap className="w-6 h-6 sm:w-7 sm:h-7" /> Motore Scraping RA
          </h1>
          <p className="text-xs sm:text-sm text-muted-foreground mt-1">Centro di controllo scraping per Report Aziende</p>
        </div>
      </div>

      {/* Status Bar */}
      <div className="flex-shrink-0 border-b border-border px-3 sm:px-4 py-2 bg-card/40 backdrop-blur-md">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className={`w-2 h-2 rounded-full animate-pulse ${s.isAvailable ? "bg-emerald-400" : "bg-destructive"}`} />
            <span className="font-medium text-foreground">{s.isAvailable ? "Connesso" : "Disconnesso"}</span>
          </div>
          <Badge variant="outline" className="text-xs">
            <Clock className="w-3 h-3 mr-1" /> {s.isScraping ? "In corso" : "Pronto"}
          </Badge>
        </div>
      </div>

      {/* Main */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
          <Tabs value={s.activeTab} onValueChange={s.setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3">
              <TabsTrigger value="search" className="gap-1.5 text-xs sm:text-sm"><Search className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Ricerca</span></TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5 text-xs sm:text-sm"><Activity className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Job</span></TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm"><Zap className="w-3 h-3 sm:w-4 sm:h-4" /><span className="hidden xs:inline">Config</span></TabsTrigger>
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Filtri di Ricerca</CardTitle>
        <CardDescription className="text-xs sm:text-sm">Configura i criteri di ricerca per le aziende</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* ATECO */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Codici ATECO</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2 bg-muted/30 rounded-lg border border-border">
            {ATECO_TREE.filter(a => a.livello === 2).map(a => (
              <div key={a.codice} className="flex items-center gap-2">
                <Checkbox id={`ateco-${a.codice}`} checked={s.selectedAtecoCodes.has(a.codice)} onCheckedChange={() => s.toggleAteco(a.codice)} />
                <label htmlFor={`ateco-${a.codice}`} className="text-xs sm:text-sm cursor-pointer text-muted-foreground hover:text-foreground">{a.codice}</label>
              </div>
            ))}
          </div>
          {s.selectedAtecoCodes.size > 0 && <div className="text-xs text-muted-foreground">{s.selectedAtecoCodes.size} ATECO selezionati</div>}
        </div>

        {/* Regioni */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Regioni</label>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2 bg-muted/30 rounded-lg border border-border">
            {REGIONI_ITALIANE.map(r => (
              <div key={r} className="flex items-center gap-2">
                <Checkbox id={`region-${r}`} checked={s.selectedRegions.has(r)} onCheckedChange={() => s.toggleRegion(r)} />
                <label htmlFor={`region-${r}`} className="text-xs sm:text-sm cursor-pointer text-muted-foreground hover:text-foreground">{r}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Province */}
        {s.availableProvinces.length > 0 && (
          <div className="space-y-2">
            <label className="text-xs sm:text-sm font-medium text-foreground">Province (Opzionale)</label>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 max-h-[150px] overflow-y-auto p-2 bg-muted/30 rounded-lg border border-border">
              {s.availableProvinces.map(p => (
                <div key={p.nome} className="flex items-center gap-2">
                  <Checkbox id={`province-${p.nome}`} checked={s.selectedProvinces.has(p.nome)} onCheckedChange={() => s.toggleProvince(p.nome)} />
                  <label htmlFor={`province-${p.nome}`} className="text-xs sm:text-sm cursor-pointer text-muted-foreground hover:text-foreground">{p.nome} ({p.sigla})</label>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Sliders */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Fatturato: €{s.fatturatoBudget[0]}K - €{s.fatturatoBudget[1]}K</label>
          <Slider value={s.fatturatoBudget} onValueChange={v => s.setFatturatoBudget(v as [number, number])} min={0} max={100} step={5} />
        </div>
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Dipendenti: {s.dipendentiRange[0]} - {s.dipendentiRange[1]}</label>
          <Slider value={s.dipendentiRange} onValueChange={v => s.setDipendentiRange(v as [number, number])} min={0} max={500} step={10} />
        </div>

        {/* Contact Filters */}
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Filtri Contatti</label>
          <div className="space-y-2">
            {(["email", "pec", "phone"] as const).map(f => (
              <div key={f} className="flex items-center gap-2">
                <Checkbox id={`filter-${f}`} checked={s.contactFilters[f]} onCheckedChange={checked => s.setContactFilters({ ...s.contactFilters, [f]: !!checked })} />
                <label htmlFor={`filter-${f}`} className="text-xs sm:text-sm cursor-pointer text-muted-foreground">Con {f === "email" ? "Email" : f === "pec" ? "PEC" : "Telefono"}</label>
              </div>
            ))}
          </div>
        </div>

        {/* Buttons */}
        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
          <Button onClick={s.handleSearch} disabled={s.isSearching || !s.isAvailable} className="h-8 sm:h-9 text-xs sm:text-sm">
            <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" /> {s.isSearching ? "Ricerca..." : "Cerca"}
          </Button>
          <Button onClick={s.handleScrapeFull} disabled={s.isScraping || !s.isAvailable} variant="secondary" className="h-8 sm:h-9 text-xs sm:text-sm">
            <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" /> {s.isScraping ? "Scraping..." : "Scraping Completo"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function SearchResults({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <div>
          <CardTitle className="text-base sm:text-lg">Risultati Ricerca</CardTitle>
          <CardDescription className="text-xs sm:text-sm">{s.searchResults.length} aziende trovate</CardDescription>
        </div>
        {s.selectedResults.size > 0 && <Badge variant="outline">{s.selectedResults.size} selezionate</Badge>}
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex items-center gap-2 pb-2 border-b border-border">
          <Checkbox id="select-all" checked={s.selectedResults.size === s.searchResults.length && s.searchResults.length > 0} onCheckedChange={s.handleSelectAll} />
          <label htmlFor="select-all" className="text-xs sm:text-sm font-medium text-foreground">Seleziona tutto</label>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-xs sm:text-sm">
            <thead>
              <tr className="border-b border-border">
                <th className="text-left py-2 px-2 font-medium w-8 text-foreground" />
                <th className="text-left py-2 px-2 font-medium min-w-[120px] text-foreground">Azienda</th>
                <th className="text-left py-2 px-2 font-medium min-w-[100px] text-foreground">P.IVA</th>
                <th className="text-left py-2 px-2 font-medium min-w-[80px] text-foreground">Città</th>
                <th className="text-left py-2 px-2 font-medium min-w-[80px] text-foreground">ATECO</th>
              </tr>
            </thead>
            <tbody>
              {s.searchResults.map(r => (
                <tr key={r.id} className="hover:bg-muted/30 border-b border-border/50">
                  <td className="py-2 px-2"><Checkbox checked={s.selectedResults.has(r.id)} onCheckedChange={() => s.handleSelectResult(r.id)} /></td>
                  <td className="py-2 px-2 font-medium text-foreground">{r.name}</td>
                  <td className="py-2 px-2 text-muted-foreground">{r.piva}</td>
                  <td className="py-2 px-2 text-foreground">{r.città}</td>
                  <td className="py-2 px-2 text-muted-foreground">{r.ateco}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {s.selectedResults.size > 0 && (
          <div className="pt-2 border-t border-border">
            <Button onClick={s.handleScrapeSelected} disabled={s.isScraping || !s.isAvailable} className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-emerald-600 hover:bg-emerald-700 text-primary-foreground">
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Job in Esecuzione</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {s.jobsLoading ? <div className="text-center py-8 text-muted-foreground">Caricamento job...</div>
        : (s.jobs as Array<Record<string, unknown>>).length === 0 ? <div className="text-center py-8 text-muted-foreground">Nessun job in corso</div>
        : (s.jobs as Array<Record<string, unknown>>).map((job) => {
            const progress = job.total_items > 0 ? (job.processed_items / job.total_items) * 100 : 0;
            return (
              <div key={job.id} className="space-y-3 pb-4 last:border-0 last:pb-0 border-b border-border">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    {job.status === "in_progress" ? <Activity className="w-4 h-4 text-primary animate-spin" /> : job.status === "completed" ? <CheckCircle className="w-4 h-4 text-emerald-400" /> : <AlertCircle className="w-4 h-4 text-destructive" />}
                    <span className="text-xs sm:text-sm font-medium text-foreground">{job.status === "in_progress" ? "In Elaborazione" : job.status === "completed" ? "Completato" : "Errore"}</span>
                  </div>
                  <Badge variant="outline">{Math.round(progress)}%</Badge>
                </div>
                <div className="space-y-2">
                  <div className="w-full rounded-full h-2 overflow-hidden bg-muted">
                    <div className="bg-primary h-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                  <div className="grid grid-cols-4 gap-2 text-xs">
                    {[["Totali", job.total_items, "text-foreground"], ["Elaborati", job.processed_items, "text-primary"], ["Salvati", job.saved_items, "text-emerald-400"], ["Errori", job.error_count, "text-destructive"]].map(([label, val, color]) => (
                      <div key={label as string} className="rounded p-2 bg-muted/30">
                        <div className={`font-medium ${color}`}>{val as number}</div>
                        <div className="text-muted-foreground">{label as string}</div>
                      </div>
                    ))}
                  </div>
                </div>
                {job.status === "in_progress" && (
                  <Button onClick={s.handleStopScraping} size="sm" variant="destructive" className="w-full h-7 text-xs">
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
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Log Terminale</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="rounded-lg p-3 sm:p-4 text-xs space-y-1 max-h-64 overflow-y-auto border border-border bg-muted/20 font-mono">
          {s.statusLogs.length === 0 ? <div className="text-muted-foreground text-center py-4">Nessun log disponibile</div>
          : s.statusLogs.map((log, i) => <div key={i} className="text-foreground/80">{log}</div>)}
        </div>
      </CardContent>
    </Card>
  );
}

function SettingsPanel({ s }: { s: ReturnType<typeof useRAScrapingState> }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base sm:text-lg">Configurazione</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Delay tra richieste: {s.delaySeconds}ms</label>
          <Slider value={[s.delaySeconds]} onValueChange={v => s.setDelaySeconds(v[0])} min={200} max={3000} step={100} />
        </div>
        <div className="space-y-2">
          <label className="text-xs sm:text-sm font-medium text-foreground">Batch size: {s.batchSize}</label>
          <Slider value={[s.batchSize]} onValueChange={v => s.setBatchSize(v[0])} min={5} max={100} step={5} />
        </div>
      </CardContent>
    </Card>
  );
}
