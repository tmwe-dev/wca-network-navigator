import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User, Globe, Phone, Mail, Briefcase } from "lucide-react";

const LANGUAGES = [
  { code: "it", label: "🇮🇹 Italiano" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "fr", label: "🇫🇷 Français" },
  { code: "de", label: "🇩🇪 Deutsch" },
  { code: "pt", label: "🇧🇷 Português" },
  { code: "zh", label: "🇨🇳 中文" },
];

const ROLES = [
  "Sales Manager",
  "Account Manager",
  "Business Development",
  "Operations Manager",
  "General Manager",
  "Director",
  "CEO",
  "Altro",
];

export interface ProfileData {
  displayName: string;
  email: string;
  phone: string;
  language: string;
  role: string;
}

interface StepProfileProps {
  data: ProfileData;
  onChange: (data: ProfileData) => void;
  onNext: () => void;
}

export function StepProfile({ data, onChange, onNext }: StepProfileProps) {
  const update = (field: keyof ProfileData, value: string) =>
    onChange({ ...data, [field]: value });

  const canContinue = data.displayName.trim() && data.email.trim();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <User className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Benvenuto!</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Configura il tuo profilo per personalizzare l'esperienza
        </p>
      </div>

      <div className="space-y-3">
        <div>
          <Label className="text-sm font-medium">Nome visualizzato *</Label>
          <Input
            value={data.displayName}
            onChange={e => update("displayName", e.target.value)}
            placeholder="Mario Rossi"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Mail className="w-3.5 h-3.5" /> Email aziendale *
          </Label>
          <Input
            type="email"
            value={data.email}
            onChange={e => update("email", e.target.value)}
            placeholder="mario@transportmgmt.com"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Phone className="w-3.5 h-3.5" /> Telefono / WhatsApp
          </Label>
          <Input
            type="tel"
            value={data.phone}
            onChange={e => update("phone", e.target.value)}
            placeholder="+39 333 1234567"
            className="mt-1"
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Globe className="w-3.5 h-3.5" /> Lingua
            </Label>
            <Select value={data.language} onValueChange={v => update("language", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {LANGUAGES.map(l => (
                  <SelectItem key={l.code} value={l.code}>{l.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <Label className="text-sm font-medium flex items-center gap-1.5">
              <Briefcase className="w-3.5 h-3.5" /> Ruolo
            </Label>
            <Select value={data.role} onValueChange={v => update("role", v)}>
              <SelectTrigger className="mt-1">
                <SelectValue placeholder="Seleziona..." />
              </SelectTrigger>
              <SelectContent>
                {ROLES.map(r => (
                  <SelectItem key={r} value={r}>{r}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>

      <Button onClick={onNext} className="w-full" disabled={!canContinue}>
        Continua
      </Button>
    </div>
  );
}
