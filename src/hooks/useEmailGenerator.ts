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
  }) => {
    setIsGenerating(true);
    setEmail(null);
    try {
      const { data, error } = await supabase.functions.invoke("generate-email", {
        body: params,
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      setEmail(data as GeneratedEmail);
      return data as GeneratedEmail;
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
