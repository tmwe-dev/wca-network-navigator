import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, AlertCircle, Mail, Phone, Briefcase, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useRAProspect, useRAProspectContacts, useRAProspectInteractions, useUpdateRALeadStatus } from "@/hooks/useRAProspects";
import type { RALeadStatus } from "@/types/ra";
import { RACompanyHeader } from "@/components/ra/RACompanyHeader";
import { RACompanyKPI, formatCurrency } from "@/components/ra/RACompanyKPI";
import { RACompanySidebar } from "@/components/ra/RACompanySidebar";

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => { navigator.clipboard.writeText(text); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  return (
    <Button size="sm" variant="ghost" className="h-8 w-8 p-0 hover:bg-primary/10" onClick={handleCopy}>
      <Copy className="w-4 h-4" />
    </Button>
  );
}

export default function RACompanyDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: prospect, isLoading, error } = useRAProspect(id);
  const { data: contacts = [] } = useRAProspectContacts(id);
  const { data: interactions = [] } = useRAProspectInteractions(id);
  const updateLeadStatus = useUpdateRALeadStatus();

  if (error || (!isLoading && !prospect)) {
    return (
      <div className="h-full flex flex-col overflow-hidden bg-gradient-to-b from-[hsl(240_6%_3%)] via-[hsl(240_6%_5%)] to-[hsl(240_6%_3%)]">
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-6">
          <div className="p-3 rounded-full bg-destructive/10 border border-destructive/30"><AlertCircle className="w-6 h-6 text-destructive" /></div>
          <div className="text-center">
            <h2 className="text-lg font-semibold text-foreground/90">Azienda non trovata</h2>
            <p className="text-sm text-muted-foreground mt-1">L'azienda che stai cercando non esiste o è stata eliminata</p>
          </div>
          <Button variant="outline" onClick={() => navigate("/v2/research/explorer")} className="border-border hover:bg-muted/50">
            <ArrowLeft className="w-4 h-4 mr-2" /> Torna a Explorer
          </Button>
        </div>
      </div>
    );
  }

  if (isLoading || !prospect) {
    return (
      <div className="h-full flex items-center justify-center bg-gradient-to-b from-[hsl(240_6%_3%)] via-[hsl(240_6%_5%)] to-[hsl(240_6%_3%)]">
        <Loader2 className="w-8 h-8 text-primary/50 animate-spin" />
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col overflow-hidden bg-gradient-to-b from-[hsl(240_6%_3%)] via-[hsl(240_6%_5%)] to-[hsl(240_6%_3%)]">
      <RACompanyHeader prospect={prospect} />
      <RACompanyKPI prospect={prospect} />

      <div className="flex-1 flex min-h-0 overflow-hidden">
        {/* Left: Company Info */}
        <div className="flex-1 border-r border-border/20 overflow-hidden flex flex-col">
          <ScrollArea className="flex-1">
            <div className="p-6 space-y-8">
              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Informazioni Anagrafiche</h2>
                <div className="grid grid-cols-2 gap-6">
                  {prospect.partita_iva && <InfoField label="P.IVA" value={prospect.partita_iva} mono />}
                  {prospect.codice_fiscale && <InfoField label="Codice Fiscale" value={prospect.codice_fiscale} mono />}
                  {prospect.address && <InfoField label="Indirizzo" value={`${prospect.address}${prospect.cap ? `, ${prospect.cap}` : ""}`} />}
                  {prospect.city && <InfoField label="Città" value={`${prospect.city}${prospect.province ? ` (${prospect.province})` : ""}`} />}
                  {prospect.region && <InfoField label="Regione" value={prospect.region} />}
                  {prospect.data_costituzione && <InfoField label="Fondazione" value={String(new Date(prospect.data_costituzione).getFullYear())} />}
                  {prospect.forma_giuridica && <InfoField label="Forma Giuridica" value={prospect.forma_giuridica} />}
                </div>
              </section>

              <Separator className="bg-border/30" />

              {prospect.codice_ateco && (
                <>
                  <section>
                    <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Settore Economico</h2>
                    <div className="p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border backdrop-blur-xl">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label className="text-xs font-medium text-muted-foreground">Codice ATECO</label>
                          <p className="text-lg font-mono font-bold text-primary mt-1.5">{prospect.codice_ateco}</p>
                        </div>
                        {prospect.descrizione_ateco && (
                          <div>
                            <label className="text-xs font-medium text-muted-foreground">Descrizione</label>
                            <p className="text-sm text-foreground/80 mt-1.5">{prospect.descrizione_ateco}</p>
                          </div>
                        )}
                      </div>
                    </div>
                  </section>
                  <Separator className="bg-border/30" />
                </>
              )}

              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Contatti</h2>
                <div className="space-y-3">
                  {prospect.website && <ContactRow icon={Briefcase} label="Website" value={prospect.website} />}
                  {prospect.email && <ContactRow icon={Mail} label="Email" value={prospect.email} />}
                  {prospect.pec && <ContactRow icon={Mail} label="PEC" value={prospect.pec} iconColor="text-primary" />}
                  {prospect.phone && <ContactRow icon={Phone} label="Telefono" value={prospect.phone} />}
                </div>
              </section>

              <Separator className="bg-border/30" />

              <section>
                <h2 className="text-xs font-semibold text-muted-foreground uppercase tracking-widest mb-4">Dati Finanziari</h2>
                <div className="grid grid-cols-3 gap-4">
                  <FinCard label="Fatturato Medio" value={formatCurrency(prospect.fatturato)} />
                  <FinCard label="Utile Netto" value={formatCurrency(prospect.utile)} />
                  <FinCard label="Margine Netto" value={prospect.fatturato && prospect.utile ? `${((prospect.utile / prospect.fatturato) * 100).toFixed(1)}%` : "—"} />
                </div>
              </section>
            </div>
          </ScrollArea>
        </div>

        <RACompanySidebar prospect={prospect} contacts={contacts} interactions={interactions}
          onLeadStatusChange={(s) => updateLeadStatus.mutate({ id: prospect.id, status: s })} />
      </div>
    </div>
  );
}

function InfoField({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div>
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      <p className={`text-sm mt-1.5 ${mono ? "font-mono text-primary" : "text-foreground/80"}`}>{value}</p>
    </div>
  );
}

function ContactRow({ icon: Icon, label, value, iconColor }: { icon: any; label: string; value: string; iconColor?: string }) {
  return (
    <div className="flex items-center gap-3 p-3 rounded-lg bg-gradient-to-r from-muted/30 to-muted/10 border border-border backdrop-blur-sm hover:border-foreground/20 transition-colors">
      <Icon className={`w-4 h-4 flex-shrink-0 ${iconColor || "text-muted-foreground"}`} />
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-muted-foreground">{label}</p>
        <p className="text-sm text-foreground/80 truncate">{value}</p>
      </div>
      <CopyButton text={value} />
    </div>
  );
}

function FinCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="p-4 rounded-xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border backdrop-blur-xl">
      <p className="text-xs text-muted-foreground font-medium">{label}</p>
      <p className="text-lg font-bold text-foreground/95 mt-2">{value}</p>
    </div>
  );
}
