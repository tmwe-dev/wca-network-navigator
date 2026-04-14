import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { invokeEdge } from "@/lib/api/invokeEdge";
import { isApiError } from "@/lib/api/apiError";
import { toast } from "@/hooks/use-toast";
import { createLogger } from "@/lib/log";

const log = createLogger("useEmailGenerator");

type GenerateEmailErrorBody = { error?: string; message?: string; partner_name?: string };

export interface GeneratedEmail {
  subject: string;
  body: string;
  full_content: string;
  partner_name: string;
  contact_name: string | null;
  contact_email: string | null;
}

export function useEmailGenerator() {
  const [isGenerating, setIsGenerating] = useState(false);
  const [email, setEmail] = useState<GeneratedEmail | null>(null);

  const generate = async (params: {
    activity_id: string;
    goal: string;
    base_proposal: string;
    language?: string;
    document_ids?: string[];
    reference_urls?: string[];
    quality?: "fast" | "standard" | "premium";
  }) => {
    setIsGenerating(true);
    setEmail(null);
    try {
      let data: (GeneratedEmail & GenerateEmailErrorBody) | null = null;
      try {
        data = await invokeEdge<GeneratedEmail & GenerateEmailErrorBody>("generate-content", {
          body: { action: "email", ...params },
          context: "useEmailGenerator.generate",
        });
      } catch (err) {
        // Vol. II §5.3 — gli errori 422 con body strutturato sono dispatchati
        // sui codici applicativi `no_email` / `no_contact` invece di toast generici.
        if (isApiError(err)) {
          const body = (err.details?.body ?? {}) as GenerateEmailErrorBody;
          if (body.error === "no_contact") {
            toast({
              title: "Contatto mancante",
              description: `${body.partner_name || "Il partner"} non ha un contatto selezionato. Seleziona un contatto prima di generare.`,
              variant: "destructive",
            });
            return null;
          }
          if (body.error === "no_email") {
            toast({
              title: "Email mancante",
              description: `${body.partner_name || "Il partner"} non ha un indirizzo email. Aggiungi un contatto con email prima di generare.`,
              variant: "destructive",
            });
            return null;
          }
        }
        throw err;
      }

      if (data?.error) {
        if (data.error === "no_email") {
          toast({
            title: "Email mancante",
            description: `${data.partner_name || "Il partner"} non ha un indirizzo email. Aggiungi un contatto con email prima di generare.`,
            variant: "destructive",
          });
          return null;
        }
        throw new Error(data.message || data.error);
      }
      const result = data as GeneratedEmail;
      setEmail(result);

      // Save to activity so it appears in Sorting
      const { error: updateError } = await supabase
        .from("activities")
        .update({
          email_subject: result.subject,
          email_body: result.body,
          scheduled_at: new Date().toISOString(),
          status: "pending",
        })
        .eq("id", params.activity_id);

      if (updateError) {
        log.error("save email to activity failed", { message: updateError instanceof Error ? updateError.message : String(updateError) });
        toast({
          title: "Email generata ma non salvata",
          description: updateError.message,
          variant: "destructive",
        });
      }

      return result;
    } catch (err: unknown) {
      toast({ title: "Errore generazione", description: err instanceof Error ? err.message : String(err), variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => setEmail(null);

  return { generate, isGenerating, email, setEmail, reset };
}
