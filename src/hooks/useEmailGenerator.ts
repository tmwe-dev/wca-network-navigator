import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

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
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: params,
      });
      
      // Handle structured error responses (e.g. 422 no_email, no_contact)
      if (error) {
        // Try to parse the response body for structured errors
        let parsed: any = null;
        try {
          if (error.context instanceof Response) {
            parsed = await error.context.json();
          }
        } catch {}
        
        if (parsed?.error === "no_contact") {
          toast({
            title: "Contatto mancante",
            description: `${parsed.partner_name || "Il partner"} non ha un contatto selezionato. Seleziona un contatto prima di generare.`,
            variant: "destructive",
          });
          return null;
        }
        if (parsed?.error === "no_email") {
          toast({
            title: "Email mancante",
            description: `${parsed.partner_name || "Il partner"} non ha un indirizzo email. Aggiungi un contatto con email prima di generare.`,
            variant: "destructive",
          });
          return null;
        }
        throw new Error(parsed?.message || parsed?.error || error.message);
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
        } as any)
        .eq("id", params.activity_id);

      if (updateError) {
        console.error("Failed to save email to activity:", updateError);
        toast({
          title: "Email generata ma non salvata",
          description: updateError.message,
          variant: "destructive",
        });
      }

      return result;
    } catch (err: any) {
      toast({ title: "Errore generazione", description: err.message, variant: "destructive" });
      return null;
    } finally {
      setIsGenerating(false);
    }
  };

  const reset = () => setEmail(null);

  return { generate, isGenerating, email, setEmail, reset };
}
