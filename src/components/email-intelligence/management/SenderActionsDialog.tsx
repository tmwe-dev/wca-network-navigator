/**
 * SenderActionsDialog — Popup grande, giocosa, con TUTTE le azioni e regole
 * applicabili ad un singolo sender.
 *
 * Sostituisce la riga di icone azione sulla card. Card pulita = solo
 * info + 2 bottoni (questa popup + AI).
 *
 * Sezioni:
 *   1. Azioni di organizzazione (no destructive): Segna lette, Archivia,
 *      Sposta in cartella (con elenco IMAP reale), Sposta in Spam, Esporta.
 *   2. Prompt regola custom: textarea libera dove l'utente descrive cosa
 *      vuole succeda; salvata su email_address_rules.notes + custom_prompt.
 *   3. (Hidden in this phase) Elimina/Blocca → li facciamo dopo, dal server.
 *
 * Tutte le azioni di "spostamento" passano per la edge function
 * `manage-email-folders` (caricamento IMAP progressivo gestito server-side).
 */
import { useEffect, useMemo, useState } from "react";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList, CommandSeparator,
} from "@/components/ui/command";
import {
  MailCheck, Archive, FolderInput, ShieldAlert, Download, Sparkles,
  Loader2, Wand2, ChevronsUpDown, FileText, Users,
} from "lucide-react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { supabase } from "@/integrations/supabase/client";
import { useImapFolders, useCreateRuleFromSender } from "@/hooks/useEmailFolderActions";
import type { SenderAnalysis } from "@/types/email-management";


import { createLogger } from "@/lib/log";
const log = createLogger("SenderActionsDialog");
/** Voce nel selettore template prompt. */
interface PromptTemplate {
  id: string;
  source: "email_prompts" | "email_address_rules";
  title: string;
  subtitle?: string;
  instructions: string;
}

interface SenderActionsDialogProps {
  sender: SenderAnalysis | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Quando un'azione viene eseguita, il parent può aggiornare la lista. */
  onActionDone?: () => void;
}

