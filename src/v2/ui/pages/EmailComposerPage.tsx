/**
 * EmailComposerPage — Full email editor with AI, recipient search, attachments
 */
import * as React from "react";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "../atoms/Button";
import { Send, Sparkles, Search, X, Paperclip } from "lucide-react";
import { toast } from "sonner";
import { useNavigate, useLocation } from "react-router-dom";

interface Recipient {
  readonly email: string;
  readonly name?: string;
}

export function EmailComposerPage(): React.ReactElement {
  const location = useLocation();
  const navigate = useNavigate();
  const prefilled = (location.state as Record<string, unknown>)?.prefilledRecipient as Recipient | undefined;

  const [to, setTo] = useState(prefilled?.email ?? "");
  const [recipientSearch, setRecipientSearch] = useState("");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showRecipientSearch, setShowRecipientSearch] = useState(false);

  // Search contacts for recipient autocomplete
  const { data: searchResults } = useQuery({
    queryKey: ["v2-email-recipients", recipientSearch],
    enabled: recipientSearch.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("imported_contacts")
        .select("id, name, company_name, email")
        .not("email", "is", null)
        .or(`name.ilike.%${recipientSearch}%,email.ilike.%${recipientSearch}%,company_name.ilike.%${recipientSearch}%`)
        .limit(10);
      return data ?? [];
    },
  });

  // Email templates
  const { data: templates } = useQuery({
    queryKey: ["v2-email-templates"],
    queryFn: async () => {
      const { data } = await supabase
        .from("email_prompts")
        .select("id, title, instructions")
        .eq("is_active", true)
        .order("priority", { ascending: false })
        .limit(10);
      return data ?? [];
    },
  });

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
    <div className="flex h-full">
      <div className="flex-1 p-6 space-y-4 max-w-3xl">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Componi Email</h1>
          <p className="text-sm text-muted-foreground">Editor email con assistente AI.</p>
        </div>

        {/* Recipient */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Destinatario</label>
          <div className="relative">
            <input
              className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground pr-10"
              value={to}
              onChange={(e) => { setTo(e.target.value); setRecipientSearch(e.target.value); setShowRecipientSearch(true); }}
              onFocus={() => setShowRecipientSearch(true)}
              placeholder="email@example.com — cerca un contatto..."
            />
            <Search className="absolute right-3 top-2.5 h-4 w-4 text-muted-foreground" />
            {showRecipientSearch && searchResults && searchResults.length > 0 ? (
              <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-card border rounded-md shadow-lg max-h-48 overflow-y-auto">
                {searchResults.map((r) => (
                  <button
                    key={r.id}
                    className="w-full text-left px-3 py-2 hover:bg-accent/50 text-sm"
                    onClick={() => { setTo(r.email!); setShowRecipientSearch(false); }}
                  >
                    <span className="font-medium text-foreground">{r.name ?? r.company_name ?? r.email}</span>
                    <span className="text-xs text-muted-foreground ml-2">{r.email}</span>
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </div>

        {/* Subject */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Oggetto</label>
          <input className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground" value={subject} onChange={(e) => setSubject(e.target.value)} placeholder="Oggetto dell'email" />
        </div>

        {/* Body */}
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <label className="text-sm font-medium text-foreground">Corpo</label>
            <Button variant="ghost" size="sm" onClick={handleAIGenerate} isLoading={generating} className="gap-1.5">
              <Sparkles className="h-3.5 w-3.5" />Genera con AI
            </Button>
          </div>
          <textarea className="w-full rounded-md border bg-background px-3 py-2 text-sm text-foreground min-h-[300px]" value={body} onChange={(e) => setBody(e.target.value)} placeholder="Scrivi il contenuto..." />
        </div>

        {/* Actions */}
        <div className="flex gap-2">
          <Button onClick={handleSend} isLoading={sending} className="gap-2"><Send className="h-4 w-4" />Invia</Button>
          <Button variant="outline" onClick={() => navigate(-1)}>Annulla</Button>
        </div>
      </div>

      {/* Templates sidebar */}
      {templates && templates.length > 0 ? (
        <aside className="w-64 border-l bg-card p-4 overflow-y-auto hidden lg:block">
          <p className="text-xs font-semibold text-muted-foreground uppercase mb-3">Template</p>
          <div className="space-y-2">
            {templates.map((t) => (
              <button key={t.id} onClick={() => setBody(t.instructions)} className="w-full text-left p-2 rounded-md border hover:bg-accent/50 transition-colors">
                <p className="text-xs font-medium text-foreground truncate">{t.title}</p>
              </button>
            ))}
          </div>
        </aside>
      ) : null}
    </div>
  );
}
