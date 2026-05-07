import { useEffect, useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Building2, User, Phone, MessageCircle, Linkedin, Mail, ShieldCheck, Loader2 } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

const LANGUAGES = [
  { code: "it", label: "🇮🇹 Italiano" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "fr", label: "🇫🇷 Français" },
];

export interface OperatorIdentityValues {
  displayName: string;
  language: string;
  phone: string;
  whatsapp: string;
  linkedinUrl: string;
}

interface Props {
  initial: OperatorIdentityValues;
  email: string;
  saving: boolean;
  onSubmit: (values: OperatorIdentityValues) => void;
}

function normalizeE164(input: string): string {
  const trimmed = input.trim();
  if (!trimmed) return "";
  const cleaned = trimmed.replace(/[^\d+]/g, "");
  if (cleaned.startsWith("+")) return cleaned;
  if (cleaned.startsWith("00")) return "+" + cleaned.slice(2);
  return cleaned;
}

export function StepOperatorIdentity({ initial, email, saving, onSubmit }: Props) {
  const [values, setValues] = useState<OperatorIdentityValues>(initial);

  useEffect(() => { setValues(initial); }, [initial.displayName, initial.phone, initial.whatsapp, initial.linkedinUrl]);

  const update = <K extends keyof OperatorIdentityValues>(key: K, v: OperatorIdentityValues[K]) =>
    setValues(prev => ({ ...prev, [key]: v }));

  const canSubmit = values.displayName.trim().length > 1 && !saving;

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Benvenuto in TMWE CRM</h2>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">
          Completa i tuoi dati operatore. Servono per associare email, WhatsApp e LinkedIn al tuo account.
        </p>
      </div>

      <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-3 py-2 flex items-start gap-2 text-xs text-amber-700 dark:text-amber-300">
        <Building2 className="w-4 h-4 mt-0.5 shrink-0" />
        <div>
          <strong>Dati aziendali.</strong> Inserisci email, telefono e WhatsApp <em>aziendali</em>:
          saranno visibili al team e usati per inviare comunicazioni a tuo nome. Le chiavi API tecniche
          sono già configurate automaticamente dal tuo accesso TMWE.
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="w-4 h-4" /> Email aziendale (TMWE)
          </Label>
          <Input value={email} readOnly className="mt-1 opacity-70" />
          <p className="text-[11px] text-muted-foreground mt-1">Importata dal tuo account TMWE — non modificabile.</p>
        </div>

        <div>
          <Label className="text-sm font-medium">Nome e cognome *</Label>
          <Input
            value={values.displayName}
            onChange={e => update("displayName", e.target.value)}
            placeholder="Mario Rossi"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="w-4 h-4" /> Telefono aziendale
          </Label>
          <Input
            value={values.phone}
            onChange={e => update("phone", e.target.value)}
            onBlur={e => update("phone", normalizeE164(e.target.value))}
            placeholder="+39 333 1234567"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <MessageCircle className="w-4 h-4" /> WhatsApp aziendale
          </Label>
          <Input
            value={values.whatsapp}
            onChange={e => update("whatsapp", e.target.value)}
            onBlur={e => update("whatsapp", normalizeE164(e.target.value))}
            placeholder="+39 333 1234567"
            className="mt-1"
          />
          <p className="text-[11px] text-muted-foreground mt-1">Anche uguale al telefono se è lo stesso numero.</p>
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Linkedin className="w-4 h-4" /> Profilo LinkedIn (opzionale)
          </Label>
          <Input
            value={values.linkedinUrl}
            onChange={e => update("linkedinUrl", e.target.value)}
            placeholder="https://www.linkedin.com/in/..."
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Lingua preferita</Label>
          <Select value={values.language} onValueChange={v => update("language", v)}>
            <SelectTrigger className="mt-1"><SelectValue /></SelectTrigger>
            <SelectContent>
              {LANGUAGES.map(l => <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>)}
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
        <ShieldCheck className="w-3.5 h-3.5 text-success" />
        Autenticazione protetta da TMWE OAuth — chiavi API riempite automaticamente.
      </div>

      <Button onClick={() => onSubmit(values)} className="w-full" disabled={!canSubmit}>
        {saving ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
        Entra nel CRM
      </Button>
    </div>
  );
}