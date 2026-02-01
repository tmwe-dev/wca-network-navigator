import { useState, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { useQueryClient } from "@tanstack/react-query";
import { Upload, FileText, AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

interface ParsedPartner {
  company_name: string;
  country_code: string;
  country_name: string;
  city: string;
  address?: string;
  phone?: string;
  email?: string;
  website?: string;
  partner_type?: string;
  wca_id?: number;
}

interface ImportResult {
  success: number;
  failed: number;
  errors: string[];
}

const REQUIRED_COLUMNS = ["company_name", "country_code", "country_name", "city"];
const OPTIONAL_COLUMNS = ["address", "phone", "email", "website", "partner_type", "wca_id", "fax", "mobile"];

// Parse CSV content
function parseCSV(content: string): { headers: string[]; rows: string[][] } {
  const lines = content.split(/\r?\n/).filter(line => line.trim());
  if (lines.length === 0) {
    throw new Error("Il file CSV è vuoto");
  }

  const headers = lines[0].split(",").map(h => h.trim().toLowerCase().replace(/['"]/g, ""));
  const rows: string[][] = [];

  for (let i = 1; i < lines.length; i++) {
    const row: string[] = [];
    let current = "";
    let inQuotes = false;

    for (const char of lines[i]) {
      if (char === '"' && !inQuotes) {
        inQuotes = true;
      } else if (char === '"' && inQuotes) {
        inQuotes = false;
      } else if (char === "," && !inQuotes) {
        row.push(current.trim());
        current = "";
      } else {
        current += char;
      }
    }
    row.push(current.trim());

    if (row.some(cell => cell.length > 0)) {
      rows.push(row);
    }
  }

  return { headers, rows };
}

// Validate and transform row to partner object
function rowToPartner(headers: string[], row: string[]): ParsedPartner | null {
  const data: Record<string, string> = {};
  headers.forEach((header, index) => {
    data[header] = row[index] || "";
  });

  // Check required fields
  for (const required of REQUIRED_COLUMNS) {
    if (!data[required]?.trim()) {
      return null;
    }
  }

  // Validate country_code format (2 letters)
  if (!/^[A-Z]{2}$/i.test(data.country_code)) {
    return null;
  }

  return {
    company_name: data.company_name.trim(),
    country_code: data.country_code.toUpperCase().trim(),
    country_name: data.country_name.trim(),
    city: data.city.trim(),
    address: data.address?.trim() || null,
    phone: data.phone?.trim() || null,
    email: data.email?.trim() || null,
    website: data.website?.trim() || null,
    partner_type: data.partner_type?.trim() || "freight_forwarder",
    wca_id: data.wca_id ? parseInt(data.wca_id, 10) : null,
  } as ParsedPartner;
}

export function CSVImport() {
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<ParsedPartner[]>([]);
  const [importing, setImporting] = useState(false);
  const [progress, setProgress] = useState(0);
  const [result, setResult] = useState<ImportResult | null>(null);
  const queryClient = useQueryClient();

  const handleFileChange = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (!selectedFile) return;

    if (!selectedFile.name.endsWith(".csv")) {
      toast({
        title: "Formato non supportato",
        description: "Per favore seleziona un file CSV.",
        variant: "destructive",
      });
      return;
    }

    setFile(selectedFile);
    setResult(null);
    setProgress(0);

    try {
      const content = await selectedFile.text();
      const { headers, rows } = parseCSV(content);

      // Check for required columns
      const missingColumns = REQUIRED_COLUMNS.filter(col => !headers.includes(col));
      if (missingColumns.length > 0) {
        toast({
          title: "Colonne mancanti",
          description: `Il file deve contenere: ${missingColumns.join(", ")}`,
          variant: "destructive",
        });
        setFile(null);
        return;
      }

      // Parse and preview first 10 rows
      const parsed: ParsedPartner[] = [];
      for (const row of rows.slice(0, 100)) {
        const partner = rowToPartner(headers, row);
        if (partner) {
          parsed.push(partner);
        }
      }

      setPreview(parsed.slice(0, 10));

      toast({
        title: "File caricato",
        description: `${rows.length} righe trovate, ${parsed.length} valide per l'importazione.`,
      });
    } catch (error) {
      console.error("CSV parse error:", error);
      toast({
        title: "Errore di parsing",
        description: "Impossibile leggere il file CSV. Controlla il formato.",
        variant: "destructive",
      });
      setFile(null);
    }
  }, []);

  const handleImport = useCallback(async () => {
    if (!file) return;

    setImporting(true);
    setProgress(0);
    setResult(null);

    try {
      const content = await file.text();
      const { headers, rows } = parseCSV(content);

      const partners: ParsedPartner[] = [];
      const errors: string[] = [];

      // Parse all rows
      rows.forEach((row, index) => {
        const partner = rowToPartner(headers, row);
        if (partner) {
          partners.push(partner);
        } else {
          errors.push(`Riga ${index + 2}: dati mancanti o non validi`);
        }
      });

      if (partners.length === 0) {
        toast({
          title: "Nessun partner valido",
          description: "Non ci sono dati validi da importare.",
          variant: "destructive",
        });
        setImporting(false);
        return;
      }

      // Import in batches of 50
      const batchSize = 50;
      let successCount = 0;
      let failedCount = 0;

      for (let i = 0; i < partners.length; i += batchSize) {
        const batch = partners.slice(i, i + batchSize);
        
        const { data, error } = await supabase
          .from("partners")
          .insert(batch.map(p => ({
            company_name: p.company_name,
            country_code: p.country_code,
            country_name: p.country_name,
            city: p.city,
            address: p.address,
            phone: p.phone,
            email: p.email,
            website: p.website,
            partner_type: p.partner_type as any,
            wca_id: p.wca_id,
            is_active: true,
          })))
          .select();

        if (error) {
          console.error("Batch insert error:", error);
          failedCount += batch.length;
          errors.push(`Batch ${Math.floor(i / batchSize) + 1}: ${error.message}`);
        } else {
          successCount += data?.length || 0;
        }

        setProgress(Math.round(((i + batch.length) / partners.length) * 100));
      }

      setResult({
        success: successCount,
        failed: failedCount,
        errors: errors.slice(0, 10), // Limit errors shown
      });

      // Invalidate queries to refresh data
      queryClient.invalidateQueries({ queryKey: ["partners"] });
      queryClient.invalidateQueries({ queryKey: ["partner-stats"] });

      toast({
        title: "Importazione completata",
        description: `${successCount} partner importati con successo.`,
      });
    } catch (error) {
      console.error("Import error:", error);
      toast({
        title: "Errore di importazione",
        description: "Si è verificato un errore durante l'importazione.",
        variant: "destructive",
      });
    } finally {
      setImporting(false);
    }
  }, [file, queryClient]);

  const downloadTemplate = useCallback(() => {
    const headers = [...REQUIRED_COLUMNS, ...OPTIONAL_COLUMNS].join(",");
    const exampleRow = [
      "Example Company Ltd",
      "US",
      "United States",
      "New York",
      "123 Main St",
      "+1-555-0100",
      "info@example.com",
      "www.example.com",
      "freight_forwarder",
      "12345",
      "",
      ""
    ].join(",");

    const csv = `${headers}\n${exampleRow}`;
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "partner-import-template.csv";
    a.click();
    URL.revokeObjectURL(url);
  }, []);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Upload className="w-5 h-5" />
          Importa Partner da CSV
        </CardTitle>
        <CardDescription>
          Carica un file CSV con i dati dei partner. Colonne richieste: company_name, country_code, country_name, city
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Template download */}
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={downloadTemplate}>
            <FileText className="w-4 h-4 mr-2" />
            Scarica Template CSV
          </Button>
          <span className="text-sm text-muted-foreground">
            Usa questo template come riferimento
          </span>
        </div>

        {/* File input */}
        <div className="space-y-2">
          <Label htmlFor="csv-file">File CSV</Label>
          <Input
            id="csv-file"
            type="file"
            accept=".csv"
            onChange={handleFileChange}
            disabled={importing}
          />
        </div>

        {/* Preview */}
        {preview.length > 0 && (
          <div className="space-y-2">
            <Label>Anteprima (prime 10 righe)</Label>
            <ScrollArea className="h-48 border rounded-md">
              <div className="p-2 space-y-1">
                {preview.map((partner, index) => (
                  <div
                    key={index}
                    className="text-sm p-2 bg-muted/50 rounded flex items-center justify-between"
                  >
                    <div>
                      <span className="font-medium">{partner.company_name}</span>
                      <span className="text-muted-foreground ml-2">
                        {partner.city}, {partner.country_name} ({partner.country_code})
                      </span>
                    </div>
                    {partner.email && (
                      <span className="text-xs text-muted-foreground">{partner.email}</span>
                    )}
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}

        {/* Progress */}
        {importing && (
          <div className="space-y-2">
            <div className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              <span className="text-sm">Importazione in corso...</span>
            </div>
            <Progress value={progress} className="h-2" />
          </div>
        )}

        {/* Result */}
        {result && (
          <Alert variant={result.failed > 0 ? "destructive" : "default"}>
            {result.failed > 0 ? (
              <AlertCircle className="h-4 w-4" />
            ) : (
              <CheckCircle2 className="h-4 w-4" />
            )}
            <AlertTitle>
              {result.failed > 0 ? "Importazione parziale" : "Importazione completata"}
            </AlertTitle>
            <AlertDescription>
              <p>{result.success} partner importati con successo.</p>
              {result.failed > 0 && <p>{result.failed} partner non importati.</p>}
              {result.errors.length > 0 && (
                <ul className="mt-2 text-xs space-y-1">
                  {result.errors.map((err, i) => (
                    <li key={i}>• {err}</li>
                  ))}
                </ul>
              )}
            </AlertDescription>
          </Alert>
        )}

        {/* Import button */}
        <Button
          onClick={handleImport}
          disabled={!file || importing || preview.length === 0}
          className="w-full"
        >
          {importing ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Importando...
            </>
          ) : (
            <>
              <Upload className="w-4 h-4 mr-2" />
              Importa {preview.length > 0 ? `(${preview.length}+ partner)` : ""}
            </>
          )}
        </Button>
      </CardContent>
    </Card>
  );
}