export function SenderActionsDialog({
  sender, open, onOpenChange, onActionDone,
}: SenderActionsDialogProps) {
  const [busy, setBusy] = useState<string | null>(null);
  const [showFolders, setShowFolders] = useState(false);
  const [prompt, setPrompt] = useState("");
  const [templates, setTemplates] = useState<PromptTemplate[]>([]);
  const [templatesLoading, setTemplatesLoading] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
  const folders = useImapFolders();
  const createRule = useCreateRuleFromSender();

  // Carica i prompt template (email_prompts + custom_prompt esistenti) all'apertura.
  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    (async () => {
      setTemplatesLoading(true);
      try {
        const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
        if (!user) return;

        // 1) Template ufficiali da email_prompts
        const { data: prompts } = await supabase
          .from("email_prompts")
          .select("id, title, instructions, scope, scope_value")
          .eq("user_id", user.id)
          .eq("is_active", true)
          .not("instructions", "is", null)
          .order("priority", { ascending: false })
          .limit(50);

        // 2) Prompt custom già usati su altri mittenti (uniti per testo)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const sb = supabase as any;
        const { data: rules } = await sb
          .from("email_address_rules")
          .select("id, email_address, display_name, custom_prompt")
          .eq("user_id", user.id)
          .not("custom_prompt", "is", null)
          .order("last_applied_at", { ascending: false, nullsFirst: false })
          .limit(100);

        const list: PromptTemplate[] = [];
        for (const p of prompts ?? []) {
          const instr = (p as { instructions: string | null }).instructions?.trim();
          if (!instr) continue;
          list.push({
            id: `ep:${p.id}`,
            source: "email_prompts",
            title: (p as { title: string }).title || "(senza titolo)",
            subtitle: (p as { scope?: string | null; scope_value?: string | null }).scope_value
              ?? (p as { scope?: string | null }).scope ?? undefined,
            instructions: instr,
          });
        }

        const seenText = new Set<string>();
        for (const r of (rules ?? []) as Array<{
          id: string; email_address: string; display_name: string | null; custom_prompt: string | null;
        }>) {
          const txt = r.custom_prompt?.trim();
          if (!txt) continue;
          // dedup per testo + escludi il mittente corrente
          const key = txt.slice(0, 200).toLowerCase();
          if (seenText.has(key)) continue;
          if (sender && r.email_address === sender.email) continue;
          seenText.add(key);
          list.push({
            id: `ar:${r.id}`,
            source: "email_address_rules",
            title: r.display_name || r.email_address,
            subtitle: r.email_address,
            instructions: txt,
          });
        }

        if (!cancelled) setTemplates(list);
      } catch (e) {
        log.warn("[SenderActionsDialog] template load failed", { error: e });
      } finally {
        if (!cancelled) setTemplatesLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, sender]);

  const officialTemplates = useMemo(
    () => templates.filter((t) => t.source === "email_prompts"),
    [templates],
  );
  const reusedTemplates = useMemo(
    () => templates.filter((t) => t.source === "email_address_rules"),
    [templates],
  );
  const selectedTemplate = useMemo(
    () => templates.find((t) => t.id === selectedTemplateId) ?? null,
    [templates, selectedTemplateId],
  );

  const applyTemplate = (tpl: PromptTemplate) => {
    setPrompt(tpl.instructions);
    setSelectedTemplateId(tpl.id);
    setPickerOpen(false);
  };

  if (!sender) return null;

  const close = () => {
    setShowFolders(false);
    setPrompt("");
    setSelectedTemplateId(null);
    setPickerOpen(false);
    onOpenChange(false);
  };

  const applyRule = async (
    auto_action: string,
    target_folder?: string,
    label = "Regola applicata",
  ) => {
    setBusy(auto_action + (target_folder ? `:${target_folder}` : ""));
    try {
      await createRule.mutateAsync({
        email_address: sender.email,
        display_name: sender.companyName,
        auto_action,
        auto_execute: true,
        target_folder,
        apply_to_history: true,
      });
      toast.success(`${label} per ${sender.companyName}`);
      onActionDone?.();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore");
    } finally {
      setBusy(null);
    }
  };

  const handleExport = async () => {
    setBusy("export");
    try {
      // Esportazione semplice: scarica CSV con header dei messaggi.
      const { data, error } = await supabase
        .from("channel_messages")
        .select("email_date, subject, from_address, to_address")
        .eq("from_address", sender.email)
        .eq("channel", "email")
        .order("email_date", { ascending: false })
        .limit(2000);
      if (error) throw error;
      const rows = data ?? [];
      const csv = [
        "data,oggetto,from,to",
        ...rows.map((r) => [
          r.email_date ?? "",
          (r.subject ?? "").replace(/"/g, '""'),
          r.from_address ?? "",
          r.to_address ?? "",
        ].map((c) => `"${c}"`).join(",")),
      ].join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${sender.email}-emails.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Esportate ${rows.length} email`);
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore export");
    } finally {
      setBusy(null);
    }
  };

  const savePrompt = async () => {
    if (!prompt.trim()) {
      toast.error("Scrivi cosa vuoi che succeda");
      return;
    }
    setBusy("prompt");
    try {
      const { data: { session: __s } } = await supabase.auth.getSession(); const user = __s?.user ?? null;
      if (!user) throw new Error("Sessione scaduta");
      const { data: existing } = await supabase
        .from("email_address_rules")
        .select("id")
        .eq("email_address", sender.email)
        .eq("user_id", user.id)
        .maybeSingle();
      if (existing?.id) {
        const { error } = await supabase
          .from("email_address_rules")
          .update({ custom_prompt: prompt, notes: prompt, is_active: true })
          .eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("email_address_rules")
          .insert({
            user_id: user.id,
            email_address: sender.email,
            address: sender.email,
            display_name: sender.companyName,
            custom_prompt: prompt,
            notes: prompt,
            is_active: true,
          });
        if (error) throw error;
      }
      toast.success("Prompt regola salvato");
      onActionDone?.();
      close();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Errore salvataggio prompt");
    } finally {
      setBusy(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => (v ? onOpenChange(v) : close())}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl">
            <Wand2 className="h-5 w-5 text-primary" />
            Azioni e regole
          </DialogTitle>
          <DialogDescription>
            Per <strong>{sender.companyName}</strong> ({sender.email}) — {sender.emailCount} email
            in archivio. Le regole vengono salvate e applicate retroattivamente alla cronologia.
          </DialogDescription>
        </DialogHeader>

        {!showFolders ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-2">
            <BigActionButton
              icon={<MailCheck className="h-7 w-7" />}
              label="Segna come lette"
              hint="Tutte le mail di questo mittente saranno marcate come lette"
              onClick={() => applyRule("mark_read", undefined, "Mark-as-read attivo")}
              busy={busy === "mark_read"}
              disabled={busy !== null}
              tone="info"
            />
            <BigActionButton
              icon={<Archive className="h-7 w-7" />}
              label="Archivia"
              hint="Sposta in cartella Archive del server"
              onClick={() => applyRule("archive", undefined, "Archiviazione attiva")}
              busy={busy === "archive"}
              disabled={busy !== null}
              tone="default"
            />
            <BigActionButton
              icon={<FolderInput className="h-7 w-7" />}
              label="Sposta in cartella…"
              hint="Scegli la cartella IMAP di destinazione"
              onClick={() => setShowFolders(true)}
              disabled={busy !== null}
              tone="default"
            />
            <BigActionButton
              icon={<ShieldAlert className="h-7 w-7" />}
              label="Spam"
              hint="Sposta in Junk e segna come spam (no auto-elimina)"
              onClick={() => applyRule("spam", undefined, "Regola spam attiva")}
              busy={busy === "spam"}
              disabled={busy !== null}
              tone="warn"
            />
            <BigActionButton
              icon={<Download className="h-7 w-7" />}
              label="Esporta CSV"
              hint="Scarica l'elenco delle mail di questo mittente"
              onClick={handleExport}
              busy={busy === "export"}
              disabled={busy !== null}
              tone="default"
            />
            <BigActionButton
              icon={<Sparkles className="h-7 w-7" />}
              label="Suggerimento AI"
              hint="Disponibile presto: classificazione automatica per questo sender"
              onClick={() => toast.info("In arrivo nella prossima fase")}
              disabled
              tone="ai"
            />
          </div>
        ) : (
          <div className="py-2 space-y-2">
            <div className="flex items-center justify-between">
              <Label>Cartelle disponibili sul server IMAP</Label>
              <Button variant="ghost" size="sm" onClick={() => setShowFolders(false)}>
                ← Torna alle azioni
              </Button>
            </div>
            <div className="max-h-72 overflow-y-auto border rounded-md divide-y">
              {folders.isLoading && (
                <div className="p-3 space-y-2">
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                  <Skeleton className="h-8 w-full" />
                </div>
              )}
              {folders.error && (
                <div className="p-3 text-sm text-destructive">
                  Impossibile caricare le cartelle: {String(folders.error)}
                </div>
              )}
              {!folders.isLoading && !folders.error && (folders.data ?? []).length === 0 && (
                <div className="p-3 text-sm text-muted-foreground">Nessuna cartella trovata.</div>
              )}
              {(folders.data ?? []).map((name) => (
                <button
                  key={name}
                  type="button"
                  className="w-full text-left px-3 py-2 hover:bg-muted text-sm flex items-center justify-between disabled:opacity-50"
                  disabled={busy !== null}
                  onClick={() => applyRule("move_to_folder", name, `Sposta in "${name}"`)}
                >
                  <span className="font-medium text-foreground">{name}</span>
                  {busy === `move_to_folder:${name}` && (
                    <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Prompt regola libero */}
        {!showFolders && (
          <div className="space-y-2 pt-2 border-t">
            <Label htmlFor="rule-prompt" className="flex items-center gap-2">
              <Sparkles className="h-4 w-4 text-primary" />
              Oppure descrivi una regola personalizzata
            </Label>

            {/* Picker template prompt esistenti */}
            <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={pickerOpen}
                  className="w-full justify-between font-normal h-auto py-2"
                  disabled={busy !== null || templatesLoading}
                >
                  <span className="flex items-center gap-2 min-w-0 text-left">
                    <FileText className="h-4 w-4 text-muted-foreground shrink-0" />
                    {templatesLoading ? (
                      <span className="text-muted-foreground">Carico template…</span>
                    ) : selectedTemplate ? (
                      <span className="flex flex-col min-w-0">
                        <span className="truncate text-sm font-medium">{selectedTemplate.title}</span>
                        {selectedTemplate.subtitle && (
                          <span className="truncate text-[11px] text-muted-foreground">
                            {selectedTemplate.subtitle}
                          </span>
                        )}
                      </span>
                    ) : (
                      <span className="text-muted-foreground">
                        Scegli un prompt esistente come template…
                      </span>
                    )}
                  </span>
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground shrink-0" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                <Command>
                  <CommandInput placeholder="Cerca per titolo, mittente o testo…" />
                  <CommandList className="max-h-72">
                    <CommandEmpty>Nessun template trovato.</CommandEmpty>
                    {officialTemplates.length > 0 && (
                      <CommandGroup heading="Template prompt salvati">
                        {officialTemplates.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={`${t.title} ${t.subtitle ?? ""} ${t.instructions}`}
                            onSelect={() => applyTemplate(t)}
                            className="flex flex-col items-start gap-0.5"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <FileText className="h-3.5 w-3.5 text-primary shrink-0" />
                              <span className="font-medium text-sm truncate flex-1">{t.title}</span>
                              {t.subtitle && (
                                <span className="text-[10px] text-muted-foreground shrink-0">
                                  {t.subtitle}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground line-clamp-2 pl-5">
                              {t.instructions}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                    {officialTemplates.length > 0 && reusedTemplates.length > 0 && (
                      <CommandSeparator />
                    )}
                    {reusedTemplates.length > 0 && (
                      <CommandGroup heading="Riusa da altri mittenti">
                        {reusedTemplates.map((t) => (
                          <CommandItem
                            key={t.id}
                            value={`${t.title} ${t.subtitle ?? ""} ${t.instructions}`}
                            onSelect={() => applyTemplate(t)}
                            className="flex flex-col items-start gap-0.5"
                          >
                            <div className="flex items-center gap-2 w-full">
                              <Users className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                              <span className="font-medium text-sm truncate flex-1">{t.title}</span>
                              {t.subtitle && (
                                <span className="text-[10px] text-muted-foreground shrink-0 truncate max-w-[40%]">
                                  {t.subtitle}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-muted-foreground line-clamp-2 pl-5">
                              {t.instructions}
                            </span>
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    )}
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>

            <Textarea
              id="rule-prompt"
              placeholder="Es. 'Quando arriva una mail da questo sender con oggetto che contiene fattura, spostala in Contabilità e segnala come letta'"
              rows={3}
              value={prompt}
              onChange={(e) => {
                setPrompt(e.target.value);
                // Se l'utente modifica, scolleghiamo il template selezionato
                if (selectedTemplate && e.target.value !== selectedTemplate.instructions) {
                  setSelectedTemplateId(null);
                }
              }}
              disabled={busy !== null}
            />
            <p className="text-xs text-muted-foreground">
              Scegli un template per partire veloce, oppure scrivi liberamente. Le modifiche al
              testo vengono salvate sulla regola di questo mittente — il template originale non
              viene toccato.
            </p>
          </div>
        )}

        <DialogFooter>
          <Button variant="ghost" onClick={close} disabled={busy !== null}>Chiudi</Button>
          {!showFolders && (
            <Button
              onClick={savePrompt}
              disabled={busy !== null || !prompt.trim()}
            >
              {busy === "prompt" && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Salva prompt regola
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function BigActionButton({
  icon, label, hint, onClick, busy, disabled, tone = "default",
}: {
  icon: React.ReactNode;
  label: string;
  hint: string;
  onClick: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "default" | "info" | "warn" | "ai";
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "flex flex-col items-center gap-2 p-4 rounded-xl border-2 text-center transition-all",
        "hover:scale-[1.02] hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100",
        tone === "info" && "border-primary/30 bg-primary/5 hover:border-primary hover:bg-primary/10",
        tone === "warn" && "border-destructive/40 bg-destructive/5 hover:border-destructive hover:bg-destructive/10",
        tone === "ai" && "border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 hover:border-primary",
        tone === "default" && "border-border hover:border-primary/50 hover:bg-muted",
      )}
    >
      <div className={cn(
        "rounded-full p-2",
        tone === "info" && "text-primary bg-primary/10",
        tone === "warn" && "text-destructive bg-destructive/10",
        tone === "ai" && "text-primary bg-primary/15",
        tone === "default" && "text-foreground/80",
      )}>
        {busy ? <Loader2 className="h-7 w-7 animate-spin" /> : icon}
      </div>
      <div className="font-semibold text-sm text-foreground">{label}</div>
      <div className="text-[11px] text-muted-foreground leading-snug">{hint}</div>
    </button>
  );
}