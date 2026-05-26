import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { StepOperatorIdentity, type OperatorIdentityValues } from "./StepOperatorIdentity";

import { createLogger } from "@/lib/log";

const log = createLogger("onboarding");

function describeSaveError(err: unknown): string {
  if (!err) return "errore sconosciuto";
  if (err instanceof Error) return err.message;
  if (typeof err === "object") {
    const e = err as { message?: string; details?: string; hint?: string; code?: string };
    return [e.message, e.details, e.hint, e.code ? `(code ${e.code})` : null]
      .filter(Boolean)
      .join(" — ") || "errore sconosciuto";
  }
  return String(err);
}

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

      // Upsert (non solo update): se per qualche motivo la riga profile
      // non esiste ancora — es. trigger handle_new_user fallito o utente
      // creato prima del trigger — la creiamo on-the-fly invece di
      // consumare un update silenzioso a 0 righe che lascia il flag
      // onboarding_completed=false e ripresenta il wizard.
      const profilePayload = {
        user_id: user.id,
        display_name: values.displayName.trim(),
        language: values.language,
        phone: values.phone.trim() || null,
        whatsapp_number: values.whatsapp.trim() || null,
        linkedin_url: values.linkedinUrl.trim() || null,
        onboarding_completed: true,
      };
      const { data: upserted, error } = await supabase
        .from("profiles")
        .upsert(profilePayload, { onConflict: "user_id" })
        .select("id")
        .maybeSingle();
      if (error) throw error;
      if (!upserted) throw new Error("profile_upsert_no_row (RLS o user_id non autorizzato)");

      // Sync row operator (UPDATE-first per evitare conflitti su unique email).
      // Never touches is_admin — governato da Settings → Operatori.
      // Operator sync: solo UPDATE (la riga è creata dal trigger
      // handle_new_user al primo login). RLS operators_update consente
      // user_id = auth.uid(). Mai INSERT qui: la policy "Admins can
      // insert operators" richiederebbe ruolo admin e bloccherebbe il
      // wizard di un utente normale facendo apparire un errore di salvataggio.
      const operatorEmail = (user.email ?? "").toLowerCase();
      if (operatorEmail) {
        const operatorPatch = {
          name: values.displayName.trim() || operatorEmail.split("@")[0],
          whatsapp_phone: values.whatsapp.trim() || null,
          linkedin_profile_url: values.linkedinUrl.trim() || null,
          is_active: true,
        };
        const { error: opErr, count } = await supabase
          .from("operators")
          .update(operatorPatch, { count: "exact" })
          .eq("user_id", user.id);
        if (opErr) {
          log.warn("[onboarding] operator update non-blocking:", { detail: describeSaveError(opErr) });
        } else if ((count ?? 0) === 0) {
          // Nessuna riga operator esistente: il trigger non l'ha creata
          // (probabile email duplicata su un'altra utenza). Non blocchiamo:
          // l'operatore può essere ripristinato da Settings → Operatori.
          console.warn("[onboarding] no operator row matched user_id; skipping (admin can fix in Settings)");
        }
      }

      toast.success("Profilo configurato. Benvenuto!");
      onComplete();
    } catch (err) {
      toast.error(`Salvataggio fallito: ${describeSaveError(err)}`);
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
