import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, FileSpreadsheet, FileText, File, Upload, Globe } from "lucide-react";
import { usePartners } from "@/hooks/usePartners";
import { toast } from "@/hooks/use-toast";
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

export default function Export() {
  const [selectedFields, setSelectedFields] = useState<string[]>(
    EXPORT_FIELDS.map((f) => f.id)
  );
  const { data: partners, isLoading } = usePartners();

  const toggleField = (fieldId: string) => {
    setSelectedFields((prev) =>
      prev.includes(fieldId)
        ? prev.filter((f) => f !== fieldId)
        : [...prev, fieldId]
    );
  };

  const exportCSV = () => {
    if (!partners || partners.length === 0) {
      toast({
        title: "Nessun dato da esportare",
        description: "Non ci sono partner da esportare.",
        variant: "destructive",
      });
      return;
    }

    const headers = selectedFields.join(",");
    const rows = partners.map((partner) =>
      selectedFields
        .map((field) => {
          const value = (partner as any)[field];
          if (value === null || value === undefined) return "";
          return `"${String(value).replace(/"/g, '""')}"`;
        })
        .join(",")
    );

    const csv = [headers, ...rows].join("\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wca-partners-${new Date().toISOString().split("T")[0]}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export completato",
      description: `${partners.length} partner esportati in CSV.`,
    });
  };

  const exportJSON = () => {
    if (!partners || partners.length === 0) {
      toast({
        title: "Nessun dato da esportare",
        description: "Non ci sono partner da esportare.",
        variant: "destructive",
      });
      return;
    }

    const data = partners.map((partner) => {
      const filtered: Record<string, any> = {};
      selectedFields.forEach((field) => {
        filtered[field] = (partner as any)[field];
      });
      return filtered;
    });

    const json = JSON.stringify(data, null, 2);
    const blob = new Blob([json], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wca-partners-${new Date().toISOString().split("T")[0]}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    toast({
      title: "Export completato",
      description: `${partners.length} partner esportati in JSON.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Import / Export</h1>
        <p className="text-muted-foreground mt-1">
          Importa partner da CSV o esporta i tuoi dati in vari formati
        </p>
      </div>

      <Tabs defaultValue="import" className="space-y-6">
        <TabsList>
          <TabsTrigger value="import" className="flex items-center gap-2">
            <Upload className="w-4 h-4" />
            Importa
          </TabsTrigger>
          <TabsTrigger value="export" className="flex items-center gap-2">
            <Download className="w-4 h-4" />
            Esporta
          </TabsTrigger>
          <TabsTrigger value="wca" className="flex items-center gap-2">
            <Globe className="w-4 h-4" />
            Scarica da WCA
          </TabsTrigger>
        </TabsList>

        <TabsContent value="import">
          <CSVImport />
        </TabsContent>

        <TabsContent value="export">
          <div className="grid gap-6 lg:grid-cols-2">
            {/* Field Selection */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Seleziona Campi</CardTitle>
                <CardDescription>
                  Scegli quali campi includere nell'export
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid gap-3 sm:grid-cols-2">
                  {EXPORT_FIELDS.map((field) => (
                    <div key={field.id} className="flex items-center space-x-2">
                      <Checkbox
                        id={field.id}
                        checked={selectedFields.includes(field.id)}
                        onCheckedChange={() => toggleField(field.id)}
                      />
                      <Label htmlFor={field.id} className="cursor-pointer">
                        {field.label}
                      </Label>
                    </div>
                  ))}
                </div>
                <div className="flex items-center gap-2 mt-4 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFields(EXPORT_FIELDS.map((f) => f.id))}
                  >
                    Seleziona Tutto
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSelectedFields([])}
                  >
                    Deseleziona Tutto
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* Export Options */}
            <Card>
              <CardHeader>
                <CardTitle className="text-lg">Formato Export</CardTitle>
                <CardDescription>
                  {isLoading ? "Caricamento..." : `${partners?.length || 0} partner verranno esportati`}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={exportCSV}
                  disabled={selectedFields.length === 0 || isLoading}
                >
                  <FileSpreadsheet className="w-8 h-8 mr-4 text-green-600" />
                  <div className="text-left">
                    <p className="font-medium">CSV (Excel compatibile)</p>
                    <p className="text-sm text-muted-foreground">
                      Ideale per fogli di calcolo
                    </p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  onClick={exportJSON}
                  disabled={selectedFields.length === 0 || isLoading}
                >
                  <File className="w-8 h-8 mr-4 text-blue-600" />
                  <div className="text-left">
                    <p className="font-medium">JSON</p>
                    <p className="text-sm text-muted-foreground">
                      Ideale per sviluppatori e API
                    </p>
                  </div>
                </Button>

                <Button
                  variant="outline"
                  className="w-full justify-start h-auto py-4"
                  disabled
                >
                  <FileText className="w-8 h-8 mr-4 text-red-600" />
                  <div className="text-left">
                    <p className="font-medium">PDF Report</p>
                    <p className="text-sm text-muted-foreground">
                      Prossimamente
                    </p>
                  </div>
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="wca">
          <WCAScraper />
        </TabsContent>
      </Tabs>
    </div>
  );
}
