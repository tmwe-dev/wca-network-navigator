/**
 * InlineGroupAssigner — Popover per assegnare gruppo / custom prompt
 * a un indirizzo email direttamente dalla vista Inbox, senza aprire Funny Mail.
 *
 * Sorgente di verità: `email_address_rules` via DAL (`upsertEmailAddressRule`).
 * Lettura gruppi: hook `useEmailAddressGroups` (cache già presente).
 */
import { useState, useMemo } from "react";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { Tag, Wand2, Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Textarea } from "@/components/ui/textarea";
import { Separator } from "@/components/ui/separator";
import { toast } from "sonner";
import { useAuth } from "@/providers/AuthProvider";
import { upsertEmailAddressRule } from "@/data/emailAddressRules";
import { useEmailAddressGroups } from "@/hooks/useEmailAddressGroups";
import { untypedFrom } from "@/lib/supabaseUntyped";

type GroupRow = { nome_gruppo: string; colore: string | null; icon: string | null };

function extractEmail(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const m = raw.match(/<([^>]+)>/);
  const addr = (m ? m[1] : raw).trim().toLowerCase();
  return addr || null;
}

export function InlineGroupAssigner({
  fromAddress,
  currentGroupName,
  currentPrompt,
}: {
  fromAddress: string | null | undefined;
  currentGroupName: string | null;
  currentPrompt?: string | null;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [prompt, setPrompt] = useState(currentPrompt ?? "");
  const { byEmail } = useEmailAddressGroups();
  const addr = useMemo(() => extractEmail(fromAddress), [fromAddress]);

  const { data: groups = [] } = useQuery({
    queryKey: ["email-address-groups", "list", user?.id ?? "anon"],
    enabled: open && !!user?.id,
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data } = await untypedFrom("email_sender_groups")
        .select("nome_gruppo, colore, icon")
        .eq("user_id", user!.id)
        .order("sort_order", { ascending: true });
      return (data ?? []) as GroupRow[];
    },
  });

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["email-address-groups"] });
  };

  const assignMut = useMutation({
    mutationFn: async (group_name: string | null) => {
      if (!user?.id || !addr) throw new Error("Utente o indirizzo mancante");
      await upsertEmailAddressRule(user.id, addr, { group_name });
    },
    onSuccess: (_d, group_name) => {
      invalidateAll();
      toast.success(group_name ? `Assegnato a "${group_name}"` : "Gruppo rimosso");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const promptMut = useMutation({
    mutationFn: async () => {
      if (!user?.id || !addr) throw new Error("Utente o indirizzo mancante");
      await upsertEmailAddressRule(user.id, addr, { custom_prompt: prompt.trim() || null });
    },
    onSuccess: () => {
      invalidateAll();
      toast.success("Istruzione personalizzata salvata");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (!addr) return null;

  // Sync prompt on rule data change
  const ruleHit = byEmail.get(addr);
  const effectiveGroup = ruleHit?.groupName ?? currentGroupName;

  return (
    <Popover open={open} onOpenChange={(v) => { setOpen(v); if (v) setPrompt(currentPrompt ?? ""); }}>
      <PopoverTrigger asChild>
        <Button
          size="sm"
          variant={effectiveGroup ? "ghost" : "secondary"}
          className="h-6 gap-1 px-2 text-[10px]"
          title={effectiveGroup ? "Modifica gruppo / istruzione" : "Assegna a un gruppo"}
        >
          <Tag className="h-3 w-3" />
          {effectiveGroup ? "Modifica" : "Assegna gruppo"}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-3" align="start">
        <div className="space-y-3">
          <div>
            <p className="text-xs font-semibold text-muted-foreground mb-1">Indirizzo</p>
            <p className="text-xs font-mono truncate">{addr}</p>
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold mb-2">Gruppo</p>
            <div className="flex flex-wrap gap-1.5 max-h-40 overflow-auto">
              {groups.map((g) => {
                const active = g.nome_gruppo === effectiveGroup;
                return (
                  <button
                    key={g.nome_gruppo}
                    type="button"
                    onClick={() => assignMut.mutate(g.nome_gruppo)}
                    disabled={assignMut.isPending}
                    className="inline-flex items-center gap-1 rounded px-2 py-1 text-[10px] font-medium border transition-colors hover:opacity-80"
                    style={{
                      backgroundColor: `${g.colore ?? "#3B82F6"}${active ? "33" : "11"}`,
                      color: g.colore ?? "#3B82F6",
                      borderColor: active ? (g.colore ?? "#3B82F6") : "transparent",
                    }}
                  >
                    {g.icon && <span>{g.icon}</span>}
                    <span>{g.nome_gruppo}</span>
                    {active && <Check className="h-2.5 w-2.5" />}
                  </button>
                );
              })}
              {groups.length === 0 && (
                <p className="text-[10px] text-muted-foreground italic">
                  Nessun gruppo definito. Creane uno da Funny Mail.
                </p>
              )}
            </div>
            {effectiveGroup && (
              <Button
                size="sm"
                variant="ghost"
                className="mt-2 h-6 text-[10px] text-destructive"
                onClick={() => assignMut.mutate(null)}
                disabled={assignMut.isPending}
              >
                Rimuovi assegnazione
              </Button>
            )}
          </div>

          <Separator />

          <div>
            <p className="text-xs font-semibold mb-1 flex items-center gap-1">
              <Wand2 className="h-3 w-3" /> Istruzione AI per questo mittente
            </p>
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              placeholder="Es. Rispondi sempre in tono formale, includi riferimento contratto…"
              rows={3}
              className="text-xs"
            />
            <Button
              size="sm"
              className="mt-2 h-7 text-xs w-full"
              onClick={() => promptMut.mutate()}
              disabled={promptMut.isPending}
            >
              {promptMut.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : "Salva istruzione"}
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}