/**
 * DPAPage — GDPR Data Processing Agreement + SOC2 starter checklist
 */
import * as React from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Shield, FileText, Download, Lock, Server, Eye, Trash2 } from "lucide-react";

const SOC2_CHECKLIST = [
  { label: "Crittografia dati at-rest (AES-256)", done: true },
  { label: "Crittografia in-transit (TLS 1.3)", done: true },
  { label: "Autenticazione multi-fattore disponibile", done: true },
  { label: "Row Level Security su tutte le tabelle", done: true },
  { label: "Audit trail completo delle azioni", done: true },
  { label: "Backup automatici giornalieri", done: true },
  { label: "Logging strutturato edge functions", done: true },
  { label: "Controllo accessi basato su ruoli (RBAC)", done: true },
  { label: "Gestione sicura dei segreti (Vault)", done: true },
  { label: "Penetration test annuale", done: false },
  { label: "Security review code trimestrale", done: false },
  { label: "Incident response plan documentato", done: false },
];

const DPA_SECTIONS = [
  {
    title: "1. Oggetto e Durata",
    content: "Il presente Accordo sul Trattamento dei Dati (DPA) disciplina il trattamento dei dati personali da parte di WCA Network Navigator ('Responsabile del Trattamento') per conto del Cliente ('Titolare del Trattamento'). Il trattamento ha durata pari al contratto di servizio.",
  },
  {
    title: "2. Natura e Finalità del Trattamento",
    content: "I dati vengono trattati esclusivamente per la fornitura del servizio CRM: gestione partner commerciali, invio comunicazioni commerciali autorizzate, analisi AI dei profili aziendali pubblici, e generazione di report.",
  },
  {
    title: "3. Categorie di Dati",
    content: "Dati aziendali: ragione sociale, indirizzo, email aziendali, numeri di telefono aziendali, siti web. Dati di contatto: nome, cognome, ruolo, email professionale, telefono diretto. NON vengono trattati dati sensibili (art. 9 GDPR).",
  },
  {
    title: "4. Misure Tecniche e Organizzative",
    content: "Crittografia AES-256 at-rest e TLS 1.3 in-transit. Row Level Security a livello database. Autenticazione con hash non reversibile. Backup giornalieri con retention 30 giorni. Logging strutturato con retention 90 giorni. Accesso basato su ruoli con principio del privilegio minimo.",
  },
  {
    title: "5. Sub-Responsabili",
    content: "Il servizio utilizza i seguenti sub-responsabili: Supabase Inc. (database e autenticazione, datacenter EU/US), Stripe Inc. (pagamenti), provider AI (OpenAI, Google) per analisi testuale. Ogni sub-responsabile è vincolato da clausole contrattuali equivalenti.",
  },
  {
    title: "6. Diritti degli Interessati",
    content: "Il Responsabile assiste il Titolare nell'esercizio dei diritti degli interessati: accesso, rettifica, cancellazione, portabilità, limitazione e opposizione al trattamento. Le richieste vengono evase entro 30 giorni.",
  },
  {
    title: "7. Data Breach",
    content: "In caso di violazione dei dati, il Responsabile notifica il Titolare entro 72 ore dalla scoperta, fornendo: natura della violazione, categorie e numero di interessati, conseguenze probabili, e misure adottate o proposte.",
  },
  {
    title: "8. Cancellazione e Restituzione",
    content: "Alla cessazione del servizio, il Responsabile cancella tutti i dati personali entro 30 giorni, salvo obblighi di legge. Su richiesta, i dati vengono restituiti in formato CSV prima della cancellazione.",
  },
];

export function DPAPage(): React.ReactElement {
  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header */}
        <div className="text-center mb-12">
          <Shield className="h-12 w-12 text-primary mx-auto mb-4" />
          <h1 className="text-3xl font-bold">Sicurezza e Compliance</h1>
          <p className="text-muted-foreground mt-2">GDPR, DPA e SOC2 starter</p>
        </div>

        {/* SOC2 Checklist */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Lock className="h-5 w-5 text-primary" />
              SOC2 Type I — Checklist di Conformità
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SOC2_CHECKLIST.map((item) => (
                <div key={item.label} className="flex items-start gap-2 text-sm">
                  <CheckCircle2 className={`h-4 w-4 mt-0.5 shrink-0 ${item.done ? "text-emerald-500" : "text-muted-foreground"}`} />
                  <span className={item.done ? "" : "text-muted-foreground"}>{item.label}</span>
                  {!item.done && <Badge variant="outline" className="text-[10px] ml-auto">Pianificato</Badge>}
                </div>
              ))}
            </div>
            <div className="mt-4 text-xs text-muted-foreground">
              {SOC2_CHECKLIST.filter(i => i.done).length}/{SOC2_CHECKLIST.length} controlli implementati
            </div>
          </CardContent>
        </Card>

        {/* GDPR Summary */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              Riepilogo GDPR
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="p-4 rounded-lg border bg-muted/30 text-center">
                <Server className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Data Residency</p>
                <p className="text-xs text-muted-foreground mt-1">EU (configurabile)</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30 text-center">
                <Trash2 className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Diritto all'Oblio</p>
                <p className="text-xs text-muted-foreground mt-1">Cancellazione entro 30gg</p>
              </div>
              <div className="p-4 rounded-lg border bg-muted/30 text-center">
                <FileText className="h-6 w-6 text-primary mx-auto mb-2" />
                <p className="text-sm font-medium">Data Portability</p>
                <p className="text-xs text-muted-foreground mt-1">Export CSV completo</p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* DPA */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-2xl font-bold flex items-center gap-2">
              <FileText className="h-6 w-6 text-primary" />
              Data Processing Agreement (DPA)
            </h2>
            <Button variant="outline" size="sm" className="gap-2">
              <Download className="h-4 w-4" /> Scarica PDF
            </Button>
          </div>
          <div className="space-y-6">
            {DPA_SECTIONS.map((section) => (
              <div key={section.title} className="border-l-2 border-primary/30 pl-4">
                <h3 className="font-semibold text-sm mb-1">{section.title}</h3>
                <p className="text-sm text-muted-foreground leading-relaxed">{section.content}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Sign CTA */}
        <Card className="border-primary/30 bg-primary/5">
          <CardContent className="py-6 text-center">
            <h3 className="font-semibold mb-2">Firma il DPA</h3>
            <p className="text-sm text-muted-foreground mb-4">Per firmare digitalmente il DPA, accedi alla piattaforma e vai su Settings → Legale.</p>
            <Button className="gap-2">
              <FileText className="h-4 w-4" /> Firma DPA Digitalmente
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
