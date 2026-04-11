/**
 * ImportPage — CSV import wizard
 */
import * as React from "react";
import { useImportV2 } from "@/v2/hooks/useImportV2";
import { useImportLogsV2 } from "@/v2/hooks/useImportLogsV2";
import { Button } from "../atoms/Button";
import { StatusBadge } from "../atoms/StatusBadge";
import { Upload, ArrowRight, Check } from "lucide-react";

export function ImportPage(): React.ReactElement {
  const imp = useImportV2();
  const { data: logs } = useImportLogsV2();

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Import</h1>
        <p className="text-sm text-muted-foreground">Importazione contatti da CSV.</p>
      </div>

      {/* Step indicator */}
      <div className="flex items-center gap-2 text-sm">
        {[1, 2, 3, 4].map((s) => (
          <React.Fragment key={s}>
            <span className={`rounded-full w-7 h-7 flex items-center justify-center text-xs font-bold ${imp.step >= s ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground"}`}>
              {s}
            </span>
            {s < 4 ? <ArrowRight className="h-3 w-3 text-muted-foreground" /> : null}
          </React.Fragment>
        ))}
      </div>

      {/* Step 1: Upload */}
      {imp.step === 1 ? (
        <div
          className="border-2 border-dashed rounded-lg p-12 text-center cursor-pointer hover:border-primary/50 transition-colors"
          onDragOver={(e) => e.preventDefault()}
          onDrop={(e) => { e.preventDefault(); const f = e.dataTransfer.files[0]; if (f) imp.parseCSV(f); }}
          onClick={() => {
            const input = document.createElement("input");
            input.type = "file";
            input.accept = ".csv";
            input.onchange = (e) => { const f = (e.target as HTMLInputElement).files?.[0]; if (f) imp.parseCSV(f); };
            input.click();
          }}
        >
          <Upload className="h-10 w-10 mx-auto text-muted-foreground mb-3" />
          <p className="font-medium text-foreground">Trascina un file CSV o clicca per selezionare</p>
          <p className="text-xs text-muted-foreground mt-1">Formato supportato: .csv con intestazioni</p>
        </div>
      ) : null}

      {/* Step 2: Column mapping */}
      {imp.step === 2 ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Mappatura colonne — {imp.fileName}</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Colonna CSV</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Campo destinazione</th>
                </tr>
              </thead>
              <tbody>
                {imp.columns.map((col) => (
                  <tr key={col.csvHeader} className="border-t">
                    <td className="px-4 py-2 font-mono text-xs text-foreground">{col.csvHeader}</td>
                    <td className="px-4 py-2">
                      <select
                        className="w-full rounded-md border bg-background px-2 py-1 text-sm text-foreground"
                        value={col.mappedTo ?? ""}
                        onChange={(e) => imp.updateMapping(col.csvHeader, e.target.value || null)}
                      >
                        <option value="">— Ignora —</option>
                        {imp.targetFields.map((tf) => (
                          <option key={tf} value={tf}>{tf}</option>
                        ))}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => imp.setStep(1)}>Indietro</Button>
            <Button onClick={() => imp.setStep(3)}>Anteprima</Button>
          </div>
        </div>
      ) : null}

      {/* Step 3: Preview */}
      {imp.step === 3 ? (
        <div className="space-y-4">
          <h3 className="font-semibold text-foreground">Anteprima — {imp.rawRows.length} righe</h3>
          <div className="border rounded-lg overflow-auto max-h-80">
            <table className="w-full text-xs">
              <thead className="bg-muted/50 sticky top-0">
                <tr>
                  {imp.columns.filter((c) => c.mappedTo).map((c) => (
                    <th key={c.csvHeader} className="text-left px-3 py-2 font-medium text-muted-foreground">{c.mappedTo}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {imp.rawRows.slice(0, 10).map((row, i) => (
                  <tr key={i} className="border-t">
                    {imp.columns.filter((c) => c.mappedTo).map((c) => (
                      <td key={c.csvHeader} className="px-3 py-1.5 text-foreground truncate max-w-[200px]">{row[c.csvHeader]}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => imp.setStep(2)}>Indietro</Button>
            <Button onClick={imp.executeImport} isLoading={imp.importing}>
              Importa {imp.rawRows.length} righe
            </Button>
          </div>
        </div>
      ) : null}

      {/* Step 4: Result */}
      {imp.step === 4 && imp.result ? (
        <div className="text-center py-8 space-y-3">
          <Check className="h-12 w-12 mx-auto text-green-500" />
          <h3 className="text-xl font-bold text-foreground">Importazione completata</h3>
          <p className="text-sm text-muted-foreground">
            {imp.result.imported} contatti importati, {imp.result.errors} errori
          </p>
          <Button variant="outline" onClick={() => { imp.setStep(1); }}>Nuova importazione</Button>
        </div>
      ) : null}

      {/* Import history */}
      {logs && logs.length > 0 ? (
        <div className="space-y-3">
          <h3 className="font-semibold text-foreground">Storico importazioni</h3>
          <div className="border rounded-lg overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-muted/50">
                <tr>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">File</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Righe</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Stato</th>
                  <th className="text-left px-4 py-2 font-medium text-muted-foreground">Data</th>
                </tr>
              </thead>
              <tbody>
                {logs.map((l) => (
                  <tr key={l.id} className="border-t">
                    <td className="px-4 py-2 text-foreground">{l.fileName}</td>
                    <td className="px-4 py-2 text-foreground">{l.importedRows}/{l.totalRows}</td>
                    <td className="px-4 py-2">
                      <StatusBadge
                        status={l.status === "completed" ? "success" : l.status === "processing" ? "warning" : "error"}
                        label={l.status}
                      />
                    </td>
                    <td className="px-4 py-2 text-muted-foreground text-xs">{new Date(l.createdAt).toLocaleDateString("it")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}
