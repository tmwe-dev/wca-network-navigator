/**
 * ExportDialog — Dialog for exporting contacts, partners, deals, and emails
 * Includes format selection, entity selection, filters, and column selection
 */
import { useState, useMemo } from "react";
import { EntityType, ExportFilters, ExportFormat, useExportCSV, useExportExcel } from "@/hooks/useExport";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Loader2, Download, FileText, Sheet } from "lucide-react";
import { toast } from "sonner";


import { createLogger } from "@/lib/log";
const log = createLogger("ExportDialog");
export interface ExportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

const ENTITY_OPTIONS: Array<{
  value: EntityType;
  label: string;
  description: string;
}> = [
  { value: "contacts", label: "Contatti", description: "Elenco dei contatti importati" },
  { value: "partners", label: "Partner", description: "Rete partner" },
  { value: "deals", label: "Affari", description: "Pipeline di vendita" },
  { value: "emails", label: "Email", description: "Cronologia email" },
];

const ENTITY_COLUMNS: Record<EntityType, Array<{ key: string; label: string }>> = {
  contacts: [
    { key: "id", label: "ID" },
    { key: "name", label: "Nome" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefono" },
    { key: "mobile", label: "Cellulare" },
    { key: "company_name", label: "Azienda" },
    { key: "title", label: "Posizione" },
    { key: "country", label: "Paese" },
    { key: "lead_status", label: "Stato" },
    { key: "created_at", label: "Data creazione" },
    { key: "interaction_count", label: "Interazioni" },
  ],
  partners: [
    { key: "id", label: "ID" },
    { key: "name", label: "Nome" },
    { key: "country", label: "Paese" },
    { key: "website", label: "Sito web" },
    { key: "email", label: "Email" },
    { key: "phone", label: "Telefono" },
    { key: "registration_number", label: "Numero registrazione" },
    { key: "contact_person", label: "Persona di contatto" },
    { key: "status", label: "Stato" },
    { key: "created_at", label: "Data creazione" },
  ],
  deals: [
    { key: "id", label: "ID" },
    { key: "title", label: "Titolo" },
    { key: "partner_id", label: "ID Partner" },
    { key: "contact_id", label: "ID Contatto" },
    { key: "stage", label: "Fase" },
    { key: "amount", label: "Importo" },
    { key: "probability", label: "Probabilità" },
    { key: "close_date", label: "Data chiusura" },
    { key: "created_at", label: "Data creazione" },
  ],
  emails: [
    { key: "id", label: "ID" },
    { key: "from_address", label: "Da" },
    { key: "to_address", label: "A" },
    { key: "subject", label: "Oggetto" },
    { key: "status", label: "Stato" },
    { key: "campaign_id", label: "ID Campagna" },
    { key: "created_at", label: "Data creazione" },
  ],
};

export function ExportDialog({ open, onOpenChange }: ExportDialogProps) {
  const [entity, setEntity] = useState<EntityType>("contacts");
  const [format, setFormat] = useState<ExportFormat>("csv");
  const [selectedColumns, setSelectedColumns] = useState<Set<string>>(
    new Set(ENTITY_COLUMNS.contacts.slice(0, 7).map((c) => c.key))
  );
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [status, setStatus] = useState<string>("");

  const csvExport = useExportCSV();
  const excelExport = useExportExcel();
  const isLoading = csvExport.isPending || excelExport.isPending;

  const availableColumns = ENTITY_COLUMNS[entity];

  const handleColumnToggle = (key: string) => {
    const newSet = new Set(selectedColumns);
    if (newSet.has(key)) {
      newSet.delete(key);
    } else {
      newSet.add(key);
    }
    setSelectedColumns(newSet);
  };

  const handleSelectAll = () => {
    setSelectedColumns(new Set(availableColumns.map((c) => c.key)));
  };

  const handleClearAll = () => {
    setSelectedColumns(new Set());
  };

  const handleExport = async () => {
    if (selectedColumns.size === 0) {
      toast.error("Seleziona almeno una colonna");
      return;
    }

    const filters: ExportFilters = {};
    if (dateFrom || dateTo) {
      filters.dateRange = {
        from: dateFrom || "1900-01-01",
        to: dateTo || new Date().toISOString().split("T")[0],
      };
    }
    if (status) {
      filters.status = status;
    }

    try {
      const columns = Array.from(selectedColumns);
      if (format === "csv") {
        const result = await csvExport.mutateAsync({
          entity,
          format: "csv",
          filters,
          columns,
        });
        toast.success(`Esportati ${result.count} record come CSV`);
      } else {
        const result = await excelExport.mutateAsync({
          entity,
          format: "xlsx",
          filters,
          columns,
        });
        toast.success(`Esportati ${result.count} record come Excel`);
      }
      onOpenChange(false);
    } catch (error) {
      log.error("Export error:", { error: error });
      toast.error("Errore durante l'esportazione");
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Esporta Dati</DialogTitle>
          <DialogDescription>
            Seleziona il formato, l'entità, i filtri e le colonne da esportare.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* Format Selection */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Formato di esportazione</Label>
            <div className="grid grid-cols-2 gap-3">
              <Card
                className={`p-4 cursor-pointer border-2 transition ${
                  format === "csv"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setFormat("csv")}
              >
                <div className="flex items-center gap-2">
                  <FileText className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">CSV</div>
                    <div className="text-xs text-muted-foreground">Foglio di calcolo semplice</div>
                  </div>
                </div>
              </Card>
              <Card
                className={`p-4 cursor-pointer border-2 transition ${
                  format === "xlsx"
                    ? "border-blue-500 bg-blue-50 dark:bg-blue-950"
                    : "border-gray-200 dark:border-gray-700 hover:border-gray-300"
                }`}
                onClick={() => setFormat("xlsx")}
              >
                <div className="flex items-center gap-2">
                  <Sheet className="h-4 w-4" />
                  <div>
                    <div className="font-medium text-sm">Excel</div>
                    <div className="text-xs text-muted-foreground">Formato XLSX formattato</div>
                  </div>
                </div>
              </Card>
            </div>
          </div>

          {/* Entity Selection */}
          <div className="space-y-3">
            <Label htmlFor="entity-select" className="text-base font-semibold">
              Tipo di dato
            </Label>
            <Select value={entity} onValueChange={(v) => {
              setEntity(v as EntityType);
              setSelectedColumns(new Set(ENTITY_COLUMNS[v as EntityType].slice(0, 7).map((c) => c.key)));
            }}>
              <SelectTrigger id="entity-select">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ENTITY_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    <div>
                      <div className="font-medium">{opt.label}</div>
                      <div className="text-xs text-muted-foreground">{opt.description}</div>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Filters */}
          <div className="space-y-3">
            <Label className="text-base font-semibold">Filtri (opzionali)</Label>
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label htmlFor="date-from" className="text-xs">
                  Dal
                </Label>
                <Input
                  id="date-from"
                  type="date"
                  value={dateFrom}
                  onChange={(e) => setDateFrom(e.target.value)}
                />
              </div>
              <div className="space-y-1">
                <Label htmlFor="date-to" className="text-xs">
                  Al
                </Label>
                <Input
                  id="date-to"
                  type="date"
                  value={dateTo}
                  onChange={(e) => setDateTo(e.target.value)}
                />
              </div>
            </div>

            {/* Status filter */}
            {(entity === "contacts" || entity === "partners" || entity === "deals") && (
              <div className="space-y-1">
                <Label htmlFor="status-select" className="text-xs">
                  Stato (opzionale)
                </Label>
                <Input
                  id="status-select"
                  placeholder="Es. Active, Closed, Lead"
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                />
              </div>
            )}
          </div>

          {/* Column Selection */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-base font-semibold">Colonne da includere</Label>
              <div className="space-x-2">
                <Button size="sm" variant="outline" onClick={handleSelectAll}>
                  Tutte
                </Button>
                <Button size="sm" variant="outline" onClick={handleClearAll}>
                  Nessuna
                </Button>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 max-h-48 overflow-y-auto border rounded-lg p-3">
              {availableColumns.map((col) => (
                <div key={col.key} className="flex items-center space-x-2">
                  <Checkbox
                    id={col.key}
                    checked={selectedColumns.has(col.key)}
                    onCheckedChange={() => handleColumnToggle(col.key)}
                  />
                  <Label htmlFor={col.key} className="text-sm cursor-pointer font-normal">
                    {col.label}
                  </Label>
                </div>
              ))}
            </div>

            <div className="text-xs text-muted-foreground">
              {selectedColumns.size} colonne selezionate
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={handleExport} disabled={isLoading || selectedColumns.size === 0}>
            {isLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            <Download className="h-4 w-4 mr-2" />
            Esporta ({format.toUpperCase()})
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
