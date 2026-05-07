import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepOperatorIdentity, type OperatorIdentityValues } from "./StepOperatorIdentity";

interface OnboardingWizardProps {
  onComplete: () => void;
}

/**
 * Wizard di primo accesso: gira UNA sola volta (gated da
 * profiles.onboarding_completed). Cattura solo i dati operatore
 * aziendali necessari alla whitelist e all'attribuzione dei messaggi.
 * Tutto il resto (chiavi API, network, import) è opzionale e gestito
 * altrove. Le chiavi tecniche sono già riempite via OAuth TMWE.
 */
export function OnboardingWizard({ onComplete }: OnboardingWizardProps) {
  const [saving, setSaving] = useState(false);
  const [email, setEmail] = useState("");
  const [initial, setInitial] = useState<OperatorIdentityValues>({
    displayName: "",
    language: "it",
    phone: "",
    whatsapp: "",
    linkedinUrl: "",
  });

  // Pre-fill from auth session + existing profile (TMWE OAuth callback may
  // have already set display_name in user_metadata).
  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user || cancelled) return;
      const meta = (user.user_metadata ?? {}) as Record<string, unknown>;
      const { data: profile } = await supabase
        .from("profiles")
        .select("display_name, language, phone, whatsapp_number, linkedin_url")
        .eq("user_id", user.id)
        .maybeSingle();
      if (cancelled) return;
      setEmail(user.email ?? "");
      setInitial({
        displayName:
          (profile?.display_name as string | undefined) ??
          (meta.display_name as string | undefined) ??
          (meta.full_name as string | undefined) ??
          "",
        language: (profile?.language as string | undefined) ?? "it",
        phone: (profile?.phone as string | undefined) ?? "",
        whatsapp: (profile?.whatsapp_number as string | undefined) ?? "",
        linkedinUrl: (profile?.linkedin_url as string | undefined) ?? "",
      });
    })();
    return () => { cancelled = true; };
  }, []);

  const handleSubmit = async (values: OperatorIdentityValues) => {
    setSaving(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const user = session?.user;
      if (!user) throw new Error("no_session");

      const { error } = await supabase
        .from("profiles")
        .update({
          display_name: values.displayName.trim(),
          language: values.language,
          phone: values.phone.trim() || null,
          whatsapp_number: values.whatsapp.trim() || null,
          linkedin_url: values.linkedinUrl.trim() || null,
          onboarding_completed: true,
        })
        .eq("user_id", user.id);
      if (error) throw error;

      // Ensure operator row exists and is in sync. Never touches is_admin —
      // that is governed exclusively from Settings → Operatori.
      const operatorEmail = (user.email ?? "").toLowerCase();
      if (operatorEmail) {
        const { error: opErr } = await supabase
          .from("operators")
          .upsert(
            {
              user_id: user.id,
              name: values.displayName.trim() || operatorEmail.split("@")[0],
              email: operatorEmail,
              whatsapp_phone: values.whatsapp.trim() || null,
              linkedin_profile_url: values.linkedinUrl.trim() || null,
              is_active: true,
            },
            { onConflict: "user_id" },
          );
        if (opErr) {
          // Non bloccare l'onboarding se l'operator row esiste già con email
          // diversa: l'admin la riconcilia da Settings.
          console.warn("[onboarding] operator upsert non-blocking:", opErr.message);
        }
      }

      toast.success("Profilo configurato. Benvenuto!");
      onComplete();
    } catch (err) {
      const msg = err instanceof Error ? err.message : "errore";
      toast.error(`Salvataggio fallito: ${msg}`);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex items-center justify-center p-4 overflow-y-auto">
      <div className="w-full max-w-lg my-8">
        <div className="bg-card border border-border/50 rounded-2xl p-6 shadow-lg">
          <StepOperatorIdentity
            initial={initial}
            email={email}
            saving={saving}
            onSubmit={handleSubmit}
          />
        </div>
      </div>
    </div>
  );
}
