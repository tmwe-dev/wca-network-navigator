/**
 * AI Mapping preview card — extracted from Import.tsx
 */
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Loader2, CheckCircle2, AlertCircle, ArrowLeftRight, Trash2,
} from "lucide-react";
import { TARGET_COLUMNS, TARGET_SCHEMA } from "@/lib/import";
import { transformRow } from "@/lib/import";
import type { AiMappingResult } from "@/hooks/useImportWizard";

interface ImportMappingPreviewProps {
  aiMapping: AiMappingResult;
  pendingFile: File | null;
  pendingRows: Array<Record<string, unknown>>;
  groupName: string;
  setGroupName: (v: string) => void;
  importSource: "standard" | "business_card";
  uploading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  onMappingTargetChange: (srcKey: string, newTarget: string) => void;
}

export function ImportMappingPreview({
  aiMapping,
  pendingFile,
  pendingRows,
  groupName,
  setGroupName,
  importSource,
  uploading,
  onConfirm,
  onCancel,
  onMappingTargetChange,
}: ImportMappingPreviewProps) {
  return (
    <Card className="border-primary/30">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ArrowLeftRight className="w-5 h-5" />
          Anteprima Mapping AI
          <Badge variant={aiMapping.confidence > 0.7 ? "default" : "secondary"}>
            {Math.round(aiMapping.confidence * 100)}% confidence
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {Object.keys(aiMapping.column_mapping).length > 0 && (
          <div>
            <h4 className="text-sm font-medium mb-2">
              Mapping Colonne
              <span className="text-muted-foreground font-normal ml-2 text-xs">
                Usa i menu a tendina per cambiare la destinazione
              </span>
            </h4>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-xs">Colonna Sorgente</TableHead>
                  <TableHead className="text-xs">Esempio</TableHead>
                  <TableHead className="text-xs w-8">→</TableHead>
                  <TableHead className="text-xs">Colonna Destinazione</TableHead>
                  <TableHead className="text-xs w-8"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {Object.entries(aiMapping.column_mapping).map(([src, dst]) => {
                  const sampleValue = pendingRows.find(r => r[src]?.toString().trim())?.[src]?.toString() || "—";
                  const truncated = sampleValue.length > 40 ? sampleValue.slice(0, 40) + "…" : sampleValue;
                  return (
                    <TableRow key={src}>
                      <TableCell className="text-xs font-mono">{src}</TableCell>
                      <TableCell className="text-xs text-muted-foreground max-w-[180px] truncate" title={sampleValue}>{truncated}</TableCell>
                      <TableCell className="text-xs text-muted-foreground">→</TableCell>
                      <TableCell className="text-xs p-1">
                        <Select
                          value={dst}
                          onValueChange={(val) => onMappingTargetChange(src, val)}
                        >
                          <SelectTrigger className="h-8 text-xs w-[180px]">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="__unmapped__" className="text-xs text-muted-foreground">
                              — Non mappare —
                            </SelectItem>
                            {TARGET_SCHEMA.map(t => (
                              <SelectItem key={t.key} value={t.key} className="text-xs">
                                {t.label} ({t.key})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </TableCell>
                      <TableCell className="text-xs p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-6 w-6 text-muted-foreground hover:text-destructive"
                          onClick={() => onMappingTargetChange(src, "__unmapped__")}
                          aria-label="Elimina"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {aiMapping.warnings.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="w-4 h-4" />
            <AlertTitle className="text-xs">Attenzione</AlertTitle>
            <AlertDescription className="text-xs">
              {aiMapping.warnings.map((w, i) => <div key={i}>• {w}</div>)}
            </AlertDescription>
          </Alert>
        )}

        {aiMapping.unmapped_columns && aiMapping.unmapped_columns.length > 0 && (
          <Alert>
            <AlertCircle className="w-4 h-4" />
            <AlertTitle className="text-xs">Colonne non mappate ({aiMapping.unmapped_columns.length})</AlertTitle>
            <AlertDescription className="text-xs">
              <span className="text-muted-foreground">
                {aiMapping.unmapped_columns.join(", ")}
              </span>
            </AlertDescription>
          </Alert>
        )}

        {/* Preview: show REAL local transformation for file mode */}
        <div>
          {(() => {
            const previewRows = pendingFile && pendingRows.length > 0
              ? pendingRows.slice(0, 5).map(row => transformRow(row, aiMapping.column_mapping as Record<string, string>))
              : aiMapping.parsed_rows.slice(0, 5);
            const totalRows = pendingFile ? pendingRows.length : aiMapping.parsed_rows.length;
            const activeCols = TARGET_COLUMNS.filter(col => previewRows.some(r => r[col]));
            return (
              <>
                <h4 className="text-sm font-medium mb-2">
                  Anteprima Trasformazione Reale ({Math.min(5, totalRows)} di {totalRows} righe)
                </h4>
                <ScrollArea className="max-h-[240px]">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        {activeCols.map(col => (
                          <TableHead key={col} className="text-[10px] whitespace-nowrap">{col}</TableHead>
                        ))}
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {previewRows.map((row, i) => (
                        <TableRow key={i}>
                          {activeCols.map(col => (
                            <TableCell key={col} className="text-[10px] truncate max-w-[120px]">
                              {row[col] || "—"}
                            </TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </ScrollArea>
              </>
            );
          })()}
        </div>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label htmlFor="group-name" className="text-sm font-medium flex items-center gap-1.5">
              Nome evento / gruppo <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              placeholder={importSource === "business_card" ? "Es. Cosmoprof 2026, Fiera Milano, Meeting clienti..." : "Es. Global, Cosmoprof 2024, Pitti Uomo..."}
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              className="max-w-xs text-sm"
            />
            <p className="text-[11px] text-muted-foreground">
              {importSource === "business_card"
                ? "Questo import verrà etichettato chiaramente come Biglietti da visita nel database e nel Cockpit."
                : "Il gruppo separa logicamente questo batch dagli altri import."}
            </p>
          </div>
          <div className="flex gap-2">
            {groupName.trim() && (
              <Button onClick={onConfirm} disabled={uploading}>
                {uploading ? <Loader2 className="w-4 h-4 mr-1.5 animate-spin" /> : <CheckCircle2 className="w-4 h-4 mr-1.5" />}
                Conferma e Importa ({pendingFile ? pendingRows.length : aiMapping.parsed_rows.length} righe)
              </Button>
            )}
            <Button variant="outline" onClick={onCancel}>
              Annulla
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
