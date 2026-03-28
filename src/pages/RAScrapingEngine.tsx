import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import {
  Activity,
  Download,
  Play,
  Zap,
  AlertCircle,
  CheckCircle,
  Clock,
  Search,
} from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// Mock data
const MOCK_ATECO_CODES = [
  { code: "62.01", label: "Programmazione informatica" },
  { code: "62.02", label: "Consulenza informatica" },
  { code: "63.11", label: "Elaborazione dati" },
  { code: "70.22", label: "Ricerca e sviluppo in informatica" },
  { code: "72.19", label: "Altre ricerche scientifiche" },
];

const MOCK_REGIONI = [
  "Lazio",
  "Lombardia",
  "Campania",
  "Piemonte",
  "Veneto",
  "Emilia-Romagna",
  "Toscana",
  "Sicilia",
];

const MOCK_PROVINCE = {
  Lazio: ["Roma", "Frosinone", "Latina", "Rieti", "Viterbo"],
  Lombardia: ["Milano", "Brescia", "Varese", "Bergamo", "Como"],
  Campania: ["Napoli", "Caserta", "Avellino", "Benevento", "Salerno"],
};

const MOCK_RESULTS = [
  {
    id: "1",
    name: "TechSolutions SpA",
    piva: "12345678901",
    città: "Roma",
    ateco: "62.01",
    fatturato: "2.5M",
    dipendenti: 45,
    email: true,
    pec: false,
    telefono: true,
  },
  {
    id: "2",
    name: "Digital Innovation Srl",
    piva: "98765432101",
    città: "Milano",
    ateco: "62.02",
    fatturato: "5.2M",
    dipendenti: 120,
    email: true,
    pec: true,
    telefono: true,
  },
  {
    id: "3",
    name: "CloudStudio Ltd",
    piva: "45678901234",
    città: "Roma",
    ateco: "63.11",
    fatturato: "1.8M",
    dipendenti: 32,
    email: true,
    pec: false,
    telefono: false,
  },
  {
    id: "4",
    name: "DataCore Analytics",
    piva: "56789012345",
    città: "Napoli",
    ateco: "70.22",
    fatturato: "3.2M",
    dipendenti: 67,
    email: true,
    pec: true,
    telefono: true,
  },
  {
    id: "5",
    name: "WebServices Pro",
    piva: "67890123456",
    città: "Milano",
    ateco: "62.01",
    fatturato: "4.1M",
    dipendenti: 89,
    email: false,
    pec: true,
    telefono: true,
  },
];

const MOCK_JOBS = [
  {
    id: "job-1",
    status: "in-progress",
    progress: 65,
    total: 150,
    processed: 98,
    saved: 92,
    errors: 6,
  },
  {
    id: "job-2",
    status: "completed",
    progress: 100,
    total: 75,
    processed: 75,
    saved: 73,
    errors: 2,
  },
];

const MOCK_LOGS = [
  "Connessione stabilita con il server RA",
  "Ricerca: ATECO=62.01, Regione=Lazio",
  "Trovate 150 aziende",
  "Inizio scraping batch 1/4",
  "Completati 98 record su 150",
  "Sincronizzazione in corso...",
  "Errore: Timeout server (retry automatico)",
  "Batch 1 completato: 92 salvate, 6 errori",
  "Batch 2 in elaborazione...",
  "Ultima sincronizzazione: 2 minuti fa",
];

