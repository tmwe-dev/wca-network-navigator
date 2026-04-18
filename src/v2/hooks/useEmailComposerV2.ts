/**
 * useEmailComposerV2 — State & mutations for the email composer
 */
import { useState, useCallback } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useLocation } from "react-router-dom";
import { toast } from "sonner";
import { queryKeys } from "@/lib/queryKeys";
import { invokeEdge } from "@/lib/api/invokeEdge";

export interface EmailRecipient {
  readonly email: string;
  readonly name: string;
  readonly companyName?: string;
  readonly partnerId?: string;
  readonly contactId?: string;
}

interface PrefillState {
  readonly prefilledRecipient?: EmailRecipient;
  readonly prefilledSubject?: string;
  readonly prefilledBody?: string;
}

const EMAIL_VARIABLES = [
  { key: "{{company_name}}", label: "Azienda" },
  { key: "{{contact_name}}", label: "Contatto" },
  { key: "{{city}}", label: "Città" },
  { key: "{{country}}", label: "Paese" },
] as const;

export { EMAIL_VARIABLES };

export function useEmailComposerV2() {
  const location = useLocation();
  const prefill = (location.state as PrefillState | null) ?? {};

  const [recipients, setRecipients] = useState<EmailRecipient[]>(
    prefill.prefilledRecipient ? [prefill.prefilledRecipient] : [],
  );
  const [subject, setSubject] = useState(prefill.prefilledSubject ?? "");
  const [body, setBody] = useState(prefill.prefilledBody ?? "");
  const [emailType, setEmailType] = useState("primo_contatto");
  const [tone, setTone] = useState("professionale");
  const [useKB, setUseKB] = useState(true);

  const addRecipient = useCallback((r: EmailRecipient) => {
    setRecipients((prev) => {
      if (prev.some((p) => p.email === r.email)) return prev;
      return [...prev, r];
    });
  }, []);

  const removeRecipient = useCallback((email: string) => {
    setRecipients((prev) => prev.filter((r) => r.email !== email));
  }, []);

  // Templates query
  const templates = useQuery({
    queryKey: queryKeys.v2.emailTemplates,
    queryFn: async () => {
      const { data } = await supabase
        .from("email_prompts")
        .select("id, title, instructions, scope")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(20);
      return data ?? [];
    },
  });

  // Send mutation
  const sendMutation = useMutation({
    mutationFn: async () => {
      if (recipients.length === 0) throw new Error("Nessun destinatario");
      if (!subject) throw new Error("Oggetto mancante");
      if (!body) throw new Error("Corpo mancante");

      for (const r of recipients) {
        await invokeEdge("send-email", {
          body: { to: r.email, subject, html: body },
          context: "emailComposerV2Send",
        });
      }
    },
    onSuccess: () => {
      toast.success(`Email inviata a ${recipients.length} destinatar${recipients.length > 1 ? "i" : "io"}`);
      setRecipients([]);
      setSubject("");
      setBody("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // AI generate
  const generateMutation = useMutation({
    mutationFn: async (goal?: string) => {
      const recipientInfo = recipients[0]
        ? `Destinatario: ${recipients[0].name} di ${recipients[0].companyName ?? "N/D"} (${recipients[0].email})`
        : "";

      const data = await invokeEdge<{ response?: string; content?: string }>("ai-assistant", {
        body: {
          messages: [{
            role: "user",
            content: `Genera un'email di tipo "${emailType}", tono "${tone}". ${recipientInfo}. Oggetto: ${subject || "da definire"}. ${goal ? `Obiettivo: ${goal}` : ""} Contesto: outreach commerciale logistica.`,
          }],
          context: "email_composer",
          use_kb: useKB,
        },
        context: "emailComposerV2",
      });
      const aiBody = data?.response || data?.content || "";
      if (aiBody) setBody(aiBody);
    },
    onError: () => toast.error("Errore nella generazione AI"),
  });

  // Save draft
  const saveDraftMutation = useMutation({
    mutationFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Non autenticato");
      const { error } = await supabase.from("email_drafts").insert({
        subject,
        html_body: body,
        recipient_type: "manual",
        status: "draft",
        user_id: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Bozza salvata"),
    onError: (e: Error) => toast.error(e.message),
  });

  return {
    recipients, addRecipient, removeRecipient,
    subject, setSubject,
    body, setBody,
    emailType, setEmailType,
    tone, setTone,
    useKB, setUseKB,
    templates: templates.data ?? [],
    send: sendMutation,
    generate: generateMutation,
    saveDraft: saveDraftMutation,
  };
}
