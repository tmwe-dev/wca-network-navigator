import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepProfile, type ProfileData } from "./StepProfile";
import { StepCompany, type CompanyData } from "./StepCompany";
import { StepPreferences, type PreferencesData } from "./StepPreferences";
import { StepSummary } from "./StepSummary";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEP_LABELS = ["Profilo", "Azienda", "AI", "Riepilogo"];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [profile, setProfile] = useState<ProfileData>({
    displayName: "",
    email: "",
    phone: "",
    language: "it",
    role: "",
  });

  const [company, setCompany] = useState<CompanyData>({
    companyName: "Transport Management",
    networks: [],
    signatureText: "",
    signatureImageUrl: null,
  });

  const [preferences, setPreferences] = useState<PreferencesData>({
    tone: "professionale",
    objectives: "",
    focusAreas: "",
  });

  const next = () => setStep(s => Math.min(s + 1, 3));
  const back = () => setStep(s => Math.max(s - 1, 0));

  const saveSetting = async (key: string, value: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { user_id: user.id, key, value },
      { onConflict: "user_id,key" }
    );
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      // Profile
      await saveSetting("display_name", profile.displayName);
      await saveSetting("preferred_language", profile.language);
      await saveSetting("user_email", profile.email);
      await saveSetting("user_phone", profile.phone);
      await saveSetting("user_role", profile.role);

      // Company
      await saveSetting("ai_company_name", company.companyName);
      await saveSetting("wca_networks", JSON.stringify(company.networks));
      if (company.signatureText) await saveSetting("ai_email_signature", company.signatureText);
      if (company.signatureImageUrl) await saveSetting("signature_image_data", company.signatureImageUrl);

      // Preferences
      await saveSetting("ai_tone", preferences.tone);
      if (preferences.objectives) await saveSetting("ai_custom_goals", preferences.objectives);
      if (preferences.focusAreas) await saveSetting("ai_focus_areas", preferences.focusAreas);

      await saveSetting("onboarding_completed", "true");
      toast.success("Configurazione completata!");
      onComplete();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-lg">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {STEP_LABELS.map((label, i) => (
            <button
              key={i}
              className="flex-1 space-y-1 cursor-pointer disabled:cursor-default"
              disabled={i > step}
              onClick={() => i < step && setStep(i)}
            >
              <div className={cn(
                "h-1.5 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )} />
              <p className={cn(
                "text-[10px] text-center",
                i <= step ? "text-primary" : "text-muted-foreground"
              )}>{label}</p>
            </button>
          ))}
        </div>

        {/* Steps */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg max-h-[80vh] overflow-y-auto">
          {step === 0 && (
            <StepProfile data={profile} onChange={setProfile} onNext={next} />
          )}
          {step === 1 && (
            <StepCompany data={company} onChange={setCompany} onNext={next} onBack={back} />
          )}
          {step === 2 && (
            <StepPreferences data={preferences} onChange={setPreferences} onNext={next} onBack={back} />
          )}
          {step === 3 && (
            <StepSummary
              profile={profile}
              company={company}
              preferences={preferences}
              onFinish={handleFinish}
              onBack={back}
              loading={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