export default function RAScrapingEngine() {
  const [selectedRegion, setSelectedRegion] = useState<string>("");
  const [selectedProvince, setSelectedProvince] = useState<string>("");
  const [selectedAteco, setSelectedAteco] = useState<string>("");
  const [fatturatoBudget, setFatturatoBudget] = useState<[number, number]>([0, 100]);
  const [dipendentiRange, setDipendentiRange] = useState<[number, number]>([0, 500]);
  const [contactFilters, setContactFilters] = useState({
    email: false,
    pec: false,
    phone: false,
  });
  const [selectedResults, setSelectedResults] = useState<Set<string>>(new Set());
  const [searchPerformed, setSearchPerformed] = useState(false);
  const [activeTab, setActiveTab] = useState("search");

  const handleSelectResult = (id: string) => {
    const newSelected = new Set(selectedResults);
    if (newSelected.has(id)) {
      newSelected.delete(id);
    } else {
      newSelected.add(id);
    }
    setSelectedResults(newSelected);
  };

  const handleSelectAll = () => {
    if (selectedResults.size === MOCK_RESULTS.length) {
      setSelectedResults(new Set());
    } else {
      setSelectedResults(new Set(MOCK_RESULTS.map((r) => r.id)));
    }
  };

  const availableProvinces =
    selectedRegion && MOCK_PROVINCE[selectedRegion as keyof typeof MOCK_PROVINCE]
      ? MOCK_PROVINCE[selectedRegion as keyof typeof MOCK_PROVINCE]
      : [];

  return (
    <div className="flex flex-col h-full overflow-hidden bg-background">
      {/* Header */}
      <div className="flex-shrink-0 border-b border-border bg-background/80 backdrop-blur-sm px-3 sm:px-4 py-3 sm:py-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-foreground flex items-center gap-2">
                <Zap className="w-6 h-6 sm:w-7 sm:h-7 text-yellow-600" />
                Motore Scraping RA
              </h1>
              <p className="text-xs sm:text-sm text-muted-foreground mt-1">
                Centro di controllo scraping per Report Aziende (reportaziende.it)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Connection Status Bar */}
      <div className="flex-shrink-0 border-b border-border bg-muted/30 px-3 sm:px-4 py-2">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-xs sm:text-sm">
          <div className="flex items-center gap-2 min-w-0">
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="font-medium text-foreground">Connesso</span>
            </div>
            <div className="hidden sm:block w-1 h-1 bg-border rounded-full" />
            <span className="text-muted-foreground truncate hidden sm:inline">
              Estensione RA: Attiva
            </span>
          </div>
          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-muted-foreground hidden xs:inline">
              Ultima sincronizzazione: 2 min fa
            </span>
            <Badge variant="outline" className="text-xs">
              <Clock className="w-3 h-3 mr-1" />
              Pronto
            </Badge>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 min-h-0 overflow-y-auto">
        <div className="max-w-7xl mx-auto p-3 sm:p-4 space-y-4">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsList className="grid w-full grid-cols-3 bg-muted/50">
              <TabsTrigger value="search" className="gap-1.5 text-xs sm:text-sm">
                <Search className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Ricerca</span>
              </TabsTrigger>
              <TabsTrigger value="jobs" className="gap-1.5 text-xs sm:text-sm">
                <Activity className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Job</span>
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs sm:text-sm">
                <Zap className="w-3 h-3 sm:w-4 sm:h-4" />
                <span className="hidden xs:inline">Config</span>
              </TabsTrigger>
            </TabsList>

            {/* Search Tab */}
            <TabsContent value="search" className="space-y-4 mt-4">
              {/* Filters Card */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Filtri di Ricerca</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Configura i criteri di ricerca per le aziende
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
                    {/* ATECO Code */}
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Codice ATECO</label>
                      <Select value={selectedAteco} onValueChange={setSelectedAteco}>
                        <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Seleziona ATECO..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tutti</SelectItem>
                          {MOCK_ATECO_CODES.map((ateco) => (
                            <SelectItem key={ateco.code} value={ateco.code}>
                              {ateco.code} - {ateco.label}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Region */}
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Regione</label>
                      <Select value={selectedRegion} onValueChange={setSelectedRegion}>
                        <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Seleziona regione..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tutte</SelectItem>
                          {MOCK_REGIONI.map((regione) => (
                            <SelectItem key={regione} value={regione}>
                              {regione}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {/* Province */}
                    <div className="space-y-2">
                      <label className="text-xs sm:text-sm font-medium">Provincia</label>
                      <Select
                        value={selectedProvince}
                        onValueChange={setSelectedProvince}
                        disabled={!selectedRegion}
                      >
                        <SelectTrigger className="h-8 sm:h-9 text-xs sm:text-sm">
                          <SelectValue placeholder="Seleziona provincia..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="">Tutte</SelectItem>
                          {availableProvinces.map((province) => (
                            <SelectItem key={province} value={province}>
                              {province}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  {/* Fatturato Range */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Fatturato: €{fatturatoBudget[0]}K - €{fatturatoBudget[1]}K
                    </label>
                    <Slider
                      value={fatturatoBudget}
                      onValueChange={setFatturatoBudget}
                      min={0}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  {/* Dipendenti Range */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">
                      Dipendenti: {dipendentiRange[0]} - {dipendentiRange[1]}
                    </label>
                    <Slider
                      value={dipendentiRange}
                      onValueChange={setDipendentiRange}
                      min={0}
                      max={500}
                      step={10}
                      className="w-full"
                    />
                  </div>

                  {/* Contact Filters */}
                  <div className="space-y-2">
                    <label className="text-xs sm:text-sm font-medium">Filtri Contatti</label>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="filter-email"
                          checked={contactFilters.email}
                          onCheckedChange={(checked) =>
                            setContactFilters({ ...contactFilters, email: !!checked })
                          }
                        />
                        <label htmlFor="filter-email" className="text-xs sm:text-sm cursor-pointer">
                          Con Email
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="filter-pec"
                          checked={contactFilters.pec}
                          onCheckedChange={(checked) =>
                            setContactFilters({ ...contactFilters, pec: !!checked })
                          }
                        />
                        <label htmlFor="filter-pec" className="text-xs sm:text-sm cursor-pointer">
                          Con PEC
                        </label>
                      </div>
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="filter-phone"
                          checked={contactFilters.phone}
                          onCheckedChange={(checked) =>
                            setContactFilters({ ...contactFilters, phone: !!checked })
                          }
                        />
                        <label htmlFor="filter-phone" className="text-xs sm:text-sm cursor-pointer">
                          Con Telefono
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Action Buttons */}
                  <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-2">
                    <Button
                      onClick={() => setSearchPerformed(true)}
                      variant="outline"
                      className="h-8 sm:h-9 text-xs sm:text-sm"
                    >
                      <Search className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                      Cerca
                    </Button>
                    <Button className="h-8 sm:h-9 text-xs sm:text-sm bg-yellow-600 hover:bg-yellow-700">
                      <Play className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                      Scraping Completo
                    </Button>
                  </div>
                </CardContent>
              </Card>

              {/* Results Card */}
              {searchPerformed && (
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between space-y-0">
                    <div>
                      <CardTitle className="text-base sm:text-lg">Risultati Ricerca</CardTitle>
                      <CardDescription className="text-xs sm:text-sm">
                        {MOCK_RESULTS.length} aziende trovate
                      </CardDescription>
                    </div>
                    {selectedResults.size > 0 && (
                      <Badge variant="default">{selectedResults.size} selezionate</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="space-y-3">
                    <div className="flex items-center gap-2 pb-2 border-b border-border">
                      <Checkbox
                        id="select-all"
                        checked={selectedResults.size === MOCK_RESULTS.length}
                        onCheckedChange={handleSelectAll}
                      />
                      <label htmlFor="select-all" className="text-xs sm:text-sm font-medium">
                        Seleziona tutto
                      </label>
                    </div>

                    <div className="overflow-x-auto">
                      <table className="w-full text-xs sm:text-sm">
                        <thead>
                          <tr className="border-b border-border">
                            <th className="text-left py-2 px-2 font-medium w-8" />
                            <th className="text-left py-2 px-2 font-medium min-w-[120px]">
                              Azienda
                            </th>
                            <th className="text-left py-2 px-2 font-medium min-w-[100px]">
                              P.IVA
                            </th>
                            <th className="text-left py-2 px-2 font-medium min-w-[80px]">
                              Città
                            </th>
                            <th className="text-left py-2 px-2 font-medium min-w-[80px]">ATECO</th>
                          </tr>
                        </thead>
                        <tbody>
                          {MOCK_RESULTS.map((result) => (
                            <tr key={result.id} className="border-b border-border/50 hover:bg-muted/50">
                              <td className="py-2 px-2">
                                <Checkbox
                                  checked={selectedResults.has(result.id)}
                                  onCheckedChange={() => handleSelectResult(result.id)}
                                />
                              </td>
                              <td className="py-2 px-2 font-medium">{result.name}</td>
                              <td className="py-2 px-2 text-muted-foreground">{result.piva}</td>
                              <td className="py-2 px-2">{result.città}</td>
                              <td className="py-2 px-2 text-muted-foreground">{result.ateco}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>

                    {selectedResults.size > 0 && (
                      <div className="pt-2 border-t border-border">
                        <Button className="w-full h-8 sm:h-9 text-xs sm:text-sm bg-green-600 hover:bg-green-700">
                          <Download className="w-3 h-3 sm:w-4 sm:h-4 mr-1.5" />
                          Scarica Selezionati ({selectedResults.size})
                        </Button>
                      </div>
                    )}
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            {/* Active Jobs Tab */}
            <TabsContent value="jobs" className="space-y-4 mt-4">
              {/* Jobs Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Job in Esecuzione</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Monitoraggio lavori di scraping attivi
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {MOCK_JOBS.map((job) => (
                    <div key={job.id} className="space-y-3 pb-4 border-b border-border last:border-0 last:pb-0">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {job.status === "in-progress" ? (
                            <Activity className="w-4 h-4 text-blue-500 animate-spin" />
                          ) : (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          )}
                          <span className="text-xs sm:text-sm font-medium">
                            {job.status === "in-progress" ? "In Elaborazione" : "Completato"}
                          </span>
                        </div>
                        <Badge variant={job.status === "in-progress" ? "default" : "secondary"}>
                          {job.progress}%
                        </Badge>
                      </div>

                      <div className="space-y-2">
                        <div className="w-full bg-muted rounded-full h-2 overflow-hidden">
                          <div
                            className="bg-blue-500 h-full transition-all"
                            style={{ width: `${job.progress}%` }}
                          />
                        </div>
                        <div className="grid grid-cols-4 gap-2 text-xs">
                          <div className="bg-muted/50 rounded p-2">
                            <div className="font-medium">{job.total}</div>
                            <div className="text-muted-foreground">Totali</div>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <div className="font-medium text-blue-600">{job.processed}</div>
                            <div className="text-muted-foreground">Elaborati</div>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <div className="font-medium text-green-600">{job.saved}</div>
                            <div className="text-muted-foreground">Salvati</div>
                          </div>
                          <div className="bg-muted/50 rounded p-2">
                            <div className="font-medium text-red-600">{job.errors}</div>
                            <div className="text-muted-foreground">Errori</div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </CardContent>
              </Card>

              {/* Logs Panel */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Log Terminale</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Ultimi 10 log
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="bg-muted/50 rounded-lg p-3 sm:p-4 font-mono text-xs space-y-1 max-h-64 overflow-y-auto border border-border">
                    {MOCK_LOGS.map((log, idx) => (
                      <div key={idx} className="text-muted-foreground hover:text-foreground">
                        <span className="text-blue-600">[{new Date().getHours().toString().padStart(2, "0")}:{new Date().getMinutes().toString().padStart(2, "0")}]</span>{" "}
                        {log}
                      </div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Settings Tab */}
            <TabsContent value="settings" className="space-y-4 mt-4">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base sm:text-lg">Configurazione Scraping</CardTitle>
                  <CardDescription className="text-xs sm:text-sm">
                    Impostazioni per il controllo dei lavori
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Request Delay */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium">
                        Ritardo tra Richieste (ms)
                      </label>
                      <Badge variant="outline">500ms</Badge>
                    </div>
                    <Slider
                      defaultValue={[500]}
                      min={100}
                      max={5000}
                      step={100}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Aumenta il ritardo per ridurre il carico sul server
                    </p>
                  </div>

                  {/* Batch Size */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium">Dimensione Batch</label>
                      <Badge variant="outline">25</Badge>
                    </div>
                    <Slider
                      defaultValue={[25]}
                      min={5}
                      max={100}
                      step={5}
                      className="w-full"
                    />
                    <p className="text-xs text-muted-foreground">
                      Numero di record da elaborare per batch
                    </p>
                  </div>

                  {/* Timeout */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <label className="text-xs sm:text-sm font-medium">Timeout Richiesta (sec)</label>
                      <Badge variant="outline">30</Badge>
                    </div>
                    <Slider
                      defaultValue={[30]}
                      min={10}
                      max={120}
                      step={5}
                      className="w-full"
                    />
                  </div>

                  {/* Info */}
                  <div className="flex gap-2 p-3 sm:p-4 rounded-lg bg-blue-50 dark:bg-blue-950 border border-blue-200 dark:border-blue-800">
                    <AlertCircle className="w-4 h-4 sm:w-5 sm:h-5 text-blue-600 dark:text-blue-400 flex-shrink-0 mt-0.5" />
                    <div className="text-xs sm:text-sm text-blue-700 dark:text-blue-300">
                      Le impostazioni vengono applicate ai nuovi job. I job in esecuzione non sono
                      interessati.
                    </div>
                  </div>

                  <Button className="w-full h-8 sm:h-9 text-xs sm:text-sm">Salva Configurazione</Button>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </div>
  );
}
