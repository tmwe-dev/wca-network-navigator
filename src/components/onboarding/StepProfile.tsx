import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { User, Globe } from "lucide-react";

const LANGUAGES = [
  { code: "it", label: "🇮🇹 Italiano" },
  { code: "en", label: "🇬🇧 English" },
  { code: "es", label: "🇪🇸 Español" },
  { code: "fr", label: "🇫🇷 Français" },
  { code: "de", label: "🇩🇪 Deutsch" },
  { code: "pt", label: "🇧🇷 Português" },
  { code: "zh", label: "🇨🇳 中文" },
];

interface StepProfileProps {
  displayName: string;
  language: string;
  onDisplayNameChange: (v: string) => void;
  onLanguageChange: (v: string) => void;
  onNext: () => void;
}

export function StepProfile({ displayName, language, onDisplayNameChange, onLanguageChange, onNext }: StepProfileProps) {
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

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Nome visualizzato</Label>
          <Input
            value={displayName}
            onChange={e => onDisplayNameChange(e.target.value)}
            placeholder="Il tuo nome"
            className="mt-1"
          />
        </div>

        <div>
          <Label className="text-sm font-medium flex items-center gap-1.5">
            <Globe className="w-4 h-4" /> Lingua preferita
          </Label>
          <Select value={language} onValueChange={onLanguageChange}>
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
      </div>

      <Button onClick={onNext} className="w-full" disabled={!displayName.trim()}>
        Continua
      </Button>
    </div>
  );
}
