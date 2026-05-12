/**
 * EmailLabPage — laboratorio per vedere "davanti agli occhi" il lavoro degli
 * agenti sulle email: produzione iterativa (genera → migliora → migliora) e
 * smistamento Funnemail (Round B).
 *
 * Route: /v2/email-lab
 */
import * as React from "react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FlaskConical, Wand2, Inbox } from "lucide-react";
import { ProductionTab } from "./email-lab/ProductionTab";
import { FunnemailTab } from "./email-lab/FunnemailTab";
import { ToolsBanner } from "./email-lab/ToolsBanner";

export function EmailLabPage(): React.ReactElement {
  return (
    <div className="flex h-full flex-col gap-3 p-4">
      <header className="flex items-center gap-2">
        <FlaskConical className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-base font-semibold tracking-tight">Email Lab</h1>
          <p className="text-xs text-foreground/65">
            Vedi in tempo reale come gli agenti producono e smistano le email, versione dopo versione.
          </p>
        </div>
      </header>

      <ToolsBanner />

      <Tabs defaultValue="production" className="flex min-h-0 flex-1 flex-col">
        <TabsList className="self-start">
          <TabsTrigger value="production" className="gap-1.5">
            <Wand2 className="h-3.5 w-3.5" />
            Produzione email
          </TabsTrigger>
          <TabsTrigger value="funnemail" className="gap-1.5">
            <Inbox className="h-3.5 w-3.5" />
            Smistamento Funnemail
          </TabsTrigger>
        </TabsList>
        <TabsContent value="production" className="mt-3 min-h-0 flex-1">
          <ProductionTab />
        </TabsContent>
        <TabsContent value="funnemail" className="mt-3 min-h-0 flex-1 overflow-auto">
          <FunnemailTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default EmailLabPage;