import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Upload, Users, FileSpreadsheet, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import Papa from "papaparse";

interface StepImportProps {
  onFinish: () => void;
  onSkip: () => void;
  loading?: boolean;
}

interface ParsedRow {
  [key: string]: string;
}

const FIELD_MAP: Record<string, string[]> = {
  name: ["name", "nome", "contact_name", "full_name", "fullname"],
  surname: ["surname", "cognome", "last_name", "lastname"],
  email: ["email", "e-mail", "mail", "email_address"],
  phone: ["phone", "telefono", "tel", "mobile", "cellulare"],
  company_name: ["company", "azienda", "company_name", "società", "societa"],
  country: ["country", "paese", "nation", "nazione", "country_code"],
};

function autoMapColumn(header: string): string | null {
  const h = header.toLowerCase().trim();
  for (const [field, aliases] of Object.entries(FIELD_MAP)) {
    if (aliases.includes(h)) return field;
  }
  return null;
}

export function StepImport({ onFinish, onSkip, loading }: StepImportProps) {
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [importing, setImporting] = useState(false);

  const handleFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const data = result.data as ParsedRow[];
        const hdrs = result.meta.fields ?? [];
        setHeaders(hdrs);
        setRows(data);
        const autoMap: Record<string, string> = {};
        for (const h of hdrs) {
          const mapped = autoMapColumn(h);
          if (mapped) autoMap[h] = mapped;
        }
        setMapping(autoMap);
      },
    });
  }, []);

  const handleImport = async () => {
    setImporting(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");

      const reverseMap: Record<string, string> = {};
      for (const [csvCol, dbField] of Object.entries(mapping)) {
        reverseMap[dbField] = csvCol;
      }

      const contacts = rows.map(row => ({
        user_id: user.id,
        name: row[reverseMap.name] || row[reverseMap.surname]
          ? `${row[reverseMap.name] || ""} ${row[reverseMap.surname] || ""}`.trim()
          : null,
        email: row[reverseMap.email] || null,
        phone: row[reverseMap.phone] || null,
        company_name: row[reverseMap.company_name] || null,
        country_code: row[reverseMap.country] || null,
        source: "csv_onboarding",
        lead_status: "new" as const,
      })).filter(c => c.email || c.name);

      if (contacts.length === 0) {
        toast.error("Nessun contatto valido trovato");
        return;
      }

      const BATCH = 50;
      for (let i = 0; i < contacts.length; i += BATCH) {
        const batch = contacts.slice(i, i + BATCH);
        const { error } = await supabase.from("imported_contacts").insert(batch as never);
        if (error) throw error;
      }

      toast.success(`${contacts.length} contatti importati`);
      onFinish();
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : "Errore importazione");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Users className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Importa Contatti</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Carica un file CSV con i tuoi contatti. Puoi anche saltare questo passaggio.
        </p>
      </div>

      {rows.length === 0 ? (
        <label className="flex flex-col items-center justify-center border-2 border-dashed border-border/50 rounded-xl p-8 cursor-pointer hover:border-primary/50 transition-colors">
          <Upload className="w-8 h-8 text-muted-foreground mb-2" />
          <span className="text-sm text-muted-foreground">Trascina un file CSV o clicca per selezionare</span>
          <input type="file" accept=".csv" className="hidden" onChange={handleFile} />
        </label>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            <span className="text-sm font-medium">{rows.length} righe trovate</span>
            <Badge variant="outline" className="text-xs">{headers.length} colonne</Badge>
          </div>

          {/* Preview */}
          <div className="overflow-x-auto border rounded-lg max-h-40">
            <table className="text-xs w-full">
              <thead className="bg-muted/30">
                <tr>
                  {headers.slice(0, 6).map(h => (
                    <th key={h} className="px-2 py-1.5 text-left font-medium text-muted-foreground">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.slice(0, 3).map((row, i) => (
                  <tr key={i} className="border-t border-border/30">
                    {headers.slice(0, 6).map(h => (
                      <td key={h} className="px-2 py-1 truncate max-w-[120px]">{row[h]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Auto-mapped fields */}
          <div className="flex flex-wrap gap-1">
            {Object.entries(mapping).map(([csvCol, dbField]) => (
              <Badge key={csvCol} variant="secondary" className="text-[10px]">
                {csvCol} → {dbField}
              </Badge>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-2">
        <Button variant="outline" onClick={onSkip} className="flex-1" disabled={importing || loading}>
          Salta
        </Button>
        {rows.length > 0 ? (
          <Button onClick={handleImport} className="flex-1" disabled={importing}>
            {importing ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Importando...</> : `Importa ${rows.length} contatti`}
          </Button>
        ) : (
          <Button onClick={onFinish} className="flex-1" disabled={loading}>
            Continua senza importare
          </Button>
        )}
      </div>
    </div>
  );
}
