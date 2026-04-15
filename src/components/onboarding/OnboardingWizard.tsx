import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepProfile } from "./StepProfile";
import { StepWCA } from "./StepWCA";
import { StepAI } from "./StepAI";
import { StepImport } from "./StepImport";
import { cn } from "@/lib/utils";

interface OnboardingWizardProps {
  onComplete: () => void;
}

const STEP_LABELS = ["Profilo", "Network", "AI", "Contatti"];

export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [step, setStep] = useState(0);
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("it");
  const [wcaUsername, setWcaUsername] = useState("");
  const [wcaPassword, setWcaPassword] = useState("");
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);

  const next = () => setStep(s => Math.min(s + 1, 3));

  const saveSetting = async (key: string, value: string) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    await supabase.from("app_settings").upsert(
      { user_id: user.id, key, value },
      { onConflict: "user_id,key" }
    );
  };

  const handleProfileNext = async () => {
    await saveSetting("display_name", displayName);
    await saveSetting("preferred_language", language);
    next();
  };

  const handleFinish = async () => {
    setSaving(true);
    try {
      for (const [provider, key] of Object.entries(apiKeys)) {
        if (key.trim()) await saveSetting(`ai_key_${provider}`, key.trim());
      }
      await saveSetting("onboarding_completed", "true");
      toast.success("Configurazione completata!");
      onComplete();
    } catch {
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  const handleSkipToEnd = async () => {
    setSaving(true);
    try {
      await saveSetting("onboarding_completed", "true");
      onComplete();
    } catch {
      toast.error("Errore");
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
            <div key={i} className="flex-1 space-y-1">
              <div className={cn(
                "h-1.5 rounded-full transition-colors",
                i <= step ? "bg-primary" : "bg-muted"
              )} />
              <p className={cn(
                "text-[10px] text-center",
                i <= step ? "text-primary" : "text-muted-foreground"
              )}>{label}</p>
            </div>
          ))}
        </div>

        {/* Steps */}
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
          {step === 0 && (
            <StepProfile
              displayName={displayName}
              language={language}
              onDisplayNameChange={setDisplayName}
              onLanguageChange={setLanguage}
              onNext={handleProfileNext}
            />
          )}
          {step === 1 && (
            <StepWCA
              wcaUsername={wcaUsername}
              wcaPassword={wcaPassword}
              onUsernameChange={setWcaUsername}
              onPasswordChange={setWcaPassword}
              onNext={next}
              onSkip={next}
            />
          )}
          {step === 2 && (
            <StepAI
              apiKeys={apiKeys}
              onApiKeyChange={(p, k) => setApiKeys(prev => ({ ...prev, [p]: k }))}
              onFinish={next}
              onSkip={next}
              loading={saving}
            />
          )}
          {step === 3 && (
            <StepImport
              onFinish={handleFinish}
              onSkip={handleSkipToEnd}
              loading={saving}
            />
          )}
        </div>
      </div>
    </div>
  );
}
