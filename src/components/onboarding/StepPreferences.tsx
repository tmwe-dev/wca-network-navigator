import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Sparkles } from "lucide-react";

const TONES = [
  { value: "professionale", label: "Professionale" },
  { value: "amichevole", label: "Amichevole" },
  { value: "formale", label: "Formale" },
  { value: "diretto", label: "Diretto e conciso" },
];

export interface PreferencesData {
  tone: string;
  objectives: string;
  focusAreas: string;
}

interface StepPreferencesProps {
  data: PreferencesData;
  onChange: (data: PreferencesData) => void;
  onNext: () => void;
  onBack: () => void;
}

export function StepPreferences({ data, onChange, onNext, onBack }: StepPreferencesProps) {
  const update = (field: keyof PreferencesData, value: string) =>
    onChange({ ...data, [field]: value });

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <Sparkles className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Preferenze AI</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Personalizza come l'AI comunica per tuo conto
        </p>
      </div>

      <div className="space-y-4">
        <div>
          <Label className="text-sm font-medium">Tono comunicazioni</Label>
          <Select value={data.tone} onValueChange={v => update("tone", v)}>
            <SelectTrigger className="mt-1">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {TONES.map(t => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div>
          <Label className="text-sm font-medium">Obiettivi commerciali</Label>
          <Textarea
            value={data.objectives}
            onChange={e => update("objectives", e.target.value)}
            placeholder="Es: Espandere la rete di partner in Asia, aumentare volumi air freight..."
            rows={3}
            className="mt-1 text-sm"
          />
        </div>

        <div>
          <Label className="text-sm font-medium">Focus attuale</Label>
          <Textarea
            value={data.focusAreas}
            onChange={e => update("focusAreas", e.target.value)}
            placeholder="Es: Acquisizione nuovi clienti Europa Est, consolidamento partner esistenti..."
            rows={2}
            className="mt-1 text-sm"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Indietro
        </Button>
        <Button onClick={onNext} className="flex-1">
          Continua
        </Button>
      </div>
    </div>
  );
}
