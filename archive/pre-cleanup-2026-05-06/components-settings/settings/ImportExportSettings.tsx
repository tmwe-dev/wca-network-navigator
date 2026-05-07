import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Upload, Globe } from "lucide-react";
import { CSVImport } from "@/components/partners/CSVImport";
import { WCAScraper } from "@/components/partners/WCAScraper";

export function ImportExportSettings() {
  return (
    <Tabs defaultValue="import" className="space-y-6">
      <TabsList>
        <TabsTrigger value="import" className="flex items-center gap-2"><Upload className="w-4 h-4" /> Importa</TabsTrigger>
        <TabsTrigger value="wca-download" className="flex items-center gap-2"><Globe className="w-4 h-4" /> Scarica da WCA</TabsTrigger>
      </TabsList>

      <TabsContent value="import"><CSVImport /></TabsContent>
      <TabsContent value="wca-download"><WCAScraper /></TabsContent>
    </Tabs>
  );
}
