import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { StepProfile } from "@/components/onboarding/StepProfile";
import { StepWCA } from "@/components/onboarding/StepWCA";
import { StepAI } from "@/components/onboarding/StepAI";
import { toast } from "sonner";

export default function Onboarding() {
  const navigate = useNavigate();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  // Profile
  const [displayName, setDisplayName] = useState("");
  const [language, setLanguage] = useState("it");

  // WCA
  const [wcaUsername, setWcaUsername] = useState("");
  const [wcaPassword, setWcaPassword] = useState("");

  // AI
  const [apiKeys, setApiKeys] = useState<Record<string, string>>({});

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) { navigate("/auth", { replace: true }); return; }
      setUserId(session.user.id);
      // Pre-fill name from profile or auth metadata
      const name = session.user.user_metadata?.full_name || session.user.email || "";
      setDisplayName(name);
    });
  }, [navigate]);

  const steps = ["Profilo", "WCA", "AI"];
  const progress = ((step + 1) / steps.length) * 100;

  const handleFinish = async () => {
    if (!userId) return;
    setSaving(true);
    try {
      // Save profile
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ display_name: displayName, language, onboarding_completed: true })
        .eq("user_id", userId);
      if (profileErr) throw profileErr;

      // Save WCA credentials if provided
      if (wcaUsername && wcaPassword) {
        const { error: wcaErr } = await supabase
          .from("user_wca_credentials")
          .upsert({ user_id: userId, wca_username: wcaUsername, wca_password: wcaPassword }, { onConflict: "user_id" });
        if (wcaErr) throw wcaErr;
      }

      // Save API keys if provided
      const keysToSave = Object.entries(apiKeys).filter(([, v]) => v.trim());
      for (const [provider, api_key] of keysToSave) {
        const { error: keyErr } = await supabase
          .from("user_api_keys")
          .upsert({ user_id: userId, provider, api_key }, { onConflict: "user_id,provider" });
        if (keyErr) throw keyErr;
      }

      toast.success("Configurazione completata!");
      navigate("/", { replace: true });
    } catch (e: any) {
      toast.error(e?.message || "Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md space-y-4">
        {/* Progress */}
        <div className="space-y-2">
          <div className="flex justify-between text-xs text-muted-foreground">
            {steps.map((s, i) => (
              <span key={s} className={i <= step ? "text-primary font-medium" : ""}>{s}</span>
            ))}
          </div>
          <Progress value={progress} className="h-1.5" />
        </div>

        <Card>
          <CardContent className="pt-6">
            {step === 0 && (
              <StepProfile
                displayName={displayName}
                language={language}
                onDisplayNameChange={setDisplayName}
                onLanguageChange={setLanguage}
                onNext={() => setStep(1)}
              />
            )}
            {step === 1 && (
              <StepWCA
                wcaUsername={wcaUsername}
                wcaPassword={wcaPassword}
                onUsernameChange={setWcaUsername}
                onPasswordChange={setWcaPassword}
                onNext={() => setStep(2)}
                onSkip={() => setStep(2)}
              />
            )}
            {step === 2 && (
              <StepAI
                apiKeys={apiKeys}
                onApiKeyChange={(provider, key) => setApiKeys(prev => ({ ...prev, [provider]: key }))}
                onFinish={handleFinish}
                onSkip={handleFinish}
                loading={saving}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
