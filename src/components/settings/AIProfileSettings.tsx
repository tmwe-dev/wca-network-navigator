import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Brain, Building2, BookOpen, MessageSquareText, Globe2,
  Save, Loader2, User, Mail, Phone, Briefcase, TrendingUp, RotateCcw,
} from "lucide-react";
import { DEFAULT_SALES_KNOWLEDGE_BASE } from "@/data/salesKnowledgeBase";
import { useAppSettings, useUpdateSetting } from "@/hooks/useAppSettings";
import { toast } from "sonner";

const AI_KEYS = [
  "ai_company_name", "ai_company_alias", "ai_contact_name", "ai_contact_alias",
  "ai_contact_role", "ai_email_signature", "ai_phone_signature",
  "ai_email_signature_block",
  "ai_knowledge_base",
  "ai_sales_knowledge_base",
  "ai_tone", "ai_language", "ai_style_instructions",
  "ai_sector", "ai_networks", "ai_sector_notes",
] as const;

type AIFields = Record<(typeof AI_KEYS)[number], string>;

const EMPTY: AIFields = Object.fromEntries(AI_KEYS.map(k => [k, ""])) as AIFields;

export default function AIProfileSettings() {
  const { data: settings } = useAppSettings();
  const updateSetting = useUpdateSetting();
  const [fields, setFields] = useState<AIFields>(EMPTY);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!settings) return;
    setFields(prev => {
      const next = { ...prev };
      AI_KEYS.forEach(k => { next[k] = settings[k] || ""; });
      return next;
    });
  }, [settings]);

  const set = (key: keyof AIFields, value: string) =>
    setFields(prev => ({ ...prev, [key]: value }));

  const handleSave = async () => {
    if (!fields.ai_company_alias.trim()) {
      toast.error("L'alias aziendale è obbligatorio");
      return;
    }
    setSaving(true);
    try {
      for (const key of AI_KEYS) {
        await updateSetting.mutateAsync({ key, value: fields[key].trim() });
      }
      toast.success("Profilo AI salvato con successo!");
    } catch {
      toast.error("Errore durante il salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-lg bg-primary/10">
          <Brain className="w-5 h-5 text-primary" />
        </div>
        <div>
          <h2 className="text-lg font-semibold">Profilo AI</h2>
          <p className="text-sm text-muted-foreground">
            Informazioni che l'AI utilizzerà per generare comunicazioni personalizzate
          </p>
        </div>
      </div>

      {/* ── Card 1: Identità e Alias ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Identità e Alias</CardTitle>
          </div>
          <CardDescription>
            Dati aziendali e personali usati nelle comunicazioni AI
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Nome azienda</Label>
              <Input value={fields.ai_company_name} onChange={e => set("ai_company_name", e.target.value)} placeholder="Es. Global Freight Solutions Srl" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Building2 className="w-3.5 h-3.5" /> Alias aziendale *</Label>
              <Input value={fields.ai_company_alias} onChange={e => set("ai_company_alias", e.target.value)} placeholder="Es. GFS" />
              <p className="text-[11px] text-muted-foreground">Obbligatorio — usato come firma nelle comunicazioni</p>
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Nome referente</Label>
              <Input value={fields.ai_contact_name} onChange={e => set("ai_contact_name", e.target.value)} placeholder="Es. Marco Rossi" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><User className="w-3.5 h-3.5" /> Alias referente</Label>
              <Input value={fields.ai_contact_alias} onChange={e => set("ai_contact_alias", e.target.value)} placeholder="Es. Marco" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Briefcase className="w-3.5 h-3.5" /> Ruolo</Label>
              <Input value={fields.ai_contact_role} onChange={e => set("ai_contact_role", e.target.value)} placeholder="Es. Business Development Manager" />
            </div>
            <div className="space-y-1.5">
              <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Email firma</Label>
              <Input type="email" value={fields.ai_email_signature} onChange={e => set("ai_email_signature", e.target.value)} placeholder="marco@gfs.it" />
            </div>
            <div className="space-y-1.5 md:col-span-1">
              <Label className="flex items-center gap-1.5"><Phone className="w-3.5 h-3.5" /> Telefono firma</Label>
              <Input value={fields.ai_phone_signature} onChange={e => set("ai_phone_signature", e.target.value)} placeholder="+39 02 1234567" />
            </div>
          </div>
          {/* Signature block */}
          <div className="space-y-1.5 pt-2 border-t border-border/50">
            <Label className="flex items-center gap-1.5"><Mail className="w-3.5 h-3.5" /> Firma Email (Signature)</Label>
            <Textarea
              value={fields.ai_email_signature_block}
              onChange={e => set("ai_email_signature_block", e.target.value)}
              placeholder={`Best regards,\nMarco Rossi\nBusiness Development Manager\nGlobal Freight Solutions Srl\nTel: +39 02 1234567\nEmail: marco@gfs.it`}
              className="min-h-[120px] text-sm font-mono"
            />
            <p className="text-[11px] text-muted-foreground">
              Se lasciato vuoto, la firma viene generata automaticamente dai campi sopra (alias, ruolo, azienda, telefono, email).
            </p>
          </div>
        </CardContent>
      </Card>

      {/* ── Card 2: Knowledge Base ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <BookOpen className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Knowledge Base Aziendale</CardTitle>
          </div>
          <CardDescription>
            Descrivi liberamente la tua azienda: servizi, specializzazioni, punti di forza, certificazioni, zone geografiche coperte, numeri chiave.
            L'AI userà queste informazioni per generare proposte credibili e personalizzate.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={fields.ai_knowledge_base}
            onChange={e => set("ai_knowledge_base", e.target.value)}
            placeholder={`Es. Siamo una società di spedizioni internazionali fondata nel 1995, con sede a Milano.\n\nServizi principali:\n- Air Freight (import/export)\n- Ocean FCL & LCL\n- Project Cargo & Heavy Lift\n- Customs Brokerage\n\nCertificazioni: IATA, AEO, ISO 9001\nFlotta: 15 mezzi propri per distribuzione locale\nZone: Europa, Far East, Middle East, Americas\nNetwork: WCA (membro dal 2010), FIATA\n\nPunti di forza: transit time competitivi su Far East, team dedicato dangerous goods, servizio door-to-door con tracking in tempo reale.`}
            className="min-h-[200px] text-sm"
          />
        </CardContent>
      </Card>

      {/* ── Card 2b: Sales Knowledge Base ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <CardTitle className="text-base">Sales Knowledge Base</CardTitle>
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={() => set("ai_sales_knowledge_base", DEFAULT_SALES_KNOWLEDGE_BASE.trim())}
            >
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
              Ripristina default
            </Button>
          </div>
          <CardDescription>
            Guida completa per la generazione di email B2B: tecniche di vendita, gestione obiezioni, struttura email, adattamento tono.
            L'AI segue queste istruzioni per scrivere comunicazioni convincenti come un venditore esperto.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <Textarea
            value={fields.ai_sales_knowledge_base || DEFAULT_SALES_KNOWLEDGE_BASE.trim()}
            onChange={e => set("ai_sales_knowledge_base", e.target.value)}
            className="min-h-[400px] text-xs font-mono leading-relaxed"
          />
        </CardContent>
      </Card>

      {/* ── Card 3: Stile di Comunicazione ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Stile di Comunicazione</CardTitle>
          </div>
          <CardDescription>
            Come l'AI deve comunicare per conto tuo
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label>Tono</Label>
              <Select value={fields.ai_tone || "professionale"} onValueChange={v => set("ai_tone", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="formale">Formale</SelectItem>
                  <SelectItem value="professionale">Professionale</SelectItem>
                  <SelectItem value="amichevole">Amichevole</SelectItem>
                  <SelectItem value="diretto">Diretto</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>Lingua preferita</Label>
              <Select value={fields.ai_language || "italiano"} onValueChange={v => set("ai_language", v)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="italiano">Italiano</SelectItem>
                  <SelectItem value="inglese">Inglese</SelectItem>
                  <SelectItem value="entrambe">Entrambe (adatta al destinatario)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <div className="space-y-1.5">
            <Label>Istruzioni aggiuntive</Label>
            <Textarea
              value={fields.ai_style_instructions}
              onChange={e => set("ai_style_instructions", e.target.value)}
              placeholder={`Es. "Usa sempre il Lei nelle comunicazioni formali"\n"Includi sempre un riferimento ai network WCA"\n"Non citare mai i prezzi nella prima email"\n"Chiudi sempre con un invito a una call conoscitiva"`}
              className="min-h-[100px] text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Card 4: Contesto Settoriale ── */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Globe2 className="w-4 h-4 text-primary" />
            <CardTitle className="text-base">Contesto Settoriale</CardTitle>
          </div>
          <CardDescription>
            Settore e network di appartenenza per contestualizzare le comunicazioni
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-1.5">
            <Label>Settore principale</Label>
            <Select value={fields.ai_sector || "freight_forwarding"} onValueChange={v => set("ai_sector", v)}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="freight_forwarding">Freight Forwarding</SelectItem>
                <SelectItem value="logistica">Logistica</SelectItem>
                <SelectItem value="trasporti">Trasporti</SelectItem>
                <SelectItem value="spedizioni">Spedizioni</SelectItem>
                <SelectItem value="altro">Altro</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Network di appartenenza</Label>
            <Input
              value={fields.ai_networks}
              onChange={e => set("ai_networks", e.target.value)}
              placeholder="Es. WCA, FIATA, IATA, LogNet Global"
            />
            <p className="text-[11px] text-muted-foreground">Separa i network con virgola</p>
          </div>
          <div className="space-y-1.5">
            <Label>Note aggiuntive sul settore</Label>
            <Textarea
              value={fields.ai_sector_notes}
              onChange={e => set("ai_sector_notes", e.target.value)}
              placeholder="Es. Ci posizioniamo come partner premium per il Far East, con focus su import tessile e componentistica elettronica."
              className="min-h-[80px] text-sm"
            />
          </div>
        </CardContent>
      </Card>

      {/* ── Save Button ── */}
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving} size="lg">
          {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Save className="w-4 h-4 mr-2" />}
          Salva Profilo AI
        </Button>
      </div>
    </div>
  );
}
