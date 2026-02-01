import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Download, FileSpreadsheet, FileText, File } from "lucide-react";
import { usePartners } from "@/hooks/usePartners";
import { toast } from "@/hooks/use-toast";

const EXPORT_FIELDS = [
  { id: "company_name", label: "Company Name" },
  { id: "wca_id", label: "WCA ID" },
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
  const { data: partners } = usePartners();

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
        title: "No data to export",
        description: "There are no partners to export.",
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
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `wca-partners-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: `Exported ${partners.length} partners to CSV.`,
    });
  };

  const exportJSON = () => {
    if (!partners || partners.length === 0) {
      toast({
        title: "No data to export",
        description: "There are no partners to export.",
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
    a.click();
    URL.revokeObjectURL(url);

    toast({
      title: "Export complete",
      description: `Exported ${partners.length} partners to JSON.`,
    });
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Export Data</h1>
        <p className="text-muted-foreground mt-1">
          Export your partner data in various formats
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Field Selection */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Select Fields</CardTitle>
            <CardDescription>
              Choose which fields to include in your export
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
                Select All
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSelectedFields([])}
              >
                Clear All
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Export Options */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Export Format</CardTitle>
            <CardDescription>
              {partners?.length || 0} partners will be exported
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={exportCSV}
              disabled={selectedFields.length === 0}
            >
              <FileSpreadsheet className="w-8 h-8 mr-4 text-green-600" />
              <div className="text-left">
                <p className="font-medium">CSV (Excel compatible)</p>
                <p className="text-sm text-muted-foreground">
                  Best for spreadsheet applications
                </p>
              </div>
            </Button>

            <Button
              variant="outline"
              className="w-full justify-start h-auto py-4"
              onClick={exportJSON}
              disabled={selectedFields.length === 0}
            >
              <File className="w-8 h-8 mr-4 text-blue-600" />
              <div className="text-left">
                <p className="font-medium">JSON</p>
                <p className="text-sm text-muted-foreground">
                  Best for developers and APIs
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
                  Coming soon
                </p>
              </div>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
