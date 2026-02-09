import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Globe, ListOrdered, Download, Sparkles } from "lucide-react";
import { NetworkAnalysis } from "@/components/download/NetworkAnalysis";
import { DownloadQueue } from "@/components/download/DownloadQueue";
import { DownloadRunner } from "@/components/download/DownloadRunner";
import { BatchEnrichment } from "@/components/download/BatchEnrichment";

export default function DownloadManagement() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Download Management</h1>
        <p className="text-muted-foreground">
          Processo strutturato di acquisizione partner: analisi network, coda download, esecuzione e arricchimento.
        </p>
      </div>

      <Tabs defaultValue="network" className="space-y-4">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="network" className="flex items-center gap-1.5">
            <Globe className="w-4 h-4" />
            <span className="hidden sm:inline">Network</span>
          </TabsTrigger>
          <TabsTrigger value="queue" className="flex items-center gap-1.5">
            <ListOrdered className="w-4 h-4" />
            <span className="hidden sm:inline">Coda</span>
          </TabsTrigger>
          <TabsTrigger value="download" className="flex items-center gap-1.5">
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">Download</span>
          </TabsTrigger>
          <TabsTrigger value="enrichment" className="flex items-center gap-1.5">
            <Sparkles className="w-4 h-4" />
            <span className="hidden sm:inline">Arricchimento</span>
          </TabsTrigger>
        </TabsList>

        <TabsContent value="network">
          <NetworkAnalysis />
        </TabsContent>
        <TabsContent value="queue">
          <DownloadQueue />
        </TabsContent>
        <TabsContent value="download">
          <DownloadRunner />
        </TabsContent>
        <TabsContent value="enrichment">
          <BatchEnrichment />
        </TabsContent>
      </Tabs>
    </div>
  );
}
