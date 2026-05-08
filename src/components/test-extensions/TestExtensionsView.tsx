/**
 * TestExtensions — Orchestrator for extension test tabs
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppTest } from "@/components/test-extensions/WhatsAppTest";
import { FireScrapeTest } from "@/components/test-extensions/FireScrapeTest";
import { LinkedInTest } from "@/components/test-extensions/LinkedInTest";
import { SyncGuardIndicator } from "@/v2/ui/atoms/SyncGuardIndicator";

export function TestExtensionsContent() {
  return (
    <Tabs defaultValue="whatsapp" className="w-full">
      <TabsList className="mb-4">
        <TabsTrigger value="whatsapp">💬 WhatsApp</TabsTrigger>
        <TabsTrigger value="linkedin">💼 LinkedIn</TabsTrigger>
        <TabsTrigger value="firescrape">🔥 FireScrape</TabsTrigger>
      </TabsList>
      <TabsContent value="whatsapp"><WhatsAppTest /></TabsContent>
      <TabsContent value="linkedin"><LinkedInTest /></TabsContent>
      <TabsContent value="firescrape"><FireScrapeTest /></TabsContent>
    </Tabs>
  );
}

export default function TestExtensions() {
  return (
    <div className="min-h-screen bg-background text-foreground p-6 max-w-4xl mx-auto">
      <div className="flex items-start justify-between gap-3 mb-1">
        <h1 className="text-2xl font-bold">🧪 Test Estensioni — WhatsApp + LinkedIn + FireScrape</h1>
        <div className="flex items-center gap-2 pt-1">
          <SyncGuardIndicator channel="whatsapp" />
          <SyncGuardIndicator channel="linkedin" />
        </div>
      </div>
      <p className="text-muted-foreground text-sm mb-6">
        Test diretto via postMessage. Nessun codice dell'app — solo comunicazione raw con le estensioni.
        I badge "Controllo tempi" mostrano in tempo reale mutex e cooldown attivi sul canale.
      </p>
      <TestExtensionsContent />
    </div>
  );
}
