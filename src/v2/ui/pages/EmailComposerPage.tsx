/**
 * EmailComposerPage — Email editor with AI assistant
 */
import * as React from "react";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../atoms/Button";
import { Send, Sparkles } from "lucide-react";
import { toast } from "sonner";

export function EmailComposerPage(): React.ReactElement {
  const [to, setTo] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);

  const handleSend = async () => {
    if (!to || !subject || !body) { toast.error("Compila tutti i campi"); return; }
    setSending(true);
    try {
      const { error } = await supabase.functions.invoke("send-email", {
        body: { to, subject, html: body },
      });
      if (error) throw error;
      toast.success("Email inviata");
      setTo(""); setSubject(""); setBody("");
    } catch (e) {
      toast.error(`Errore: ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setSending(false);
    }
  };

  const handleAIGenerate = async () => {
    if (!to && !subject) { toast.error("Inserisci almeno il destinatario o l'oggetto"); return; }
    setGenerating(true);
    try {
      const { data } = await supabase.functions.invoke("ai-assistant", {
        body: {
          messages: [{ role: "user", content: `Genera un'email professionale. Destinatario: ${to}. Oggetto: ${subject}. Contesto: outreach commerciale logistica.` }],
          context: "email_composer",
        },
      });
      if (data?.response) setBody(data.response);
    } catch {
      toast.error("Errore nella generazione AI");
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="p-6 space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Componi Email</h1>
        <p className="text-sm text-muted-foreground">Editor email con assistente AI.</p>
      </div>
      <div className="space-y-4">
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Destinatario</label>
          <input className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={to} onChange={(e) => setTo(e.target.value)} placeholder="email@example.com" />
        </div>
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Oggetto</label>
          <input className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Oggetto dell'email" />
        </div>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Corpo</label>
            <Button variant="ghost" size="sm" onClick={handleAIGenerate} isLoading={generating} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />Genera con AI
            </Button>
          </div>
          <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground min-h-[300px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrivi il contenuto..." />
        </div>
        <div className="flex gap-2">
          <Button onClick={handleSend} isLoading={sending} className="gap-2"><Send className="h-4 w-4" />Invia</Button>
        </div>
      </div>
    </div>
  );
}
