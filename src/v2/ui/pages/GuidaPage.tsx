/**
 * GuidaPage — Interactive operational guide
 */
import * as React from "react";
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { BookOpen, ChevronDown, ChevronRight } from "lucide-react";

interface GuidaSection {
  title: string;
  content: string;
}

const SECTIONS: GuidaSection[] = [
  { title: "Introduzione", content: "WCA Network Navigator è una piattaforma per la gestione dei partner logistici delle reti WCA. Consente di scaricare, indicizzare e gestire oltre 10.000 partner in 200+ paesi." },
  { title: "Dashboard", content: "La dashboard mostra una panoramica dei KPI principali: partner totali, email inviate, campagne attive, agenti operativi." },
  { title: "Network", content: "La sezione Network permette di esplorare i partner per paese, network e stato. Include filtri avanzati, export Excel e mappa globale." },
  { title: "CRM e Contatti", content: "Il CRM gestisce i contatti importati e i partner WCA. Include drawer dettaglio, interazioni, lead status e matching automatico." },
  { title: "Email e Outreach", content: "Il composer email supporta HTML WYSIWYG, variabili template, AI generation e campagne con coda di invio monitorata." },
  { title: "Agenti AI", content: "Gli agenti AI automatizzano operazioni come follow-up, analisi partner, email drafting. Ogni agente ha competenze e territori configurabili." },
  { title: "Import e Acquisizione", content: "L'import supporta CSV/Excel con mappatura campi AI. L'acquisizione scarica automaticamente i profili WCA per paese." },
  { title: "Knowledge Base", content: "La KB contiene dottrina, procedure e fatti appresi. È usata dal RAG AI per contestualizzare le risposte degli agenti." },
  { title: "Impostazioni", content: "Configurazione SMTP, credenziali WCA, AI, operatori, timing agenti, abbonamento e crediti." },
];

export function GuidaPage(): React.ReactElement {
  const [openSections, setOpenSections] = useState<Set<number>>(new Set());

  const toggle = (idx: number) => {
    setOpenSections((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx); else next.add(idx);
      return next;
    });
  };

  return (
    <div className="h-full flex flex-col gap-4 p-4 overflow-auto">
      <div>
        <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
          <BookOpen className="h-5 w-5" /> Guida Operativa
        </h1>
        <p className="text-xs text-muted-foreground">Documentazione interattiva della piattaforma</p>
      </div>

      <div className="space-y-2">
        {SECTIONS.map((section, idx) => (
          <Collapsible key={idx} open={openSections.has(idx)} onOpenChange={() => toggle(idx)}>
            <Card>
              <CollapsibleTrigger className="w-full">
                <CardHeader className="pb-2 flex flex-row items-center justify-between">
                  <CardTitle className="text-sm">{section.title}</CardTitle>
                  {openSections.has(idx) ? <ChevronDown className="h-4 w-4" /> : <ChevronRight className="h-4 w-4" />}
                </CardHeader>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CardContent className="pt-0">
                  <p className="text-sm text-muted-foreground">{section.content}</p>
                </CardContent>
              </CollapsibleContent>
            </Card>
          </Collapsible>
        ))}
      </div>
    </div>
  );
}
