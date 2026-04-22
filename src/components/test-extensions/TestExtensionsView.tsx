/**
 * TestExtensions — Orchestrator for extension test tabs
 */
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WhatsAppTest } from "@/components/test-extensions/WhatsAppTest";
import { FireScrapeTest } from "@/components/test-extensions/FireScrapeTest";
import { LinkedInTest } from "@/components/test-extensions/LinkedInTest";

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
      <h1 className="text-2xl font-bold mb-1">🧪 Test Estensioni — WhatsApp + LinkedIn + FireScrape</h1>
      <p className="text-muted-foreground text-sm mb-6">
        Test diretto via postMessage. Nessun codice dell'app — solo comunicazione raw con le estensioni.
      </p>
      <TestExtensionsContent />
    </div>
  );
}
