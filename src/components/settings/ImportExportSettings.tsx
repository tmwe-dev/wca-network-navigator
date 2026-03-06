import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Upload, Download, FileSpreadsheet, File, FileText, Globe,
} from "lucide-react";
import { toast as toastHook } from "@/hooks/use-toast";
import { usePartners } from "@/hooks/usePartners";
import { CSVImport } from "@/components/partners/CSVImport";
import { WCAScraper } from "@/components/partners/WCAScraper";

const EXPORT_FIELDS = [
  { id: "company_name", label: "Company Name" },
  { id: "wca_id", label: "WCA ID" },
  { id: "country_code", label: "Country Code" },
  { id: "country_name", label: "Country" },
  { id: "city", label: "City" },
  { id: "address", label: "Address" },
  { id: "phone", label: "Phone" },
  { id: "email", label: "Email" },
  { id: "website", label: "Website" },
  { id: "partner_type", label: "Partner Type" },
  { id: "member_since", label: "Member Since" },
  { id: "membership_expires", label: "Membership Expires" },
];

export function ImportExportSettings() {
  const [selectedFields, setSelectedFields] = useState<string[]>(EXPORT_FIELDS.map((f) => f.id));
  const { data: partners, isLoading: loadingPartners } = usePartners();

  const toggleField = (id: string) =>
    setSelectedFields((p) => (p.includes(id) ? p.filter((f) => f !== id) : [...p, id]));

  const downloadBlob = (content: string, type: string, ext: string) => {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wca-partners-${new Date().toISOString().split("T")[0]}.${ext}`;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const exportCSV = () => {
    if (!partners?.length) { toastHook({ title: "Nessun dato", variant: "destructive" }); return; }
    const headers = selectedFields.join(",");
    const rows = partners.map((p) => selectedFields.map((f) => { const v = (p as any)[f]; return v == null ? "" : `"${String(v).replace(/"/g, '""')}"`; }).join(","));
    downloadBlob([headers, ...rows].join("\n"), "text/csv;charset=utf-8;", "csv");
    toastHook({ title: "Export completato", description: `${partners.length} partner esportati in CSV.` });
  };

  const exportJSON = () => {
    if (!partners?.length) { toastHook({ title: "Nessun dato", variant: "destructive" }); return; }
    const data = partners.map((p) => { const o: Record<string, any> = {}; selectedFields.forEach((f) => { o[f] = (p as any)[f]; }); return o; });
    downloadBlob(JSON.stringify(data, null, 2), "application/json", "json");
    toastHook({ title: "Export completato", description: `${partners.length} partner esportati in JSON.` });
  };

  return (
    <Tabs defaultValue="import" className="space-y-6">
      <TabsList>
        <TabsTrigger value="import" className="flex items-center gap-2"><Upload className="w-4 h-4" /> Importa</TabsTrigger>
        <TabsTrigger value="export" className="flex items-center gap-2"><Download className="w-4 h-4" /> Esporta</TabsTrigger>
        <TabsTrigger value="wca-download" className="flex items-center gap-2"><Globe className="w-4 h-4" /> Scarica da WCA</TabsTrigger>
      </TabsList>

      <TabsContent value="import"><CSVImport /></TabsContent>

      <TabsContent value="export">
        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Seleziona Campi</CardTitle>
              <CardDescription>Scegli quali campi includere nell'export</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid gap-3 sm:grid-cols-2">
                {EXPORT_FIELDS.map((field) => (
                  <div key={field.id} className="flex items-center space-x-2">
                    <Checkbox id={field.id} checked={selectedFields.includes(field.id)} onCheckedChange={() => toggleField(field.id)} />
                    <Label htmlFor={field.id} className="cursor-pointer">{field.label}</Label>
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                <Button variant="outline" size="sm" onClick={() => setSelectedFields(EXPORT_FIELDS.map((f) => f.id))}>Seleziona Tutto</Button>
                <Button variant="outline" size="sm" onClick={() => setSelectedFields([])}>Deseleziona Tutto</Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Formato Export</CardTitle>
              <CardDescription>{loadingPartners ? "Caricamento..." : `${partners?.length || 0} partner verranno esportati`}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={exportCSV} disabled={selectedFields.length === 0 || loadingPartners}>
                <FileSpreadsheet className="w-8 h-8 mr-4 text-primary" />
                <div className="text-left">
                  <p className="font-medium">CSV (Excel compatibile)</p>
                  <p className="text-sm text-muted-foreground">Ideale per fogli di calcolo</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-4" onClick={exportJSON} disabled={selectedFields.length === 0 || loadingPartners}>
                <File className="w-8 h-8 mr-4 text-primary" />
                <div className="text-left">
                  <p className="font-medium">JSON</p>
                  <p className="text-sm text-muted-foreground">Ideale per sviluppatori e API</p>
                </div>
              </Button>
              <Button variant="outline" className="w-full justify-start h-auto py-4" disabled>
                <FileText className="w-8 h-8 mr-4 text-muted-foreground" />
                <div className="text-left">
                  <p className="font-medium">PDF Report</p>
                  <p className="text-sm text-muted-foreground">Prossimamente</p>
                </div>
              </Button>
            </CardContent>
          </Card>
        </div>
      </TabsContent>

      <TabsContent value="wca-download"><WCAScraper /></TabsContent>
    </Tabs>
  );
}
