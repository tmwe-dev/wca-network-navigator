import { Button } from "@/components/ui/button";
import { CheckCircle2, Loader2 } from "lucide-react";
import type { ProfileData } from "./StepProfile";
import type { CompanyData } from "./StepCompany";
import type { PreferencesData } from "./StepPreferences";

interface StepSummaryProps {
  profile: ProfileData;
  company: CompanyData;
  preferences: PreferencesData;
  onFinish: () => void;
  onBack: () => void;
  loading?: boolean;
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  if (!value) return null;
  return (
    <div className="flex justify-between text-sm py-1.5 border-b border-border/30 last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-foreground font-medium text-right max-w-[60%] truncate">{value}</span>
    </div>
  );
}

export function StepSummary({ profile, company, preferences, onFinish, onBack, loading }: StepSummaryProps) {
  return (
    <div className="space-y-5">
      <div className="text-center space-y-2">
        <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center">
          <CheckCircle2 className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-xl font-bold text-foreground">Tutto pronto!</h2>
        <p className="text-sm text-muted-foreground max-w-sm mx-auto">
          Verifica i dati e inizia a usare il sistema
        </p>
      </div>

      <div className="space-y-4">
        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Profilo</p>
          <SummaryRow label="Nome" value={profile.displayName} />
          <SummaryRow label="Email" value={profile.email} />
          <SummaryRow label="Telefono" value={profile.phone} />
          <SummaryRow label="Ruolo" value={profile.role} />
          <SummaryRow label="Lingua" value={profile.language} />
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Azienda</p>
          <SummaryRow label="Azienda" value={company.companyName} />
          <SummaryRow label="Network" value={company.networks.map(n => n.replace("WCA ", "")).join(", ") || "—"} />
          {company.signatureText && <SummaryRow label="Firma" value="✓ Configurata" />}
          {company.signatureImageUrl && <SummaryRow label="Immagine firma" value="✓ Allegata" />}
        </div>

        <div className="rounded-lg border bg-muted/20 p-3">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-1">Preferenze AI</p>
          <SummaryRow label="Tono" value={preferences.tone} />
          {preferences.objectives && <SummaryRow label="Obiettivi" value="✓ Configurati" />}
          {preferences.focusAreas && <SummaryRow label="Focus" value="✓ Configurato" />}
        </div>
      </div>

      <div className="flex gap-2">
        <Button variant="outline" onClick={onBack} className="flex-1">
          Indietro
        </Button>
        <Button onClick={onFinish} className="flex-1" disabled={loading}>
          {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" /> Salvataggio...</> : "Inizia! 🚀"}
        </Button>
      </div>
    </div>
  );
}
